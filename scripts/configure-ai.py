#!/usr/bin/env python3
"""
Turns on the live AI copilot with a free Google Gemini key.

Run it yourself:  python3 scripts/configure-ai.py
The key is typed with hidden input, checked against Google (model list + one tool call), then stored as a
sensitive Vercel variable and the site is redeployed. Optionally it is also saved to the git-ignored
.env.local so the live evaluation can run locally. The key is never printed.
"""
import getpass
import re
import socket
import time
import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
PREFERRED = ["gemini-3.8-flash", "gemini-flash-latest", "gemini-3-flash", "gemini-2.5-flash", "gemini-2.0-flash"]
TRANSIENT = (429, 500, 502, 503, 504)
SKIP = ("lite", "image", "tts", "live", "audio", "embedding", "thinking", "exp", "vision", "learnlm", "gemma", "robotics", "computer-use")


def call(path, key, body=None):
    req = urllib.request.Request(f"{BASE}/{path}", data=json.dumps(body).encode() if body else None, method="POST" if body else "GET",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def candidates(key):
    """Flash models this key can see: the preferred names first, then the newest other Flash models (previews last)."""
    ids = [m["id"].removeprefix("models/") for m in call("models", key).get("data", [])]
    flash = sorted((i for i in ids if "flash" in i and not any(s in i for s in SKIP)), key=lambda i: ("preview" in i, [-ord(c) for c in i]))
    ordered = [m for m in PREFERRED if m in ids] + [m for m in flash if m not in PREFERRED]
    if not ordered:
        sys.exit("No suitable Gemini Flash model is available to this key.")
    return ordered


def google_error(e):
    try:
        body = json.loads(e.read().decode())
        body = body[0] if isinstance(body, list) else body
        return body.get("error", {}).get("message", "")[:200]
    except Exception:
        return ""


def tool_call_works(key, model):
    body = {
        "model": model,
        "messages": [{"role": "user", "content": "What is on my study schedule? Use the tool."}],
        "tools": [{"type": "function", "function": {"name": "list_assignments", "description": "List the student's assignments", "parameters": {"type": "object", "properties": {}}}}],
        "tool_choice": "auto",
        "parallel_tool_calls": False,
    }
    res = call("chat/completions", key, body)
    return bool(res["choices"][0]["message"].get("tool_calls"))


def vercel(*args):
    return subprocess.run(["vercel", *args], capture_output=True, text=True)


def latest_production_url():
    out = vercel("ls", "catchupai")
    for line in (out.stdout + out.stderr).splitlines():
        if "Production" in line and "Ready" in line:
            return next(p for p in line.split() if p.startswith("https://"))
    sys.exit("Couldn't find a ready production deployment to redeploy.")


def main():
    print("CatchUp AI · live copilot on the Gemini free tier\n")
    key = getpass.getpass("Gemini API key from https://aistudio.google.com/apikey (hidden): ").strip()
    if not key:
        sys.exit("No key entered.")
    try:
        models = candidates(key)
    except urllib.error.HTTPError as e:
        sys.exit(f"Google rejected the key ({e.code}): {google_error(e)}")
    print(f"  ✓ key works · {len(models)} Flash model(s) visible")
    model, fallback = None, None
    queue, tried = list(models), 0
    while queue and tried < 7:
        name = queue.pop(0)
        tried += 1
        for attempt in range(3):
            try:
                used_tool = tool_call_works(key, name)
                model = name
                print(f"  ✓ {name} answers" + (" and calls tools" if used_tool else " (but didn't call the tool in this test)"))
                break
            except urllib.error.HTTPError as e:
                message = google_error(e)
                suggested = re.search(r"use models/([\w.-]+)", message)
                if suggested and suggested.group(1) not in queue and suggested.group(1) != name:
                    queue.insert(0, suggested.group(1))
                if e.code in TRANSIENT:
                    fallback = fallback or name
                    if attempt < 2:
                        print(f"  · {name}: busy ({e.code}), retrying in {5 * (attempt + 1)} s")
                        time.sleep(5 * (attempt + 1))
                        continue
                print(f"  · {name}: not usable ({e.code}) {message[:160]}")
                break
            except (TimeoutError, socket.timeout, urllib.error.URLError) as e:
                fallback = fallback or name
                print(f"  · {name}: no answer in time ({type(e).__name__})")
                break
        if model:
            break
    if not model and fallback:
        answer = input(f"\nThe key is valid but Google is overloaded right now. Save it with {fallback} anyway? The app retries busy responses. [Y/n]: ").strip().lower()
        if answer in ("", "y", "yes"):
            model = fallback
    if not model:
        sys.exit("None of the Flash models accepted a request from this key. Check the key's project in AI Studio and try again.")
    embedding = None
    for name in ("gemini-embedding-001", "gemini-embedding-2"):
        try:
            vec = call("embeddings", key, {"model": name, "input": "residual", "dimensions": 1536})["data"][0]["embedding"]
            if len(vec) >= 1536:
                embedding = name
                print(f"  ✓ embeddings: {name} ({len(vec)} values)")
                break
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, KeyError, IndexError) as e:
            print(f"  · embeddings {name}: not usable {google_error(e) if isinstance(e, urllib.error.HTTPError) else ''}")
    if not embedding:
        print("  ! no embedding model worked; search stays keyword-only")

    print("→ Saving to Vercel and redeploying (about 1 minute)…")
    settings = [("GEMINI_API_KEY", key, ["--sensitive"]), ("GEMINI_MODEL", model, ["--type", "config"]), ("AI_PROVIDER", "gemini", ["--type", "config"])]
    if embedding:
        settings.append(("GEMINI_EMBEDDING_MODEL", embedding, ["--type", "config"]))
    for name, value, extra in settings:
        vercel("env", "rm", name, "production", "--yes")
        added = vercel("env", "add", name, "production", "--value", value, "--yes", *extra)
        if added.returncode != 0:
            sys.exit(f"Vercel didn't accept {name}.")
    if vercel("redeploy", latest_production_url(), "--target", "production").returncode != 0:
        sys.exit("Redeploy failed; run it again or redeploy from the Vercel dashboard.")
    print("  ✓ live copilot enabled at https://catchupai-chi.vercel.app/assistant")

    if input("Also save the key to .env.local so the live evaluation can run on this Mac? [Y/n]: ").strip().lower() in ("", "y", "yes"):
        lines = [l for l in open(".env.local").read().splitlines() if not l.startswith(("GEMINI_API_KEY=", "GEMINI_MODEL=", "AI_PROVIDER=", "GEMINI_EMBEDDING_MODEL="))]
        lines += [f"GEMINI_API_KEY={key}", f"GEMINI_MODEL={model}", "AI_PROVIDER=gemini"] + ([f"GEMINI_EMBEDDING_MODEL={embedding}"] if embedding else [])
        open(".env.local", "w").write("\n".join(lines) + "\n")
        print("  ✓ saved to .env.local (git-ignored)")
    print("\nDone.")


if __name__ == "__main__":
    main()

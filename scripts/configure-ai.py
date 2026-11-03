#!/usr/bin/env python3
"""
Turns on the live AI copilot with a free Google Gemini key.

Run it yourself:  python3 scripts/configure-ai.py
The key is typed with hidden input, checked against Google (model list + one tool call), then stored as a
sensitive Vercel variable and the site is redeployed. Optionally it is also saved to the git-ignored
.env.local so the live evaluation can run locally. The key is never printed.
"""
import getpass
import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "https://generativelanguage.googleapis.com/v1beta/openai"
PREFERRED = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash"]
SKIP = ("lite", "image", "tts", "live", "audio", "embedding", "thinking", "preview", "exp", "vision", "learnlm", "gemma")


def call(path, key, body=None):
    req = urllib.request.Request(f"{BASE}/{path}", data=json.dumps(body).encode() if body else None, method="POST" if body else "GET",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def pick_model(key):
    ids = [m["id"].removeprefix("models/") for m in call("models", key).get("data", [])]
    for name in PREFERRED:
        if name in ids:
            return name, ids
    flash = sorted((i for i in ids if "flash" in i and not any(s in i for s in SKIP)), reverse=True)
    if not flash:
        sys.exit("No suitable Gemini Flash model is available to this key.")
    return flash[0], ids


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
        model, _ = pick_model(key)
        print(f"  ✓ key works · model: {model}")
        print("  ✓ tool calling works" if tool_call_works(key, model) else "  ! the model answered without calling the tool (the copilot may be weaker)")
    except urllib.error.HTTPError as e:
        sys.exit(f"Google rejected the request ({e.code}). Check the key and try again.")

    print("→ Saving to Vercel and redeploying (about 1 minute)…")
    for name, value, extra in [("GEMINI_API_KEY", key, ["--sensitive"]), ("GEMINI_MODEL", model, ["--type", "config"]), ("AI_PROVIDER", "gemini", ["--type", "config"])]:
        vercel("env", "rm", name, "production", "--yes")
        added = vercel("env", "add", name, "production", "--value", value, "--yes", *extra)
        if added.returncode != 0:
            sys.exit(f"Vercel didn't accept {name}.")
    if vercel("redeploy", latest_production_url(), "--target", "production").returncode != 0:
        sys.exit("Redeploy failed; run it again or redeploy from the Vercel dashboard.")
    print("  ✓ live copilot enabled at https://catchupai-chi.vercel.app/assistant")

    if input("Also save the key to .env.local so the live evaluation can run on this Mac? [Y/n]: ").strip().lower() in ("", "y", "yes"):
        lines = [l for l in open(".env.local").read().splitlines() if not l.startswith(("GEMINI_API_KEY=", "GEMINI_MODEL=", "AI_PROVIDER="))]
        lines += [f"GEMINI_API_KEY={key}", f"GEMINI_MODEL={model}", "AI_PROVIDER=gemini"]
        open(".env.local", "w").write("\n".join(lines) + "\n")
        print("  ✓ saved to .env.local (git-ignored)")
    print("\nDone.")


if __name__ == "__main__":
    main()

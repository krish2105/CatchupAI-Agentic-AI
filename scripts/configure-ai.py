#!/usr/bin/env python3
"""
Turns on the live AI copilot with an OpenAI API key.

Run it yourself:  python3 scripts/configure-ai.py
The key is typed with hidden input, checked against OpenAI (model list, one tool call, one embedding), then stored
as a sensitive Vercel variable and the site is redeployed. Optionally it is also saved to the git-ignored
.env.local so the live evaluation can run locally. The key is never printed.

After switching an existing deployment to OpenAI embeddings, re-embed the stored documents once
(scripts/reembed-documents.ts, dry run by default) so search compares vectors from the same model.
"""
import getpass
import json
import socket
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "https://api.openai.com/v1"
# Low-cost models that call tools well, in order of preference; the first one this key can use is suggested.
PREFERRED = ["gpt-5.4-mini", "gpt-5-mini", "gpt-4.1-mini", "gpt-4o-mini"]
EMBEDDING = "text-embedding-3-small"
SKIP = ("audio", "realtime", "transcribe", "tts", "image", "search", "instruct", "codex", "preview", "embedding")


def call(path, key, body=None):
    req = urllib.request.Request(f"{BASE}/{path}", data=json.dumps(body).encode() if body else None, method="POST" if body else "GET",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def openai_error(e):
    try:
        return json.loads(e.read().decode()).get("error", {}).get("message", "")[:200]
    except Exception:
        return ""


def chat_models(key):
    ids = sorted(m["id"] for m in call("models", key).get("data", []))
    return [i for i in ids if i.startswith(("gpt", "o")) and not any(s in i for s in SKIP)]


def tool_call_works(key, model):
    body = {
        "model": model,
        "messages": [{"role": "user", "content": "What is on my study schedule? Use the tool."}],
        "tools": [{"type": "function", "function": {"name": "list_assignments", "description": "List the student's assignments", "parameters": {"type": "object", "properties": {}}}}],
        "tool_choice": "auto",
        "parallel_tool_calls": False,
        "store": False,
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
    print("CatchUp AI · live copilot on OpenAI\n")
    key = getpass.getpass("OpenAI API key from https://platform.openai.com/api-keys (hidden): ").strip()
    if not key:
        sys.exit("No key entered.")
    try:
        models = chat_models(key)
    except urllib.error.HTTPError as e:
        sys.exit(f"OpenAI rejected the key ({e.code}): {openai_error(e)}")
    print(f"  ✓ key works · {len(models)} chat model(s) visible")
    suggested = next((m for m in PREFERRED if m in models), models[0] if models else None)
    if not suggested:
        sys.exit("This key can't see any chat model. Check the project the key belongs to.")
    model = input(f"Model for the copilot [{suggested}]: ").strip() or suggested
    if model not in models:
        sys.exit(f"{model} isn't available to this key.")
    try:
        used_tool = tool_call_works(key, model)
        print(f"  ✓ {model} answers" + (" and calls tools" if used_tool else " (but didn't call the tool in this test)"))
    except urllib.error.HTTPError as e:
        sys.exit(f"{model} didn't accept a request ({e.code}): {openai_error(e)}")
    except (TimeoutError, socket.timeout, urllib.error.URLError) as e:
        sys.exit(f"{model} didn't answer in time ({type(e).__name__}); try again.")
    embedding = None
    try:
        vec = call("embeddings", key, {"model": EMBEDDING, "input": "residual", "dimensions": 1536})["data"][0]["embedding"]
        if len(vec) == 1536:
            embedding = EMBEDDING
            print(f"  ✓ embeddings: {EMBEDDING} ({len(vec)} values)")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, KeyError, IndexError) as e:
        print(f"  · embeddings {EMBEDDING}: not usable {openai_error(e) if isinstance(e, urllib.error.HTTPError) else ''}")
    if not embedding:
        print("  ! no embedding model worked; search stays keyword-only")

    print("→ Saving to Vercel and redeploying (about 1 minute)…")
    settings = [("OPENAI_API_KEY", key, ["--sensitive"]), ("OPENAI_MODEL", model, ["--type", "config"])]
    if embedding:
        settings.append(("OPENAI_EMBEDDING_MODEL", embedding, ["--type", "config"]))
    for name, value, extra in settings:
        vercel("env", "rm", name, "production", "--yes")
        added = vercel("env", "add", name, "production", "--value", value, "--yes", *extra)
        if added.returncode != 0:
            sys.exit(f"Vercel didn't accept {name}.")
    if vercel("redeploy", latest_production_url(), "--target", "production").returncode != 0:
        sys.exit("Redeploy failed; run it again or redeploy from the Vercel dashboard.")
    print("  ✓ live copilot enabled at https://catchupai-chi.vercel.app/assistant")
    print("  ! if documents were embedded with another model, re-embed them once: see scripts/reembed-documents.ts")

    if input("Also save the key to .env.local so the live evaluation can run on this computer? [Y/n]: ").strip().lower() in ("", "y", "yes"):
        names = ("OPENAI_API_KEY=", "OPENAI_MODEL=", "OPENAI_EMBEDDING_MODEL=")
        lines = [l for l in open(".env.local").read().splitlines() if not l.startswith(names)]
        lines += [f"OPENAI_API_KEY={key}", f"OPENAI_MODEL={model}"] + ([f"OPENAI_EMBEDDING_MODEL={embedding}"] if embedding else [])
        open(".env.local", "w").write("\n".join(lines) + "\n")
        print("  ✓ saved to .env.local (git-ignored)")
    print("\nDone.")


if __name__ == "__main__":
    main()

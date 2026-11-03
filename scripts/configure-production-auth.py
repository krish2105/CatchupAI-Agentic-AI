#!/usr/bin/env python3
"""
Configures production email (custom SMTP, e.g. Resend) and bot protection (Cloudflare Turnstile).

Run it yourself in a terminal:  python3 scripts/configure-production-auth.py
Secrets are typed with hidden input and sent only to Supabase/Vercel; nothing is printed or written to disk.

Order matters: the Turnstile site key goes to Vercel and the site is redeployed BEFORE CAPTCHA is switched
on in Supabase, so the live demo and sign-in never break in between.

Needs: Supabase CLI logged in (token read from the macOS keychain), Vercel CLI logged in and linked.
"""
import base64
import getpass
import json
import subprocess
import sys
import urllib.error
import urllib.request

PROJECT_REF = "keczcmggohfmgyjsdevk"
VERCEL_PROJECT = "catchupai"


def ask(prompt, default=""):
    value = input(f"{prompt}{f' [{default}]' if default else ''}: ").strip()
    return value or default


def supabase_token():
    raw = subprocess.run(["security", "find-generic-password", "-s", "Supabase CLI", "-w"], capture_output=True, text=True).stdout.strip()
    if raw.startswith("go-keyring-base64:"):
        raw = base64.b64decode(raw.split(":", 1)[1]).decode()
    if not raw.startswith("sbp_"):
        sys.exit("Couldn't read the Supabase CLI token. Run `supabase login` first.")
    return raw


def patch_auth(token, body):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/config/auth",
        data=json.dumps(body).encode(),
        method="PATCH",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "User-Agent": "catchup-ai-setup"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f"Supabase refused the change ({e.code}): {e.read().decode()[:300]}")


def vercel(*args, value=None):
    return subprocess.run(["vercel", *args], input=value, capture_output=True, text=True)


def latest_production_url():
    out = vercel("ls", VERCEL_PROJECT).stdout + vercel("ls", VERCEL_PROJECT).stderr
    for line in out.splitlines():
        if "Production" in line and "Ready" in line:
            for part in line.split():
                if part.startswith("https://"):
                    return part
    sys.exit("Couldn't find a ready production deployment to redeploy.")


def main():
    print("CatchUp AI · production email and bot protection\n")
    token = supabase_token()

    print("1) Email. Choose how sign-in codes are sent (or 'skip').")
    provider = ask("   Provider: gmail, resend or skip", "gmail").lower()
    while provider not in ("gmail", "resend", "skip"):
        provider = ask("   Please type gmail, resend or skip", "gmail").lower()
    host = port = user = password = sender = ""
    if provider == "gmail":
        host, port = "smtp.gmail.com", "465"
        user = ask("   Your Gmail address (e.g. you@gmail.com)")
        while "@" not in user or " " in user:
            user = ask("   That isn't an email address. Your Gmail address")
        sender = user
        password = getpass.getpass("   Google app password, 16 letters (hidden): ").replace(" ", "").strip()
    elif provider == "resend":
        host, port, user = "smtp.resend.com", "465", "resend"
        password = getpass.getpass("   Resend API key, starts with re_ (hidden): ").strip()
        sender = ask("   Sender address on your verified domain (e.g. noreply@mail.example.com)")
        while "@" not in sender or " " in sender:
            sender = ask("   That isn't an email address. Sender address")
    print()
    print("2) Cloudflare Turnstile. Leave the site key empty to skip.")
    site_key = ask("   Turnstile SITE key (public)")
    while site_key and not site_key.startswith("0x"):
        print("   Turnstile site keys start with 0x. Copy the Site Key from Cloudflare → Turnstile.")
        site_key = ask("   Turnstile SITE key (public)")
    secret_key = getpass.getpass("   Turnstile SECRET key (hidden): ").strip() if site_key else ""
    print()

    if site_key:
        print("→ Setting NEXT_PUBLIC_TURNSTILE_SITE_KEY on Vercel and redeploying (about 1 minute)…")
        vercel("env", "rm", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "production", "--yes")
        # The site key is public by design (it's rendered in the page), so it's stored as config, not a secret.
        added = vercel("env", "add", "NEXT_PUBLIC_TURNSTILE_SITE_KEY", "production", "--value", site_key, "--type", "config", "--yes")
        if added.returncode != 0:
            sys.exit("Vercel didn't accept the site key: " + (added.stderr or added.stdout)[-300:])
        deployed = vercel("redeploy", latest_production_url(), "--target", "production")
        if deployed.returncode != 0:
            sys.exit("Redeploy failed: " + (deployed.stderr or deployed.stdout)[-300:])
        print("  ✓ live site now shows the Turnstile check")

    body = {}
    if password:
        template = open("supabase/templates/magic_link.html", encoding="utf-8").read()
        body.update({
            "smtp_host": host, "smtp_port": port, "smtp_user": user, "smtp_pass": password,
            "smtp_admin_email": sender, "smtp_sender_name": "CatchUp AI", "smtp_max_frequency": 60,
            "rate_limit_email_sent": 30,
            "mailer_subjects_magic_link": "Your CatchUp AI sign-in code",
            "mailer_subjects_confirmation": "Your CatchUp AI sign-in code",
            "mailer_templates_magic_link_content": template,
            "mailer_templates_confirmation_content": template,
        })
    if site_key and secret_key:
        body.update({"security_captcha_enabled": True, "security_captcha_provider": "turnstile", "security_captcha_secret": secret_key})
    if not body:
        print("Nothing to change in Supabase.")
        return

    print("→ Updating Supabase Auth…")
    cfg = patch_auth(token, body)
    print("  ✓ SMTP host:", cfg.get("smtp_host"), "· sender:", cfg.get("smtp_admin_email"))
    print("  ✓ 6-digit code template:", "{{ .Token }}" in (cfg.get("mailer_templates_magic_link_content") or ""))
    print("  ✓ CAPTCHA:", cfg.get("security_captcha_enabled"), cfg.get("security_captcha_provider") or "")
    print("\nDone. Test: open https://catchupai-chi.vercel.app/login in a private window.")


if __name__ == "__main__":
    main()

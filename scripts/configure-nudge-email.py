#!/usr/bin/env python3
"""
Turns on the opt-in study emails (morning digest and missed-block alert) in production.

Run it yourself:  python3 scripts/configure-nudge-email.py
Uses a Gmail address with a Google app password (https://myaccount.google.com/apppasswords). The password is
typed with hidden input, checked by logging in to Gmail's SMTP server, then stored as a sensitive Vercel
variable; the site is redeployed. Nothing secret is printed. Students still have to opt in themselves.
"""
import getpass
import re
import smtplib
import ssl
import subprocess
import sys

HOST, PORT = "smtp.gmail.com", 465


def vercel(*args):
    return subprocess.run(["vercel", *args], capture_output=True, text=True)


def latest_production_url():
    out = vercel("ls", "catchupai")
    for line in (out.stdout + out.stderr).splitlines():
        if "Production" in line and "Ready" in line:
            return next(p for p in line.split() if p.startswith("https://"))
    sys.exit("Couldn't find a ready production deployment to redeploy.")


def main():
    print("CatchUp AI · study emails over Gmail SMTP\n")
    user = input("Gmail address to send from [krishnamathur008@gmail.com]: ").strip() or "krishnamathur008@gmail.com"
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", user):
        sys.exit("That doesn't look like an email address.")
    password = getpass.getpass("Google app password, 16 letters (hidden): ").replace(" ", "").strip()
    if not re.fullmatch(r"[a-zA-Z]{16}", password):
        sys.exit("An app password is 16 letters. Create one at https://myaccount.google.com/apppasswords")
    try:
        with smtplib.SMTP_SSL(HOST, PORT, context=ssl.create_default_context(), timeout=30) as smtp:
            smtp.login(user, password)
        print("  ✓ Gmail accepted the login")
    except smtplib.SMTPAuthenticationError:
        sys.exit("Gmail rejected the login. Check the address and create a fresh app password.")

    print("→ Saving to Vercel and redeploying (about 1 minute)…")
    values = [("SMTP_HOST", HOST, ["--type", "config"]), ("SMTP_PORT", str(PORT), ["--type", "config"]),
              ("SMTP_USER", user, ["--type", "config"]), ("SMTP_FROM", user, ["--type", "config"]),
              ("SMTP_PASS", password, ["--sensitive"])]
    for name, value, extra in values:
        vercel("env", "rm", name, "production", "--yes")
        if vercel("env", "add", name, "production", "--value", value, "--yes", *extra).returncode != 0:
            sys.exit(f"Vercel didn't accept {name}.")
    if vercel("redeploy", latest_production_url(), "--target", "production").returncode != 0:
        sys.exit("Redeploy failed; run it again or redeploy from the Vercel dashboard.")
    print("  ✓ study emails enabled. Students turn them on in Preferences → Study emails.")
    print("\nDone.")


if __name__ == "__main__":
    main()

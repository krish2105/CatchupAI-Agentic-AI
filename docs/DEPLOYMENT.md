# Deploying CatchUp AI (Supabase cloud + Vercel)

Everything below uses free tiers. Steps marked **(you)** need your accounts; nothing in this repository creates paid resources.

## 0. Before you start
- Node ≥ 20.9, the Supabase CLI, a Vercel account, an OpenAI API project, a Resend account, a Cloudflare account.
- Locally: `npm run typecheck && npm run lint && npm test && npm run test:integration && npm run test:e2e && npm run eval` all green.

## 1. Supabase project (you)
1. Create a project at supabase.com (pick the region closest to your users). Note the **Project URL**, the **publishable key** and the **secret key** (Project Settings → API keys).
2. Link and push the schema from this repo:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This applies `supabase/migrations/*` (tables, RLS, grants, private `course-documents` bucket, search and approval functions).
3. **Authentication → URL configuration**: Site URL `https://<your-app>.vercel.app`; add redirect URL `https://<your-app>.vercel.app/auth/confirm`.
4. **Authentication → Sign In / Providers**: Email enabled (confirm email can stay on), **Allow anonymous sign-ins: on** (one-click demo).
5. **Authentication → Emails → SMTP settings** (required — Supabase's built-in sender only delivers to project team members): enable custom SMTP with Resend:
   host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender = an address on a domain you verified in Resend.
6. **Authentication → Emails → Templates**: paste `supabase/templates/magic_link.html` into both *Magic link* and *Confirm signup* (it shows the 6-digit `{{ .Token }}` and the `/auth/confirm` link).
7. **Authentication → Attack protection**: enable CAPTCHA → Cloudflare Turnstile → paste the Turnstile **secret** key.

## 2. Cloudflare Turnstile (you)
Create a Turnstile widget for your Vercel domain. The **site key** goes to Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`), the **secret** to Supabase (step 1.7). The app then sends a token with email sign-in and the demo button.

## 3. OpenAI (you)
Create an API key, pick a function-calling model available to your project, and set a **monthly usage limit**. The app also rate-limits each student (30 copilot runs/day, see `src/lib/http/rate-limit.ts`).

## 4. Vercel (you)
1. Import `github.com/krish2105/CatchupAI-Agentic-AI` (framework: Next.js, root: repository root).
2. Environment variables (Production):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SECRET_KEY` | secret key (server only) |
   | `OPENAI_API_KEY` / `OPENAI_MODEL` | from step 3 |
   | `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-app>.vercel.app` |
   | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from step 2 |
   | `CRON_SECRET` | a random string of 32+ characters |

   Never set `CATCHUP_TEST_MODEL` in any deployed environment (the app also refuses it unless Supabase is local).
3. Deploy. `vercel.json` registers a daily cron (`/api/cron/cleanup-demo`, 03:00 UTC) that deletes anonymous demo accounts older than 24 hours; Vercel sends `Authorization: Bearer $CRON_SECRET` automatically.
4. Optional locally: copy the production values into a scratch env file and run `npm run preflight -- --production` to check completeness and reachability.

## 5. Smoke test the live URL (fresh browser session)
1. `/api/health` returns `{"status":"ok"}`; response headers include `x-frame-options: DENY`.
2. Landing → **Try the demo** → dashboard shows the demo banner and seeded data; Knowledge vault shows `1/1 indexed`.
3. Sign in with a real email: the 6-digit code arrives (custom SMTP), onboarding saves your week.
4. Upload a PDF → indexed → evidence search cites a page.
5. Copilot: ask about a course → live tool timeline, page citations, a draft → Review in lab → approve once → Study schedule shows the blocks after a reload.
6. Second browser profile with another account cannot open the first account's course URL (404).
7. Mobile (390 px): navigation drawer, Mission Control and the week schedule are usable; theme persists.
8. Run `npm run eval` locally with the production OpenAI key/model to record the 5 tool-selection cases, and commit `evals/REPORT.md`.

## Rollback
Vercel → Deployments → promote the previous deployment. Database migrations are additive; restore from Supabase's daily backups if a data issue occurs.

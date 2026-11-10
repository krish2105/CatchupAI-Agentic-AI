# Data processing addendum (template for schools)

_Plain-language template, 5 November 2026. Not reviewed by a lawyer. It describes only what CatchUp AI actually does
today; a school should have its own counsel review it before signing. Fill in the bracketed parts._

**Parties.** [School name] ("the school", controller) and the operator of CatchUp AI, Krishna Mathur ("the operator",
processor), for the school's organisation on CatchUp AI.

## 1. What is processed and why
- **Members:** each student's or teacher's account (email, display name, time zone, study preferences) and their own
  study data (courses, deadlines, uploaded notes, approved plans, practice attempts, focus sessions, reflections).
- **Organisation data:** name, join code, memberships and roles, whether each student shares class totals, invites
  (a hash of the invited email and a masked hint only), the audit log, the plan and seat limit.
- **Purpose:** helping students recover from missed classes and giving staff class-level totals. Nothing else.

## 2. What staff can and can't see
- Staff see the roster (names, roles, whether a student shares totals) and class totals over the last 7 days, shown
  only when at least 3 students choose to share. They never see a student's notes, answers, plans or individual numbers.
- Admins see the audit log and invites. Billing ids are visible to the server only.

## 3. Sub-processors
| Service | What for | Where |
| --- | --- | --- |
| Supabase | Database, sign-in, file storage | Seoul, South Korea |
| Vercel | Hosting | Seoul, South Korea |
| OpenAI API | AI answers, search embeddings and reading scanned PDFs (responses not stored; API data not used for training by default) | OpenAI infrastructure |
| Gmail SMTP | Sign-in codes, opt-in reminders, invites | Google |
| Cloudflare Turnstile | Bot check | Cloudflare |
| Stripe | Payments for paid organisation plans (admin's email, card details stay with Stripe) | Stripe |

Data leaves the UAE and the EU when these services are used.

## 4. Security measures in place
Row-level security on every table, server-checked roles for every organisation action, signed and replay-protected
payment webhooks, a strict content security policy, redacted error tracking, an AI kill switch and daily budget.
See SECURITY_AUDIT.md and THREAT_MODEL.md in the repository.

## 5. Students' rights
Each student can export all their data (JSON) or delete their account in Preferences at any time, and can stop sharing
class totals or leave the organisation. Deleting an organisation never deletes students' own study data.

## 6. Retention and deletion
- Account data: until the student deletes the account. Demo accounts: 24 hours.
- Organisation data: until an admin deletes the organisation.
- Backups: [retention per the Supabase plan, to be confirmed by the operator before signing].

## 7. Incidents
The operator will tell the school's contact [email] without undue delay after becoming aware of a personal-data
breach affecting the school's members, with what is known, and follow reviews/INCIDENT_RESPONSE_RUNBOOK.md.

## 8. End of the agreement
On request the operator deletes the organisation; students keep their own accounts unless they delete them.

Signed: ______________________ (school) ______________________ (operator) Date: __________

# Security

Menetekel RentTrack holds tenants' names, phone numbers and ID numbers, and it can ask tenants
for money. Treat it accordingly.

## What protects it

| Layer | What it does | Where |
|---|---|---|
| Database rules (row level security) | A signed-in stranger can read nothing. Only owner-approved accounts can read or write records. Nobody can approve themselves. | `supabase-setup.sql`, `supabase-payments.sql` |
| Append-only ledger | Payments cannot be edited or deleted, only reversed, so every change leaves a trail. | `supabase-payments.sql` |
| Server-side checks | M-Pesa routes verify the caller is an approved account, validate every field, and refuse a second prompt to the same unit within a minute. | `app/api/mpesa/*` |
| Prompt limit | One account may send at most 40 M-Pesa prompts an hour. | `lib/server/limits.ts` |
| Callback checks | Safaricom's callback must carry a secret, is compared in constant time, can only record a payment once, and can optionally be limited to Safaricom's addresses (`MPESA_CALLBACK_ALLOWED_IPS`). | `app/api/mpesa/callback` |
| Browser protections | A content security policy, HSTS, anti-framing, no-sniffing and a strict referrer policy on every page; API responses are never cached. | `lib/securityHeaders.ts` |
| Secrets | `.env*` is never committed, the service-role key exists only on the server. | `.gitignore`, Vercel settings |

## Owner checklist (cannot be done in code)

Do these in each dashboard. Menu names change over time, so look for the closest match.

**Supabase**
- [ ] Turn off **Allow new users to sign up**, then add team members by invitation. Today anyone can create an unapproved account.
- [ ] Set a long minimum password (12+ characters) and turn on leaked-password protection if offered.
- [ ] Turn on two-factor authentication for your own Supabase account.
- [ ] Keep the **service-role key** only in Vercel's environment variables. Never paste it anywhere else.
- [ ] Check what backups your plan includes. If there are none, export a backup from Settings every week.

**Vercel**
- [ ] Turn on two-factor authentication.
- [ ] Firewall: add a rate-limit rule for `/api/mpesa/stk` (for example 10 per minute) and keep the platform protection on.
- [ ] Mark every secret environment variable as sensitive. Keep `AUTH_DISABLED` unset.
- [ ] Protect preview deployments (Deployment Protection), because previews use the real database.

**GitHub**
- [ ] Turn on two-factor authentication.
- [ ] Turn on Dependabot alerts and secret scanning (Settings, Code security).
- [ ] Protect `main` so changes need a pull request.
- [ ] Consider making the repository private.

**Safaricom Daraja**
- [ ] Restrict the callback to Safaricom's published addresses by setting `MPESA_CALLBACK_ALLOWED_IPS`.
- [ ] Use a long random `MPESA_CALLBACK_SECRET` and change it if it is ever exposed.

**People and devices**
- [ ] Approve only people who need access. Revoke members who leave (Settings, Team).
- [ ] Sign out on shared computers.
- [ ] Keep `signing.keystore` and its password out of the project folder and out of chat.

## If something looks wrong

1. Revoke the suspicious member in Settings, Team, and sign out everywhere.
2. In Supabase, rotate the service-role key and the JWT secret, then update the values in Vercel and redeploy.
3. Change `MPESA_CALLBACK_SECRET` and the Daraja consumer secret.
4. Review the Activity page and the Safaricom statement for payments you do not recognise. Reverse wrong ones rather than deleting.
5. Restore from a backup if records were altered.

## Known limits

- The content security policy still allows inline scripts, because Next.js writes small ones into each page. A nonce-based policy would close that gap and needs a middleware step.
- An approved account is trusted. It can record payments and prompt tenants, so approve carefully.
- Remaining advisories in the dependency list are in build-time tools or in code paths the app does not use. Run `npm audit` after each upgrade.

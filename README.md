# Menetekel Apartments — RentTrack

Rent collection app for Menetekel Apartments, Nairobi.
5 floors · 34 units · Unit 6+7 merged on Floor 0 · KShs 198,900/month target.

## Pages

| Route | Purpose |
|---|---|
| `/` | Property overview and floor browser |
| `/collect` | Monthly data entry — floor tabs, live balances, autosave |
| `/reports` | KPIs, floor breakdown, 12-month trend, Excel + PDF downloads |
| `/settings` | Property details and rent schedule reference |

## Data

- Entries autosave to browser localStorage, keyed per month (`menetekel:2026:<month>`).
- The Excel export builds a 12-sheet workbook (one sheet per month) from saved data.
- The PDF export produces a one-page summary for the selected month.
- The rent schedule lives in `lib/config.ts` — edit and redeploy to change rates.

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel (via GitHub)

1. Create an empty GitHub repository (e.g. `menetekel-renttrack`).
2. From this folder:
   ```bash
   git init
   git add .
   git commit -m "Menetekel RentTrack v1"
   git branch -M main
   git remote add origin https://github.com/<your-username>/menetekel-renttrack.git
   git push -u origin main
   ```
3. Go to vercel.com → Add New → Project → Import the repo.
4. Framework preset auto-detects **Next.js**. Leave all defaults. Click **Deploy**.
5. Your app is live at `https://menetekel-renttrack.vercel.app` (or similar).

Every future `git push` to `main` redeploys automatically.

## Deploy with Vercel CLI (no GitHub)

```bash
npm i -g vercel
vercel          # first run: link/create project, accept defaults
vercel --prod   # promote to production
```

## Accounts & cloud sync (v5)

Anyone can create an account (email + password with email verification). All
**approved** accounts share the same building records. The **first account ever
created becomes the owner** and approves/revokes members in Settings → Team.
Without Supabase configured, the app runs in local mode (no login, data stays
in the browser).

### One-time setup (~10 min)

1. Create a free project at supabase.com.
2. SQL Editor → New query → paste the contents of `supabase-setup.sql` → Run.
3. Authentication → URL Configuration → set **Site URL** to your Vercel URL.
4. Project Settings → API → copy **Project URL** and **anon public** key.
5. Vercel → your project → Settings → Environment Variables → add:
   - `NEXT_PUBLIC_SUPABASE_URL` = the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon key
6. Redeploy (Deployments → ⋯ → Redeploy), open the site, **create your own
   account first** (it becomes owner), confirm via the email link, sign in.
7. Settings → Team → "Upload this device's local records to the cloud" to
   migrate existing data.

## M-Pesa STK Push (v6)

The 📲 button on each unit sends a real M-Pesa payment prompt to the tenant's
phone; on success the payment is written to the shared records automatically
with the M-Pesa receipt number.

### Environment variables (Vercel → Settings → Environment Variables)

| Key | Sandbox value | Production value |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | service_role/secret key from Supabase → Settings → API Keys | same |
| `MPESA_ENV` | `sandbox` | `production` |
| `MPESA_CONSUMER_KEY` | from your Daraja app | from your production Daraja app |
| `MPESA_CONSUMER_SECRET` | from your Daraja app | from your production Daraja app |
| `MPESA_SHORTCODE` | `174379` | your store/Till shortcode |
| `MPESA_PASSKEY` | sandbox Lipa Na M-Pesa passkey (shown on the Daraja test-credentials page) | issued at Go-Live |
| `MPESA_TXN_TYPE` | `CustomerPayBillOnline` | `CustomerBuyGoodsOnline` (Till) |
| `MPESA_PARTYB` | `174379` | your Till number |
| `MPESA_CALLBACK_BASE` | `https://<your-app>.vercel.app` | same |
| `MPESA_CALLBACK_SECRET` | any long random string | same |

### Sandbox test
1. developer.safaricom.co.ke → sign up → My Apps → Add App (tick Lipa Na M-Pesa
   Sandbox) → copy Consumer Key/Secret.
2. Run `supabase-mpesa.sql` in Supabase SQL Editor.
3. Add the env vars above, redeploy.
4. In the app, set a unit's phone to the sandbox test number `254708374149`,
   press 📲 — the sandbox auto-completes and the row records the payment.

### Go live
Get a Business Till (m-pesaforbusiness.co.ke), create a production Daraja app,
complete Daraja "Go Live", then swap the production values above and redeploy.

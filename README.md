# Menetekel RentTrack

Rent collection for Menetekel Apartments, Nairobi: 5 floors, 34 units, Unit 6+7 merged on
Floor 0. The monthly target is added up from the rents in `lib/config.ts`
(currently KSh 194,700), so it can never disagree with what the building charges.

The home screen is the building itself. Each unit is a window that fills with colour as its
rent arrives: green when paid, amber while part-paid, red when owing, hatched when vacant.

## Pages

| Route | Purpose |
|---|---|
| `/` | Introduction page: what RentTrack is and how a month works. Stands on its own, no sign-in |
| `/dashboard` | The building for any month, collection so far, and who still owes (unit panel on the right) |
| `/collect` | Open a month, edit tenants, and take payments per unit (side panel) |
| `/cumulative` | Running totals for the year: charged, collected and outstanding per unit, month by month |
| `/reports` | Monthly KPIs, floor table, 12-month trend, Excel and PDF downloads |
| `/settings` | Team, active year, backup and restore, rent schedule, sample data |

Signed-in pages share a side panel on wide screens and a tab bar on phones.

## Months are independent

Each month stands on its own: what a unit owes for a month is that month's rent and water,
and what it has paid is that month's payments. Nothing is carried in from earlier months, so
reports, exports and the dashboard for a month always agree with each other.

The **Cumulative** page is the one place months are added together (January to the month you
pick): what each unit has been charged and has paid, what is outstanding, and a month-by-month
strip showing where it fell behind. A unit's shortfall in March stays in the running total until
it is paid; it is never silently added to April's rent. The year workbook also carries an
"Outstanding to date" column. Cumulative totals run per calendar year.

## How money is recorded

Every payment is one row in an **append-only ledger** (`payments` table, mirrored in
`localStorage` as `menetekel:payments:<year>`). A unit's paid amount for a month is the sum of
its ledger rows. Mistakes are fixed with a negative *reversal* row, never by editing, so there
is always an audit trail. A unique index on the M-Pesa receipt stops the same payment being
entered twice, and a unique index on `checkout_id` guarantees one ledger row per M-Pesa prompt
however many times Safaricom calls back.

Month records (tenants, phones, water charges, vacancies) are still stored per month. Edits
carry a timestamp per unit and merge unit by unit, so two devices editing different units
never overwrite each other. Amounts typed into month records before the ledger existed are
still counted and shown as "Entered before the ledger".

A month has to be **opened** before it counts (Collect rent, Open month). Viewing a month no
longer creates it, so browsing ahead can't create empty months.

## Upgrading an existing deployment

1. Run `supabase-payments.sql` in the Supabase SQL editor **before** deploying this version.
2. Deploy. No new environment variables are needed.

## Quality

```bash
npm test          # 62 unit tests: ledger, merging, independent months, cumulative totals, M-Pesa parsing, status logic
npm run typecheck
npm run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs all three on every push.

## Run locally

```bash
npm install
npm run dev       # http://localhost:3000
```

Without Supabase variables the app runs in local mode. Settings then offers **Load sample
data** (fictional tenants only) so every screen can be explored.

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

The **Ask for payment on M-Pesa** card in each unit panel sends a real M-Pesa payment prompt to the tenant's
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

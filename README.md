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

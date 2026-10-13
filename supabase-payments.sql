-- ============================================================
-- Menetekel RentTrack — payments ledger (v7)
-- Run ONCE in: Supabase dashboard → SQL Editor → New query.
-- Safe to run twice. Run it BEFORE deploying the matching code.
-- ============================================================

-- 1. The ledger: one append-only row per payment. Mistakes are fixed with a
--    negative "reversal" row, never by editing or deleting.
create table if not exists public.payments (
  id uuid primary key,
  year int not null,
  month int not null check (month between 0 and 11),
  floor int not null,
  unit text not null,
  amount int not null,
  receipt text not null default '',
  source text not null check (source in ('stk', 'csv', 'manual', 'reversal')),
  paid_on text,
  note text,
  reverses uuid references public.payments (id),
  checkout_id text,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- One ledger row per M-Pesa prompt, however many times Safaricom calls back.
create unique index if not exists payments_checkout_uq
  on public.payments (checkout_id) where checkout_id is not null;

-- One ledger row per M-Pesa receipt, so the same payment can't be entered twice.
create unique index if not exists payments_receipt_uq
  on public.payments (receipt) where receipt <> '' and source <> 'reversal';

-- A payment can be reversed only once.
create unique index if not exists payments_reverses_uq
  on public.payments (reverses) where reverses is not null;

create index if not exists payments_month_idx on public.payments (year, month);

alter table public.payments enable row level security;

-- Approved accounts read the whole ledger.
drop policy if exists "approved read payments" on public.payments;
create policy "approved read payments"
  on public.payments for select using (public.is_approved());

-- Approved accounts add rows as themselves. 'stk' rows are written only by the
-- server (service-role key bypasses RLS), so a browser can't forge one.
-- There is deliberately NO update or delete policy: the ledger is append-only.
drop policy if exists "approved insert payments" on public.payments;
create policy "approved insert payments"
  on public.payments for insert
  with check (
    public.is_approved()
    and created_by = auth.uid()
    and source in ('manual', 'csv', 'reversal')
  );

-- 2. Faster, safer STK request tracking.
create index if not exists mpesa_requests_pending_idx
  on public.mpesa_requests (year, month, floor, unit, created_at)
  where status = 'pending';

-- 3. Existing payments typed into month records before the ledger existed are
--    NOT touched. The app keeps counting them, shown as "Entered before the
--    ledger" in each unit panel, so no history changes and nothing is counted twice.

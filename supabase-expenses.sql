-- ============================================================
-- Menetekel RentTrack — building expenses (Reports, Expenses tab)
-- Run ONCE in: Supabase dashboard → SQL Editor → New query.
-- Safe to run twice. Without it, expenses stay on the device that entered them.
-- ============================================================

create table if not exists public.expenses (
  id uuid primary key,
  year int not null check (year between 2000 and 2100),
  month int not null check (month between 0 and 11),
  spent_on text,
  category text not null check (category in ('repairs', 'utilities', 'staff', 'security', 'cleaning', 'supplies', 'other')),
  amount int not null check (amount between -100000000 and 100000000),
  note text check (note is null or length(note) <= 500),
  reverses uuid references public.expenses (id),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- An entry can be reversed only once.
create unique index if not exists expenses_reverses_uq on public.expenses (reverses) where reverses is not null;
create index if not exists expenses_month_idx on public.expenses (year, month);

alter table public.expenses enable row level security;

drop policy if exists "approved read expenses" on public.expenses;
create policy "approved read expenses"
  on public.expenses for select using (public.is_approved());

-- Approved accounts add entries as themselves. There is deliberately no update
-- or delete policy: mistakes are corrected with a reversal entry.
drop policy if exists "approved insert expenses" on public.expenses;
create policy "approved insert expenses"
  on public.expenses for insert
  with check (public.is_approved() and created_by = auth.uid());

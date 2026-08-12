-- ============================================================
-- Menetekel RentTrack — M-Pesa STK Push additions (v6)
-- Run ONCE in: Supabase dashboard → SQL Editor → New query
-- ============================================================

create table if not exists public.mpesa_requests (
  checkout_id text primary key,
  year int not null,
  month int not null,
  floor int not null,
  unit text not null,
  phone text,
  amount int,
  status text not null default 'pending',
  receipt text,
  result_desc text,
  requested_by uuid,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: only the server (service-role key) can touch it.
alter table public.mpesa_requests enable row level security;

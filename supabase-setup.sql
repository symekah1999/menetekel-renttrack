-- ============================================================
-- Menetekel RentTrack — Supabase setup
-- Run this ONCE in: Supabase dashboard → SQL Editor → New query
-- ============================================================

-- 1. Profiles: one row per account. The FIRST account ever created
--    is automatically approved and becomes the owner.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  approved boolean not null default false,
  role text not null default 'member',
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare first_user boolean;
begin
  select count(*) = 0 into first_user from public.profiles;
  insert into public.profiles (id, email, approved, role)
  values (
    new.id,
    new.email,
    first_user,
    case when first_user then 'owner' else 'member' end
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Helper checks used by security policies
create or replace function public.is_approved()
returns boolean language sql security definer set search_path = public
as $$ select coalesce((select approved from public.profiles where id = auth.uid()), false) $$;

create or replace function public.is_owner()
returns boolean language sql security definer set search_path = public
as $$ select coalesce((select role = 'owner' from public.profiles where id = auth.uid()), false) $$;

-- 3. Profile access: you can read your own profile; the owner reads all
--    and can approve/revoke members.
drop policy if exists "read own or owner reads all" on public.profiles;
create policy "read own or owner reads all"
  on public.profiles for select
  using (auth.uid() = id or public.is_owner());

drop policy if exists "owner updates profiles" on public.profiles;
create policy "owner updates profiles"
  on public.profiles for update
  using (public.is_owner())
  with check (public.is_owner());

-- 4. Shared building records: one row per (year, month) holding the
--    full month's entries as JSON. Approved accounts read and write.
create table if not exists public.months (
  year int not null,
  month int not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (year, month)
);
alter table public.months enable row level security;

drop policy if exists "approved read" on public.months;
create policy "approved read"
  on public.months for select using (public.is_approved());

drop policy if exists "approved insert" on public.months;
create policy "approved insert"
  on public.months for insert with check (public.is_approved());

drop policy if exists "approved update" on public.months;
create policy "approved update"
  on public.months for update using (public.is_approved()) with check (public.is_approved());

-- Done. Now create YOUR account first in the app — it becomes the owner.

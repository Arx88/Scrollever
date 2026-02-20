-- 004_create_superlikes.sql

create table if not exists public.superlikes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint superlikes_user_image_unique unique (user_id, image_id)
);

create unique index if not exists superlikes_user_utc_day_unique_idx
  on public.superlikes (user_id, (date_trunc('day', created_at at time zone 'UTC')));

alter table public.superlikes enable row level security;

create policy if not exists "superlikes_select_public"
  on public.superlikes
  for select
  using (true);

create policy if not exists "superlikes_insert_own"
  on public.superlikes
  for insert
  to authenticated
  with check (user_id = auth.uid());

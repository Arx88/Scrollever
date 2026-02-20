-- 002_create_images.sql

create table if not exists public.images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  url text not null,
  title text null,
  prompt text null,
  category text not null default 'all',
  width integer null,
  height integer null,
  like_count integer not null default 0,
  superlike_count integer not null default 0,
  is_immortal boolean not null default false,
  is_hall_of_fame boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  deleted_at timestamptz null
);

alter table public.images enable row level security;

create policy if not exists "images_select_public"
  on public.images
  for select
  using (deleted_at is null);

create policy if not exists "images_insert_own"
  on public.images
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy if not exists "images_update_own"
  on public.images
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy if not exists "images_delete_own"
  on public.images
  for delete
  to authenticated
  using (user_id = auth.uid());

-- 003_create_likes.sql

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint likes_user_image_unique unique (user_id, image_id)
);

alter table public.likes enable row level security;

drop policy if exists "likes_select_public" on public.likes;

create policy "likes_select_public"
  on public.likes
  for select
  using (true);

drop policy if exists "likes_insert_own" on public.likes;

create policy "likes_insert_own"
  on public.likes
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "likes_delete_own" on public.likes;

create policy "likes_delete_own"
  on public.likes
  for delete
  to authenticated
  using (user_id = auth.uid());

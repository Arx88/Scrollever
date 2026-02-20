-- SOURCE: supabase\migrations\001_create_profiles.sql
-- 001_create_profiles.sql

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text null,
  avatar_url text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (username)
  where username is not null;

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;

create policy "profiles_select_public"
  on public.profiles
  for select
  using (true);

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id)
  do update set
    username = coalesce(excluded.username, public.profiles.username),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();


-- SOURCE: supabase\migrations\002_create_images.sql
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

drop policy if exists "images_select_public" on public.images;

create policy "images_select_public"
  on public.images
  for select
  using (deleted_at is null);

drop policy if exists "images_insert_own" on public.images;

create policy "images_insert_own"
  on public.images
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "images_update_own" on public.images;

create policy "images_update_own"
  on public.images
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "images_delete_own" on public.images;

create policy "images_delete_own"
  on public.images
  for delete
  to authenticated
  using (user_id = auth.uid());


-- SOURCE: supabase\migrations\003_create_likes.sql
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


-- SOURCE: supabase\migrations\004_create_superlikes.sql
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

drop policy if exists "superlikes_select_public" on public.superlikes;

create policy "superlikes_select_public"
  on public.superlikes
  for select
  using (true);

drop policy if exists "superlikes_insert_own" on public.superlikes;

create policy "superlikes_insert_own"
  on public.superlikes
  for insert
  to authenticated
  with check (user_id = auth.uid());


-- SOURCE: supabase\migrations\005_indexes.sql
-- 005_indexes.sql

create index if not exists images_created_at_desc_idx
  on public.images (created_at desc);

create index if not exists images_category_created_at_desc_idx
  on public.images (category, created_at desc);

create index if not exists images_hall_of_fame_rank_idx
  on public.images (is_hall_of_fame, superlike_count desc, like_count desc, created_at desc);

create index if not exists images_immortal_created_at_desc_idx
  on public.images (is_immortal, created_at desc);

create index if not exists likes_image_id_idx
  on public.likes (image_id);

create index if not exists superlikes_image_id_idx
  on public.superlikes (image_id);

create index if not exists likes_user_created_at_desc_idx
  on public.likes (user_id, created_at desc);

create index if not exists superlikes_user_created_at_desc_idx
  on public.superlikes (user_id, created_at desc);


-- SOURCE: supabase\migrations\006_updated_at_triggers.sql
-- 006_updated_at_triggers.sql

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_images_updated_at on public.images;
create trigger set_images_updated_at
before update on public.images
for each row
execute function public.set_updated_at();

create or replace function public.bump_like_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.images
    set like_count = like_count + 1,
        updated_at = now()
    where id = new.image_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.images
    set like_count = greatest(like_count - 1, 0),
        updated_at = now()
    where id = old.image_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists likes_counter_trigger on public.likes;
create trigger likes_counter_trigger
after insert or delete on public.likes
for each row
execute function public.bump_like_count();

create or replace function public.bump_superlike_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.images
    set superlike_count = superlike_count + 1,
        updated_at = now()
    where id = new.image_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.images
    set superlike_count = greatest(superlike_count - 1, 0),
        updated_at = now()
    where id = old.image_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists superlikes_counter_trigger on public.superlikes;
create trigger superlikes_counter_trigger
after insert or delete on public.superlikes
for each row
execute function public.bump_superlike_count();


-- SOURCE: supabase\migrations\007_seed_images.sql
-- 007_seed_images.sql
-- Seeds only when at least one profile exists.

with owner as (
  select id
  from public.profiles
  order by created_at asc
  limit 1
),
seed_rows as (
  select
    'Portrait neon editorial'::text as title,
    'High contrast editorial portrait, cinematic neon rim light, fashion magazine style'::text as prompt,
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=900&q=80'::text as url,
    'Editorial'::text as category,
    900::int as width,
    1200::int as height,
    240::int as like_count,
    18::int as superlike_count,
    false::boolean as is_immortal,
    false::boolean as is_hall_of_fame,
    now() - interval '2 hours' as created_at,
    now() + interval '22 hours' as expires_at
  union all
  select
    'Street style motion blur',
    'Urban fashion shot, dynamic motion blur, rainy pavement reflections',
    'https://images.unsplash.com/photo-1464863979621-258859e62245?auto=format&fit=crop&w=900&q=80',
    'Streetstyle',
    900,
    1200,
    512,
    34,
    true,
    true,
    now() - interval '3 days',
    now() - interval '2 days'
  union all
  select
    'Minimal product composition',
    'Clean product still life, soft shadows, matte textures, studio look',
    'https://images.unsplash.com/photo-1513116476489-7635e79feb27?auto=format&fit=crop&w=1200&q=80',
    'Productos',
    1200,
    800,
    98,
    6,
    false,
    false,
    now() - interval '6 hours',
    now() + interval '18 hours'
)
insert into public.images (
  user_id,
  title,
  prompt,
  url,
  category,
  width,
  height,
  like_count,
  superlike_count,
  is_immortal,
  is_hall_of_fame,
  created_at,
  expires_at
)
select
  owner.id,
  seed_rows.title,
  seed_rows.prompt,
  seed_rows.url,
  seed_rows.category,
  seed_rows.width,
  seed_rows.height,
  seed_rows.like_count,
  seed_rows.superlike_count,
  seed_rows.is_immortal,
  seed_rows.is_hall_of_fame,
  seed_rows.created_at,
  seed_rows.expires_at
from owner
cross join seed_rows
where not exists (
  select 1
  from public.images existing
  where existing.user_id = owner.id
    and existing.title = seed_rows.title
);


-- SOURCE: supabase\migrations\008_admin_foundation.sql
-- 008_admin_foundation.sql
-- Admin foundation: roles, settings, feature flags, audit logs and moderation actions.

alter table public.profiles
  add column if not exists role text not null default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('user', 'moderator', 'admin', 'owner'));
  end if;
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner')
  );
$$;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('moderator', 'admin', 'owner')
  );
$$;

create table if not exists public.app_settings (
  key text primary key,
  value_json jsonb not null,
  value_type text not null check (value_type in ('number', 'boolean', 'string', 'json', 'string_array')),
  category text not null,
  description text null,
  is_public boolean not null default false,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  rollout integer not null default 100 check (rollout >= 0 and rollout <= 100),
  description text null,
  is_public boolean not null default false,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  resource_type text not null,
  resource_id text null,
  payload jsonb not null default '{}'::jsonb,
  ip text null,
  user_agent text null,
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  target_image_id uuid null references public.images(id) on delete cascade,
  target_user_id uuid null references public.profiles(id) on delete cascade,
  action text not null,
  reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint moderation_actions_target_required check (
    target_image_id is not null or target_user_id is not null
  )
);

create index if not exists app_settings_category_idx
  on public.app_settings (category);

create index if not exists app_settings_updated_at_desc_idx
  on public.app_settings (updated_at desc);

create index if not exists feature_flags_updated_at_desc_idx
  on public.feature_flags (updated_at desc);

create index if not exists admin_audit_logs_created_at_desc_idx
  on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_actor_created_at_desc_idx
  on public.admin_audit_logs (actor_id, created_at desc);

create index if not exists moderation_actions_created_at_desc_idx
  on public.moderation_actions (created_at desc);

create index if not exists moderation_actions_target_image_idx
  on public.moderation_actions (target_image_id);

create index if not exists moderation_actions_target_user_idx
  on public.moderation_actions (target_user_id);

alter table public.app_settings enable row level security;
alter table public.feature_flags enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.moderation_actions enable row level security;

drop policy if exists "app_settings_admin_select" on public.app_settings;

create policy "app_settings_admin_select"
  on public.app_settings
  for select
  using (public.is_admin());

drop policy if exists "app_settings_admin_insert" on public.app_settings;

create policy "app_settings_admin_insert"
  on public.app_settings
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "app_settings_admin_update" on public.app_settings;

create policy "app_settings_admin_update"
  on public.app_settings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "app_settings_admin_delete" on public.app_settings;

create policy "app_settings_admin_delete"
  on public.app_settings
  for delete
  to authenticated
  using (public.is_admin());

drop policy if exists "feature_flags_moderator_select" on public.feature_flags;

create policy "feature_flags_moderator_select"
  on public.feature_flags
  for select
  using (public.is_moderator());

drop policy if exists "feature_flags_admin_mutation" on public.feature_flags;

create policy "feature_flags_admin_mutation"
  on public.feature_flags
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_audit_logs_moderator_select" on public.admin_audit_logs;

create policy "admin_audit_logs_moderator_select"
  on public.admin_audit_logs
  for select
  using (public.is_moderator());

drop policy if exists "admin_audit_logs_moderator_insert" on public.admin_audit_logs;

create policy "admin_audit_logs_moderator_insert"
  on public.admin_audit_logs
  for insert
  to authenticated
  with check (public.is_moderator() and auth.uid() = actor_id);

drop policy if exists "moderation_actions_moderator_select" on public.moderation_actions;

create policy "moderation_actions_moderator_select"
  on public.moderation_actions
  for select
  using (public.is_moderator());

drop policy if exists "moderation_actions_moderator_insert" on public.moderation_actions;

create policy "moderation_actions_moderator_insert"
  on public.moderation_actions
  for insert
  to authenticated
  with check (public.is_moderator() and auth.uid() = actor_id);

drop policy if exists "moderation_actions_admin_update" on public.moderation_actions;

create policy "moderation_actions_admin_update"
  on public.moderation_actions
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "moderation_actions_admin_delete" on public.moderation_actions;

create policy "moderation_actions_admin_delete"
  on public.moderation_actions
  for delete
  to authenticated
  using (public.is_admin());

drop trigger if exists set_app_settings_updated_at on public.app_settings;
create trigger set_app_settings_updated_at
before update on public.app_settings
for each row
execute function public.set_updated_at();

drop trigger if exists set_feature_flags_updated_at on public.feature_flags;
create trigger set_feature_flags_updated_at
before update on public.feature_flags
for each row
execute function public.set_updated_at();

insert into public.app_settings (key, value_json, value_type, category, description, is_public)
values
  ('superlike.daily_limit', '1'::jsonb, 'number', 'superlike', 'Cantidad de superlikes por usuario por dia UTC.', false),
  ('superlike.reset_timezone', '"UTC"'::jsonb, 'string', 'superlike', 'Zona horaria de reinicio para superlikes.', false),
  ('feed.limit_default', '20'::jsonb, 'number', 'feed', 'Cantidad de items iniciales por request.', true),
  ('feed.limit_max', '50'::jsonb, 'number', 'feed', 'Maximo de items permitidos por request.', false),
  ('feed.cache_ttl_ms', '30000'::jsonb, 'number', 'feed', 'TTL del cache de feed en cliente (ms).', false),
  ('feed.fallback_enabled', 'true'::jsonb, 'boolean', 'feed', 'Habilita fallback visual cuando Supabase falla.', false),
  ('survival.likes_needed_default', '5000'::jsonb, 'number', 'survival', 'Likes requeridos por defecto para sobrevivir.', false),
  ('survival.window_hours', '24'::jsonb, 'number', 'survival', 'Duracion de la ventana de supervivencia en horas.', false),
  ('hof.min_superlikes', '50'::jsonb, 'number', 'hall_of_fame', 'Minimo de superlikes sugerido para Hall of Fame.', false),
  ('hof.rank_weights', '{"superlikes":1,"likes":0.25,"recency":0.1}'::jsonb, 'json', 'hall_of_fame', 'Pesos de ranking para Hall of Fame.', false),
  ('auth.signup_enabled', 'true'::jsonb, 'boolean', 'auth', 'Habilita o bloquea nuevos registros.', false),
  ('auth.email_confirmation_required', 'true'::jsonb, 'boolean', 'auth', 'Indica si se requiere confirmacion de email.', false),
  ('auth.password_min_length', '6'::jsonb, 'number', 'auth', 'Longitud minima de password.', false),
  ('auth.blocked_email_domains', '[]'::jsonb, 'string_array', 'auth', 'Dominios de correo bloqueados para registro.', false),
  ('moderation.blocked_words', '[]'::jsonb, 'string_array', 'moderation', 'Palabras bloqueadas para titulo/prompt.', false),
  ('moderation.allowed_image_domains', '[]'::jsonb, 'string_array', 'moderation', 'Lista blanca opcional de dominios para URLs de imagen.', false),
  ('login.hero.source', '"immortal"'::jsonb, 'string', 'ui', 'Fuente del hero de login: immortal | hall_of_fame | manual.', true),
  ('login.hero.rotation_seconds', '5'::jsonb, 'number', 'ui', 'Tiempo de rotacion del hero en login (segundos).', true),
  ('logging.level', '"info"'::jsonb, 'string', 'ops', 'Nivel de logging backend.', false)
on conflict (key) do nothing;

insert into public.feature_flags (key, enabled, rollout, description, is_public)
values
  ('admin.panel_enabled', true, 100, 'Habilita el panel administrativo.', false),
  ('feed.experimental_ranking', false, 0, 'Habilita ranking experimental en feed.', false),
  ('moderation.strict_mode', false, 0, 'Activa reglas estrictas de moderacion.', false),
  ('ui.dynamic_login_hero', true, 100, 'Permite que login hero use imagenes dinamicas.', true)
on conflict (key) do nothing;


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

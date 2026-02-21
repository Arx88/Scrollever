-- 20260220220506_ai_creator_boards_foundation.sql
-- Foundation for AI generation (global providers/models), daily free quota,
-- credits ledger, and Pinterest-like boards (public/private/collaborative).

alter table public.images
  add column if not exists origin_type text not null default 'upload';

alter table public.images
  add column if not exists generation_provider text null;

alter table public.images
  add column if not exists generation_model text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'images_origin_type_check'
  ) then
    alter table public.images
      add constraint images_origin_type_check
      check (origin_type in ('upload', 'generated'));
  end if;
end;
$$;

create table if not exists public.ai_providers (
  provider_key text primary key,
  display_name text not null,
  api_base_url text null,
  api_key text null,
  is_enabled boolean not null default false,
  default_model_key text null,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null references public.ai_providers(provider_key) on delete cascade,
  model_key text not null unique,
  display_name text not null,
  description text null,
  supports_image_to_image boolean not null default false,
  supports_inpainting boolean not null default false,
  supports_controlnet boolean not null default false,
  max_resolution integer not null default 2048,
  is_enabled boolean not null default true,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_key text null references public.ai_providers(provider_key) on delete set null,
  model_key text null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  prompt text not null,
  negative_prompt text null,
  aspect_ratio text not null default '9:16',
  steps integer null,
  guidance numeric(8, 4) null,
  seed bigint null,
  input_image_url text null,
  result_image_id uuid null references public.images(id) on delete set null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  cost_credits numeric(10, 2) not null default 0,
  started_at timestamptz null,
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(12, 2) not null default 0,
  free_daily_limit integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta numeric(10, 2) not null,
  kind text not null check (kind in ('daily_grant', 'generation_charge', 'manual_adjustment', 'plan_purchase', 'refund')),
  reference text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_generation_daily_usage (
  user_id uuid not null references public.profiles(id) on delete cascade,
  usage_date date not null,
  images_generated integer not null default 0 check (images_generated >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text null,
  visibility text not null default 'private' check (visibility in ('private', 'public', 'collab')),
  cover_image_id uuid null references public.images(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('viewer', 'editor', 'admin')),
  created_at timestamptz not null default now(),
  unique (board_id, user_id)
);

create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  image_id uuid not null references public.images(id) on delete cascade,
  added_by uuid null references public.profiles(id) on delete set null,
  note text null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (board_id, image_id)
);

create index if not exists ai_models_provider_sort_idx
  on public.ai_models (provider_key, sort_order asc, display_name asc);

create index if not exists ai_models_public_enabled_idx
  on public.ai_models (is_public, is_enabled, sort_order asc);

create index if not exists generation_jobs_user_created_at_desc_idx
  on public.generation_jobs (user_id, created_at desc);

create index if not exists generation_jobs_status_created_at_desc_idx
  on public.generation_jobs (status, created_at desc);

create index if not exists credit_ledger_user_created_at_desc_idx
  on public.credit_ledger (user_id, created_at desc);

create index if not exists boards_owner_created_at_desc_idx
  on public.boards (owner_id, created_at desc);

create index if not exists boards_visibility_created_at_desc_idx
  on public.boards (visibility, created_at desc);

create index if not exists board_members_user_idx
  on public.board_members (user_id, board_id);

create index if not exists board_items_board_sort_idx
  on public.board_items (board_id, sort_order asc, created_at desc);

create index if not exists board_items_image_idx
  on public.board_items (image_id);

create or replace function public.user_can_view_board(board_uuid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = board_uuid
      and (
        b.visibility = 'public'
        or b.owner_id = uid
        or exists (
          select 1
          from public.board_members bm
          where bm.board_id = b.id
            and bm.user_id = uid
        )
      )
  );
$$;

create or replace function public.user_can_edit_board(board_uuid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = board_uuid
      and (
        b.owner_id = uid
        or exists (
          select 1
          from public.board_members bm
          where bm.board_id = b.id
            and bm.user_id = uid
            and bm.role in ('editor', 'admin')
        )
      )
  );
$$;

create or replace function public.user_can_admin_board(board_uuid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.boards b
    where b.id = board_uuid
      and (
        b.owner_id = uid
        or exists (
          select 1
          from public.board_members bm
          where bm.board_id = b.id
            and bm.user_id = uid
            and bm.role = 'admin'
        )
      )
  );
$$;

alter table public.ai_providers enable row level security;
alter table public.ai_models enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.credit_wallets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.user_generation_daily_usage enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_items enable row level security;

drop policy if exists "ai_providers_moderator_select" on public.ai_providers;
create policy "ai_providers_moderator_select"
  on public.ai_providers
  for select
  using (public.is_moderator());

drop policy if exists "ai_providers_admin_mutation" on public.ai_providers;
create policy "ai_providers_admin_mutation"
  on public.ai_providers
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "ai_models_public_or_moderator_select" on public.ai_models;
create policy "ai_models_public_or_moderator_select"
  on public.ai_models
  for select
  using ((is_public and is_enabled) or public.is_moderator());

drop policy if exists "ai_models_admin_mutation" on public.ai_models;
create policy "ai_models_admin_mutation"
  on public.ai_models
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "generation_jobs_select_own_or_moderator" on public.generation_jobs;
create policy "generation_jobs_select_own_or_moderator"
  on public.generation_jobs
  for select
  using (auth.uid() = user_id or public.is_moderator());

drop policy if exists "generation_jobs_insert_own" on public.generation_jobs;
create policy "generation_jobs_insert_own"
  on public.generation_jobs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "generation_jobs_update_own_or_admin" on public.generation_jobs;
create policy "generation_jobs_update_own_or_admin"
  on public.generation_jobs
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "credit_wallets_select_own_or_admin" on public.credit_wallets;
create policy "credit_wallets_select_own_or_admin"
  on public.credit_wallets
  for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "credit_wallets_insert_own_or_admin" on public.credit_wallets;
create policy "credit_wallets_insert_own_or_admin"
  on public.credit_wallets
  for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "credit_wallets_update_own_or_admin" on public.credit_wallets;
create policy "credit_wallets_update_own_or_admin"
  on public.credit_wallets
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "credit_ledger_select_own_or_moderator" on public.credit_ledger;
create policy "credit_ledger_select_own_or_moderator"
  on public.credit_ledger
  for select
  using (auth.uid() = user_id or public.is_moderator());

drop policy if exists "credit_ledger_insert_own_or_admin" on public.credit_ledger;
create policy "credit_ledger_insert_own_or_admin"
  on public.credit_ledger
  for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "daily_usage_select_own_or_admin" on public.user_generation_daily_usage;
create policy "daily_usage_select_own_or_admin"
  on public.user_generation_daily_usage
  for select
  using (auth.uid() = user_id or public.is_admin());

drop policy if exists "daily_usage_insert_own_or_admin" on public.user_generation_daily_usage;
create policy "daily_usage_insert_own_or_admin"
  on public.user_generation_daily_usage
  for insert
  to authenticated
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "daily_usage_update_own_or_admin" on public.user_generation_daily_usage;
create policy "daily_usage_update_own_or_admin"
  on public.user_generation_daily_usage
  for update
  to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists "boards_select_visible" on public.boards;
create policy "boards_select_visible"
  on public.boards
  for select
  using (public.user_can_view_board(id, auth.uid()));

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own"
  on public.boards
  for insert
  to authenticated
  with check (owner_id = auth.uid());

drop policy if exists "boards_update_editors" on public.boards;
create policy "boards_update_editors"
  on public.boards
  for update
  to authenticated
  using (public.user_can_edit_board(id, auth.uid()))
  with check (public.user_can_edit_board(id, auth.uid()));

drop policy if exists "boards_delete_admins" on public.boards;
create policy "boards_delete_admins"
  on public.boards
  for delete
  to authenticated
  using (public.user_can_admin_board(id, auth.uid()));

drop policy if exists "board_members_select_visible" on public.board_members;
create policy "board_members_select_visible"
  on public.board_members
  for select
  using (public.user_can_view_board(board_id, auth.uid()));

drop policy if exists "board_members_admin_mutation" on public.board_members;
create policy "board_members_admin_mutation"
  on public.board_members
  for all
  to authenticated
  using (public.user_can_admin_board(board_id, auth.uid()))
  with check (public.user_can_admin_board(board_id, auth.uid()));

drop policy if exists "board_items_select_visible" on public.board_items;
create policy "board_items_select_visible"
  on public.board_items
  for select
  using (public.user_can_view_board(board_id, auth.uid()));

drop policy if exists "board_items_edit_mutation" on public.board_items;
create policy "board_items_edit_mutation"
  on public.board_items
  for all
  to authenticated
  using (public.user_can_edit_board(board_id, auth.uid()))
  with check (public.user_can_edit_board(board_id, auth.uid()));

drop trigger if exists set_ai_providers_updated_at on public.ai_providers;
create trigger set_ai_providers_updated_at
before update on public.ai_providers
for each row
execute function public.set_updated_at();

drop trigger if exists set_ai_models_updated_at on public.ai_models;
create trigger set_ai_models_updated_at
before update on public.ai_models
for each row
execute function public.set_updated_at();

drop trigger if exists set_generation_jobs_updated_at on public.generation_jobs;
create trigger set_generation_jobs_updated_at
before update on public.generation_jobs
for each row
execute function public.set_updated_at();

drop trigger if exists set_credit_wallets_updated_at on public.credit_wallets;
create trigger set_credit_wallets_updated_at
before update on public.credit_wallets
for each row
execute function public.set_updated_at();

drop trigger if exists set_daily_usage_updated_at on public.user_generation_daily_usage;
create trigger set_daily_usage_updated_at
before update on public.user_generation_daily_usage
for each row
execute function public.set_updated_at();

drop trigger if exists set_boards_updated_at on public.boards;
create trigger set_boards_updated_at
before update on public.boards
for each row
execute function public.set_updated_at();

insert into public.ai_providers (provider_key, display_name, is_enabled, metadata)
values
  ('openai', 'OpenAI', false, '{"docs":"https://platform.openai.com/docs"}'::jsonb),
  ('stability', 'Stability AI', false, '{"docs":"https://platform.stability.ai"}'::jsonb),
  ('nanobanana', 'Nano Banana', false, '{"docs":"https://nanobanana.example/docs"}'::jsonb),
  ('flux', 'FLUX', false, '{"docs":"https://flux.example/docs"}'::jsonb)
on conflict (provider_key) do nothing;

insert into public.ai_models (provider_key, model_key, display_name, description, is_enabled, is_public, sort_order, metadata)
values
  ('openai', 'gpt-image-1', 'GPT Image 1', 'Modelo nativo de OpenAI para generacion de imagen.', true, true, 10, '{"type":"text-to-image"}'::jsonb),
  ('stability', 'stable-image-ultra', 'Stable Image Ultra', 'Modelo premium de Stability AI para imagenes de alta calidad.', true, true, 20, '{"type":"text-to-image"}'::jsonb),
  ('nanobanana', 'nano-banana-v1', 'Nano Banana v1', 'Modelo rapido para conceptos visuales y exploracion.', true, true, 30, '{"type":"text-to-image"}'::jsonb),
  ('flux', 'flux-1.1-pro', 'FLUX 1.1 Pro', 'Modelo FLUX para imagenes con estilo artistico avanzado.', true, true, 40, '{"type":"text-to-image"}'::jsonb)
on conflict (model_key) do update set
  provider_key = excluded.provider_key,
  display_name = excluded.display_name,
  description = excluded.description,
  is_enabled = excluded.is_enabled,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  metadata = excluded.metadata;

insert into public.app_settings (key, value_json, value_type, category, description, is_public)
values
  ('generation.enabled', 'true'::jsonb, 'boolean', 'generation', 'Activa la generacion de imagenes AI.', true),
  ('generation.daily_free_limit', '5'::jsonb, 'number', 'generation', 'Cantidad de imagenes gratis por usuario por dia UTC.', true),
  ('generation.default_aspect_ratio', '"9:16"'::jsonb, 'string', 'generation', 'Aspect ratio por defecto del creador.', true),
  ('generation.max_prompt_length', '2000'::jsonb, 'number', 'generation', 'Longitud maxima de prompt permitida.', false),
  ('generation.default_model_key', '"gpt-image-1"'::jsonb, 'string', 'generation', 'Modelo default del creador.', true),
  ('generation.queue_enabled', 'true'::jsonb, 'boolean', 'generation', 'Permite encolar jobs de generacion.', false),
  ('boards.max_per_user', '100'::jsonb, 'number', 'boards', 'Cantidad maxima de tableros por usuario.', false),
  ('boards.max_items_per_board', '500'::jsonb, 'number', 'boards', 'Cantidad maxima de imagenes por tablero.', false)
on conflict (key) do nothing;

insert into public.feature_flags (key, enabled, rollout, description, is_public)
values
  ('ai.creator_enabled', true, 100, 'Activa el creador de imagenes AI.', true),
  ('ai.multi_provider_enabled', true, 100, 'Activa arquitectura multi provider.', false),
  ('boards.enabled', true, 100, 'Activa tableros estilo Pinterest.', true),
  ('boards.collab_enabled', true, 100, 'Activa tableros colaborativos.', true)
on conflict (key) do nothing;

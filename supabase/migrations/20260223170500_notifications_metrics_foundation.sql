-- 20260223170500_notifications_metrics_foundation.sql
-- User notifications foundation for creator loop feedback and admin metrics.

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (
    kind in (
      'generation_ready',
      'board_saved',
      'image_saved_by_other',
      'like_milestone',
      'superlike_received',
      'system_info'
    )
  ),
  title text not null,
  body text not null,
  cta_path text null,
  event_key text null,
  payload jsonb not null default '{}'::jsonb,
  source_image_id uuid null references public.images(id) on delete set null,
  source_board_id uuid null references public.boards(id) on delete set null,
  source_job_id uuid null references public.generation_jobs(id) on delete set null,
  is_read boolean not null default false,
  read_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_at_desc_idx
  on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_user_unread_created_at_desc_idx
  on public.user_notifications (user_id, is_read, created_at desc);

create unique index if not exists user_notifications_event_key_unique_idx
  on public.user_notifications (event_key)
  where event_key is not null;

create or replace function public.trim_user_notifications()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  max_items integer := 200;
begin
  begin
    select greatest(20, least(1000, (value_json #>> '{}')::integer))
    into max_items
    from public.app_settings
    where key = 'notifications.max_items_per_user'
    limit 1;
  exception when others then
    max_items := 200;
  end;

  if max_items is null then
    max_items := 200;
  end if;

  delete from public.user_notifications target
  where target.user_id = new.user_id
    and target.id in (
      select stale.id
      from public.user_notifications stale
      where stale.user_id = new.user_id
      order by stale.created_at desc, stale.id desc
      offset max_items
    );

  return new;
end;
$$;

drop trigger if exists trim_user_notifications_after_insert on public.user_notifications;
create trigger trim_user_notifications_after_insert
after insert on public.user_notifications
for each row
execute function public.trim_user_notifications();

alter table public.user_notifications enable row level security;

drop policy if exists "user_notifications_select_own" on public.user_notifications;
create policy "user_notifications_select_own"
  on public.user_notifications
  for select
  using (auth.uid() = user_id);

drop policy if exists "user_notifications_update_own" on public.user_notifications;
create policy "user_notifications_update_own"
  on public.user_notifications
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.app_settings (key, value_json, value_type, category, description, is_public)
values
  (
    'notifications.enabled',
    'true'::jsonb,
    'boolean',
    'notifications',
    'Activa notificaciones in-app para feedback de creacion y engagement.',
    true
  ),
  (
    'notifications.creator_loop_enabled',
    'true'::jsonb,
    'boolean',
    'notifications',
    'Activa notificaciones automaticas para loop de creadores.',
    false
  ),
  (
    'notifications.max_items_per_user',
    '200'::jsonb,
    'number',
    'notifications',
    'Cantidad maxima de notificaciones persistidas por usuario.',
    false
  ),
  (
    'notifications.default_fetch_limit',
    '20'::jsonb,
    'number',
    'notifications',
    'Cantidad por defecto de notificaciones devueltas por request.',
    true
  )
on conflict (key) do update
set
  value_json = excluded.value_json,
  value_type = excluded.value_type,
  category = excluded.category,
  description = excluded.description,
  is_public = excluded.is_public;

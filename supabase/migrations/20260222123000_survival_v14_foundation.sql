-- 20260222123000_survival_v14_foundation.sql
-- Survival system foundation (v1.4): cohorts, live ranking, finalize snapshot,
-- deterministic tie-breakers, self-vote guard, and dynamic survival settings.

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'images'
      and column_name = 'cohort_date'
  ) then
    alter table public.images
      add column cohort_date date
      generated always as (((created_at at time zone 'UTC')::date)) stored;
  end if;
end;
$$;

create index if not exists images_cohort_date_created_at_idx
  on public.images (cohort_date, created_at asc);

create index if not exists images_pending_expires_at_idx
  on public.images (expires_at asc)
  where deleted_at is null and is_immortal = false;

create table if not exists public.image_results (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null unique references public.images(id) on delete cascade,
  cohort_date date not null,
  final_like_count integer not null default 0,
  final_superlike_count integer not null default 0,
  score numeric not null default 0,
  rank_in_cohort bigint not null,
  cohort_size bigint not null,
  cutoff_position bigint not null,
  status text not null check (status in ('survived', 'died')),
  finalized_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists image_results_cohort_rank_idx
  on public.image_results (cohort_date, rank_in_cohort asc);

create index if not exists image_results_status_finalized_idx
  on public.image_results (status, finalized_at desc);

drop trigger if exists set_image_results_updated_at on public.image_results;
create trigger set_image_results_updated_at
before update on public.image_results
for each row
execute function public.set_updated_at();

alter table public.image_results enable row level security;

drop policy if exists "image_results_public_select" on public.image_results;
create policy "image_results_public_select"
  on public.image_results
  for select
  using (true);

drop policy if exists "image_results_admin_insert" on public.image_results;
create policy "image_results_admin_insert"
  on public.image_results
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "image_results_admin_update" on public.image_results;
create policy "image_results_admin_update"
  on public.image_results
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "image_results_admin_delete" on public.image_results;
create policy "image_results_admin_delete"
  on public.image_results
  for delete
  to authenticated
  using (public.is_admin());

insert into public.app_settings (key, value_json, value_type, category, description, is_public)
values
  (
    'survival.top_percentage',
    '0.15'::jsonb,
    'number',
    'survival',
    'Porcentaje top por cohorte que sobrevive (0.15 = top 15%).',
    false
  ),
  (
    'survival.superlike_weight',
    '4'::jsonb,
    'number',
    'survival',
    'Peso del superlike en Hall of Fame. No afecta supervivencia con Opcion A.',
    false
  )
on conflict (key) do update
set
  value_json = excluded.value_json,
  value_type = excluded.value_type,
  category = excluded.category,
  description = excluded.description,
  is_public = excluded.is_public;

create or replace function public.get_setting_number(p_key text, p_default numeric)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  raw_value text;
  parsed_value numeric;
begin
  select value_json #>> '{}'
  into raw_value
  from public.app_settings
  where key = p_key
  limit 1;

  if raw_value is null then
    return p_default;
  end if;

  parsed_value := raw_value::numeric;
  return coalesce(parsed_value, p_default);
exception when others then
  return p_default;
end;
$$;

create or replace function public.prevent_self_vote()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  image_owner uuid;
begin
  select user_id
  into image_owner
  from public.images
  where id = new.image_id
    and deleted_at is null;

  if image_owner is null then
    raise exception 'Image not found';
  end if;

  if image_owner = new.user_id then
    raise exception 'Self-vote not allowed';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_self_vote_on_likes on public.likes;
create trigger prevent_self_vote_on_likes
before insert on public.likes
for each row
execute function public.prevent_self_vote();

drop trigger if exists prevent_self_vote_on_superlikes on public.superlikes;
create trigger prevent_self_vote_on_superlikes
before insert on public.superlikes
for each row
execute function public.prevent_self_vote();

create or replace function public.get_live_ranking()
returns table (
  id uuid,
  cohort_date date,
  rank_in_cohort bigint,
  cohort_size bigint,
  cutoff_position bigint,
  likes_needed integer,
  will_survive boolean,
  score numeric
)
language sql
stable
set search_path = public
as $$
  with top_pct as (
    select greatest(
      0.01::numeric,
      least(
        1.0::numeric,
        public.get_setting_number('survival.top_percentage', 0.15)
      )
    ) as value
  ),
  active as (
    select
      i.id,
      i.cohort_date,
      i.like_count,
      i.created_at,
      i.like_count::numeric as score
    from public.images i
    where i.deleted_at is null
      and i.is_immortal = false
      and i.expires_at > now()
  ),
  ranked as (
    select
      a.id,
      a.cohort_date,
      a.like_count,
      a.score,
      row_number() over (
        partition by a.cohort_date
        order by
          a.score desc,
          a.like_count desc,
          a.created_at asc,
          a.id asc
      ) as rank_in_cohort,
      count(*) over (partition by a.cohort_date) as cohort_size
    from active a
  ),
  projected as (
    select
      r.*,
      greatest(1, ceil(r.cohort_size * tp.value)::bigint) as cutoff_position
    from ranked r
    cross join top_pct tp
  ),
  cutoff_scores as (
    select
      p.cohort_date,
      min(p.like_count)::integer as likes_needed
    from projected p
    where p.rank_in_cohort <= p.cutoff_position
    group by p.cohort_date
  )
  select
    p.id,
    p.cohort_date,
    p.rank_in_cohort,
    p.cohort_size,
    p.cutoff_position,
    coalesce(cs.likes_needed, 0) as likes_needed,
    (p.rank_in_cohort <= p.cutoff_position) as will_survive,
    p.score
  from projected p
  left join cutoff_scores cs
    on cs.cohort_date = p.cohort_date;
$$;

create or replace function public.finalize_cohort(
  p_target_date date default ((now() at time zone 'UTC')::date - 2)
)
returns table (
  image_id uuid,
  cohort_date date,
  rank_in_cohort bigint,
  cohort_size bigint,
  cutoff_position bigint,
  status text,
  final_like_count integer,
  final_superlike_count integer,
  score numeric
)
language plpgsql
set search_path = public
as $$
declare
  top_pct numeric := greatest(
    0.01::numeric,
    least(
      1.0::numeric,
      public.get_setting_number('survival.top_percentage', 0.15)
    )
  );
begin
  return query
  with cohort as (
    select
      i.id,
      i.cohort_date,
      i.like_count,
      i.superlike_count,
      i.created_at
    from public.images i
    where i.cohort_date = p_target_date
      and i.deleted_at is null
      and i.is_immortal = false
      and i.expires_at <= now()
  ),
  ranked as (
    select
      c.id as image_id,
      c.cohort_date,
      c.like_count as final_like_count,
      c.superlike_count as final_superlike_count,
      c.like_count::numeric as score,
      row_number() over (
        order by
          c.like_count desc,
          c.created_at asc,
          c.id asc
      ) as rank_in_cohort,
      count(*) over () as cohort_size
    from cohort c
  ),
  projected as (
    select
      r.*,
      greatest(1, ceil(r.cohort_size * top_pct)::bigint) as cutoff_position,
      case
        when r.rank_in_cohort <= greatest(1, ceil(r.cohort_size * top_pct)::bigint) then 'survived'::text
        else 'died'::text
      end as status
    from ranked r
  ),
  upserted as (
    insert into public.image_results (
      image_id,
      cohort_date,
      final_like_count,
      final_superlike_count,
      score,
      rank_in_cohort,
      cohort_size,
      cutoff_position,
      status,
      finalized_at,
      updated_at
    )
    select
      p.image_id,
      p.cohort_date,
      p.final_like_count,
      p.final_superlike_count,
      p.score,
      p.rank_in_cohort,
      p.cohort_size,
      p.cutoff_position,
      p.status,
      now(),
      now()
    from projected p
    on conflict (image_id) do update
      set cohort_date = excluded.cohort_date,
          final_like_count = excluded.final_like_count,
          final_superlike_count = excluded.final_superlike_count,
          score = excluded.score,
          rank_in_cohort = excluded.rank_in_cohort,
          cohort_size = excluded.cohort_size,
          cutoff_position = excluded.cutoff_position,
          status = excluded.status,
          finalized_at = excluded.finalized_at,
          updated_at = now()
    returning
      image_id,
      cohort_date,
      rank_in_cohort,
      cohort_size,
      cutoff_position,
      status,
      final_like_count,
      final_superlike_count,
      score
  ),
  mark_survivors as (
    update public.images i
    set
      is_immortal = true,
      deleted_at = null,
      updated_at = now()
    where i.id in (
      select u.image_id
      from upserted u
      where u.status = 'survived'
    )
    returning i.id
  ),
  mark_died as (
    update public.images i
    set
      is_immortal = false,
      deleted_at = coalesce(i.deleted_at, now()),
      updated_at = now()
    where i.id in (
      select u.image_id
      from upserted u
      where u.status = 'died'
    )
    returning i.id
  )
  select
    u.image_id,
    u.cohort_date,
    u.rank_in_cohort,
    u.cohort_size,
    u.cutoff_position,
    u.status,
    u.final_like_count,
    u.final_superlike_count,
    u.score
  from upserted u
  order by u.rank_in_cohort asc;
end;
$$;

create or replace function public.get_hall_of_fame_ranking(p_limit integer default 50)
returns table (
  image_id uuid,
  cohort_date date,
  final_like_count integer,
  final_superlike_count integer,
  hof_score numeric,
  rank_position bigint
)
language sql
stable
set search_path = public
as $$
  with weight as (
    select public.get_setting_number('survival.superlike_weight', 4)::numeric as value
  ),
  scored as (
    select
      r.image_id,
      r.cohort_date,
      r.final_like_count,
      r.final_superlike_count,
      (r.final_like_count + (r.final_superlike_count * w.value))::numeric as hof_score
    from public.image_results r
    cross join weight w
    where r.status = 'survived'
  )
  select
    s.image_id,
    s.cohort_date,
    s.final_like_count,
    s.final_superlike_count,
    s.hof_score,
    row_number() over (
      order by
        s.hof_score desc,
        s.final_like_count desc,
        s.cohort_date desc,
        s.image_id asc
    ) as rank_position
  from scored s
  order by rank_position asc
  limit greatest(1, least(500, p_limit));
$$;

-- 20260224004000_generated_engagement_rpcs.sql
-- Generated engagement RPCs without client-side truncation:
-- - summary window stats (totals)
-- - top creators window stats (ranked)

create or replace function public.get_generated_engagement_summary_window(
  p_since timestamptz,
  p_until timestamptz default now()
)
returns table (
  generated_images bigint,
  likes_received bigint,
  superlikes_received bigint,
  immortalized bigint,
  creators bigint
)
language sql
stable
set search_path = public
as $$
  with generated as (
    select
      i.id,
      i.user_id,
      i.is_immortal
    from public.images i
    where i.origin_type = 'generated'
      and i.deleted_at is null
      and i.created_at >= p_since
      and i.created_at < p_until
  ),
  engagement as (
    select
      event_rows.image_id,
      sum(case when event_rows.event_name = 'like_added' then 1 else 0 end)::bigint as likes_received,
      sum(case when event_rows.event_name = 'superlike_added' then 1 else 0 end)::bigint as superlikes_received
    from (
      select
        case
          when (pe.metadata ->> 'imageId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (pe.metadata ->> 'imageId')::uuid
          else null
        end as image_id,
        pe.event_name
      from public.product_events pe
      where pe.event_name in ('like_added', 'superlike_added')
        and pe.event_time >= p_since
        and pe.event_time < p_until
        and coalesce(pe.is_test_traffic, false) = false
        and coalesce(pe.is_bot, false) = false
        and public.analytics_is_internal_ip(pe.ip) = false
    ) as event_rows
    where event_rows.image_id is not null
    group by event_rows.image_id
  )
  select
    count(g.id)::bigint as generated_images,
    coalesce(sum(e.likes_received), 0)::bigint as likes_received,
    coalesce(sum(e.superlikes_received), 0)::bigint as superlikes_received,
    coalesce(sum(case when g.is_immortal then 1 else 0 end), 0)::bigint as immortalized,
    count(distinct g.user_id)::bigint as creators
  from generated g
  left join engagement e
    on e.image_id = g.id;
$$;

create or replace function public.get_generated_creator_stats_window(
  p_since timestamptz,
  p_until timestamptz default now(),
  p_limit integer default 8
)
returns table (
  user_id uuid,
  images_generated bigint,
  likes_received bigint,
  superlikes_received bigint,
  immortalized bigint,
  score numeric
)
language sql
stable
set search_path = public
as $$
  with generated as (
    select
      i.id,
      i.user_id,
      i.is_immortal
    from public.images i
    where i.origin_type = 'generated'
      and i.deleted_at is null
      and i.created_at >= p_since
      and i.created_at < p_until
  ),
  engagement as (
    select
      event_rows.image_id,
      sum(case when event_rows.event_name = 'like_added' then 1 else 0 end)::bigint as likes_received,
      sum(case when event_rows.event_name = 'superlike_added' then 1 else 0 end)::bigint as superlikes_received
    from (
      select
        case
          when (pe.metadata ->> 'imageId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          then (pe.metadata ->> 'imageId')::uuid
          else null
        end as image_id,
        pe.event_name
      from public.product_events pe
      where pe.event_name in ('like_added', 'superlike_added')
        and pe.event_time >= p_since
        and pe.event_time < p_until
        and coalesce(pe.is_test_traffic, false) = false
        and coalesce(pe.is_bot, false) = false
        and public.analytics_is_internal_ip(pe.ip) = false
    ) as event_rows
    where event_rows.image_id is not null
    group by event_rows.image_id
  ),
  creator_agg as (
    select
      g.user_id,
      count(*)::bigint as images_generated,
      coalesce(sum(e.likes_received), 0)::bigint as likes_received,
      coalesce(sum(e.superlikes_received), 0)::bigint as superlikes_received,
      coalesce(sum(case when g.is_immortal then 1 else 0 end), 0)::bigint as immortalized
    from generated g
    left join engagement e
      on e.image_id = g.id
    group by g.user_id
  )
  select
    c.user_id,
    c.images_generated,
    c.likes_received,
    c.superlikes_received,
    c.immortalized,
    (
      c.likes_received::numeric
      + (c.superlikes_received::numeric * 4)
      + (c.images_generated::numeric * 3)
      + (c.immortalized::numeric * 20)
    ) as score
  from creator_agg c
  order by score desc, c.likes_received desc, c.images_generated desc, c.user_id asc
  limit greatest(1, least(100, coalesce(p_limit, 8)));
$$;

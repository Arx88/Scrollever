-- 20260224002000_analytics_hardening_v2.sql
-- Hardening: signup source of truth on auth.users, internal IP filtering,
-- and analytics settings for traffic exclusion.

drop trigger if exists track_signup_completed_on_profiles on public.profiles;

create or replace function public.track_signup_completed_on_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.product_events (
    event_name,
    event_time,
    user_id,
    source,
    path,
    metadata,
    is_test_traffic,
    is_bot
  )
  values (
    'signup_completed',
    coalesce(new.created_at, now()),
    new.id,
    'signup',
    '/auth/sign-up',
    jsonb_build_object('origin', 'auth_users_trigger'),
    false,
    false
  );

  return new;
end;
$$;

drop trigger if exists track_signup_completed_on_auth_users on auth.users;
create trigger track_signup_completed_on_auth_users
after insert on auth.users
for each row
execute function public.track_signup_completed_on_auth_user();

create or replace function public.analytics_is_internal_ip(p_ip inet)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  raw_list jsonb;
  candidate text;
begin
  if p_ip is null then
    return false;
  end if;

  select value_json
  into raw_list
  from public.app_settings
  where key = 'analytics.internal_ip_blocklist'
  limit 1;

  if raw_list is null or jsonb_typeof(raw_list) <> 'array' then
    return false;
  end if;

  for candidate in
    select value
    from jsonb_array_elements_text(raw_list) as value
  loop
    candidate := trim(candidate);
    if candidate = '' then
      continue;
    end if;

    begin
      if p_ip <<= candidate::cidr then
        return true;
      end if;
    exception when others then
      begin
        if p_ip = candidate::inet then
          return true;
        end if;
      exception when others then
        continue;
      end;
    end;
  end loop;

  return false;
end;
$$;

create or replace view public.analytics_events_enriched
with (security_invoker = true)
as
select
  pe.event_id,
  pe.event_name,
  pe.event_time,
  pe.ingested_at,
  pe.user_id,
  pe.anonymous_id,
  pe.session_id,
  pe.source,
  pe.path,
  pe.referrer,
  pe.user_agent,
  pe.ip,
  pe.metadata,
  pe.is_test_traffic,
  pe.is_bot,
  il.user_id as linked_user_id,
  coalesce(pe.user_id, il.user_id) as resolved_user_id,
  coalesce(
    case when pe.user_id is not null then 'u:' || pe.user_id::text end,
    case when il.user_id is not null then 'u:' || il.user_id::text end,
    case when pe.anonymous_id is not null and trim(pe.anonymous_id) <> '' then 'a:' || pe.anonymous_id end
  ) as consolidated_visitor_id,
  (
    coalesce(pe.is_test_traffic, false)
    or coalesce(pe.is_bot, false)
    or public.analytics_is_bot(pe.user_agent)
    or public.analytics_is_internal_ip(pe.ip)
  ) as is_filtered_traffic
from public.product_events pe
left join public.identity_links_latest il
  on il.anonymous_id = pe.anonymous_id;

insert into public.app_settings (key, value_json, value_type, category, description, is_public)
values
  (
    'analytics.internal_ip_blocklist',
    '[]'::jsonb,
    'string_array',
    'analytics',
    'Lista de IPs/CIDRs internas para excluir de visitor analytics (QA/staging/oficina).',
    false
  )
on conflict (key) do update
set
  value_json = excluded.value_json,
  value_type = excluded.value_type,
  category = excluded.category,
  description = excluded.description,
  is_public = excluded.is_public;

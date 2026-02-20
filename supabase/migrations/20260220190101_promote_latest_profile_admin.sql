-- Promote the most recently registered account to admin.
with latest_account as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  order by u.created_at desc nulls last, p.created_at desc nulls last
  limit 1
)
update public.profiles p
set role = 'admin',
    updated_at = now()
from latest_account
where p.id = latest_account.id;

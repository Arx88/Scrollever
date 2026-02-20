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

-- Seed additional images provided in "Imagenes nuevas".

with owner as (
  select p.id
  from public.profiles p
  order by p.created_at desc
  limit 1
),
seed_rows as (
  select * from (values
    (
      '/provisional/Gemini_Generated_Image_4z03ly4z03ly4z03.png',
      'Gemini Aurora Drift',
      'Editorial',
      false,
      false,
      now() - interval '35 minutes',
      now() + interval '23 hours',
      404,
      16
    ),
    (
      '/provisional/Gemini_Generated_Image_xvw78zxvw78zxvw7.png',
      'Gemini Velvet Lightning',
      'Moda',
      true,
      false,
      now() - interval '6 days',
      now() - interval '5 days',
      702,
      29
    )
  ) as t(url, title, category, is_immortal, is_hall_of_fame, created_at, expires_at, like_count, superlike_count)
)
insert into public.images (
  user_id,
  url,
  title,
  prompt,
  category,
  width,
  height,
  like_count,
  superlike_count,
  is_immortal,
  is_hall_of_fame,
  created_at,
  expires_at,
  origin_type
)
select
  owner.id,
  seed_rows.url,
  seed_rows.title,
  seed_rows.title,
  seed_rows.category,
  900,
  1600,
  seed_rows.like_count,
  seed_rows.superlike_count,
  seed_rows.is_immortal,
  seed_rows.is_hall_of_fame,
  seed_rows.created_at,
  seed_rows.expires_at,
  'upload'
from owner
cross join seed_rows
where not exists (
  select 1
  from public.images existing
  where existing.user_id = owner.id
    and existing.url = seed_rows.url
);

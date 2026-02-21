-- Seed provisional images into real feed to restore volume.
-- Inserts for the most recent profile and avoids duplicates by (user_id, url).

with owner as (
  select p.id
  from public.profiles p
  order by p.created_at desc
  limit 1
),
seed_rows as (
  select * from (values
    ('/provisional/Imagen%202.png',  'Neon Streetwear Tokyo',      'Streetstyle', false, false, now() - interval '1 hour',  now() + interval '23 hours', 842, 34),
    ('/provisional/Imagen%2013.png', 'Digital Collage Grunge',     'Collage',     false, false, now() - interval '2 hours', now() + interval '22 hours', 429, 22),
    ('/provisional/Imagen%209.png',  'Lime Luxe Product',          'Productos',   false, false, now() - interval '3 hours', now() + interval '21 hours', 365, 9),
    ('/provisional/Imagen%2014.png', 'Metallic Portrait',          'Retratos',    false, false, now() - interval '4 hours', now() + interval '20 hours', 612, 26),
    ('/provisional/Imagen%204.png',  'Editorial Monochrome',       'Editorial',   false, false, now() - interval '5 hours', now() + interval '19 hours', 288, 11),
    ('/provisional/Imagen%2010.png', 'Bold Fashion Geometry',      'Moda',        false, false, now() - interval '6 hours', now() + interval '18 hours', 501, 19),
    ('/provisional/Imagen%2015.png', 'Lifestyle Dreamscape',       'Lifestyle',   false, false, now() - interval '7 hours', now() + interval '17 hours', 257, 8),
    ('/provisional/Imagen%2017.png', 'Cyberpunk Alley Portrait',   'Streetstyle', false, false, now() - interval '8 hours', now() + interval '16 hours', 733, 31),
    ('/provisional/Gemini_Generated_Image_3ts8ny3ts8ny3ts8.png', 'Gemini Neon Monolith',  'Editorial', true, true, now() - interval '2 days', now() - interval '1 day', 958, 64),
    ('/provisional/Gemini_Generated_Image_6sfjf26sfjf26sfj.png', 'Gemini Chroma Muse',    'Moda',      true, false, now() - interval '3 days', now() - interval '2 days', 644, 28),
    ('/provisional/Gemini_Generated_Image_o044ilo044ilo044.png', 'Gemini Brutalist Glow', 'Editorial', true, false, now() - interval '4 days', now() - interval '3 days', 520, 24),
    ('/provisional/Gemini_Generated_Image_ujii97ujii97ujii.png', 'Gemini Velvet Noise',   'Collage',   true, true,  now() - interval '5 days', now() - interval '4 days', 811, 42),
    ('/provisional/Imagen%207.png',  'Surreal Sunset Runner',      'Lifestyle',   false, false, now() - interval '9 hours', now() + interval '15 hours', 319, 10)
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

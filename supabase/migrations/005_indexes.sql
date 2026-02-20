-- 005_indexes.sql

create index if not exists images_created_at_desc_idx
  on public.images (created_at desc);

create index if not exists images_category_created_at_desc_idx
  on public.images (category, created_at desc);

create index if not exists images_hall_of_fame_rank_idx
  on public.images (is_hall_of_fame, superlike_count desc, like_count desc, created_at desc);

create index if not exists images_immortal_created_at_desc_idx
  on public.images (is_immortal, created_at desc);

create index if not exists likes_image_id_idx
  on public.likes (image_id);

create index if not exists superlikes_image_id_idx
  on public.superlikes (image_id);

create index if not exists likes_user_created_at_desc_idx
  on public.likes (user_id, created_at desc);

create index if not exists superlikes_user_created_at_desc_idx
  on public.superlikes (user_id, created_at desc);

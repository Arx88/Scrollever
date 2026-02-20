-- 006_updated_at_triggers.sql

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists set_images_updated_at on public.images;
create trigger set_images_updated_at
before update on public.images
for each row
execute function public.set_updated_at();

create or replace function public.bump_like_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.images
    set like_count = like_count + 1,
        updated_at = now()
    where id = new.image_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.images
    set like_count = greatest(like_count - 1, 0),
        updated_at = now()
    where id = old.image_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists likes_counter_trigger on public.likes;
create trigger likes_counter_trigger
after insert or delete on public.likes
for each row
execute function public.bump_like_count();

create or replace function public.bump_superlike_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.images
    set superlike_count = superlike_count + 1,
        updated_at = now()
    where id = new.image_id;
    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.images
    set superlike_count = greatest(superlike_count - 1, 0),
        updated_at = now()
    where id = old.image_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists superlikes_counter_trigger on public.superlikes;
create trigger superlikes_counter_trigger
after insert or delete on public.superlikes
for each row
execute function public.bump_superlike_count();

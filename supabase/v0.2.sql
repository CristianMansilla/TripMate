-- TripMate v0.2 migration
-- Ejecutar una vez en SQL Editor sobre una base existente de TripMate v0.1.

alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;

alter table public.profiles
  add constraint profiles_username_format
  check(username is null or username ~ '^[a-z0-9_]{3,24}$');

create or replace function public.resolve_login_identifier(p_identifier text)
returns text language sql stable security definer set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_identifier))
  limit 1;
$$;

grant execute on function public.resolve_login_identifier(text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,display_name,username)
  values(
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    nullif(lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username',''), '[^a-z0-9_]', '', 'g')), '')
  )
  on conflict(id) do nothing;
  return new;
end $$;

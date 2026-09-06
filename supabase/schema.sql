-- TripMate · Supabase schema
-- Ejecutar en SQL Editor de Supabase sobre un proyecto nuevo.
create extension if not exists pgcrypto;

create type public.trip_role as enum ('owner','editor','viewer');
create type public.trip_status as enum ('planning','active','completed');
create type public.activity_status as enum ('idea','planned','reserved','paid','done');
create type public.cost_scope as enum ('shared','per_person');
create type public.reservation_status as enum ('watching','pending','reserved','paid');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique check(username is null or username ~ '^[a-z0-9_]{3,24}$'),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  destination text not null,
  country text,
  start_date date not null,
  end_date date not null,
  currency text not null default 'ARS',
  status public.trip_status not null default 'planning',
  cover_url text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_dates check(end_date >= start_date)
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.trip_role not null default 'editor',
  joined_at timestamptz not null default now(),
  primary key(trip_id,user_id)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  start_time time,
  end_time time,
  title text not null check(length(trim(title)) > 0),
  category text not null default 'other',
  place text,
  address text,
  notes text,
  url text,
  estimated_cost numeric(14,2) not null default 0,
  actual_cost numeric(14,2),
  cost_scope public.cost_scope not null default 'shared',
  status public.activity_status not null default 'planned',
  optional boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  title text not null check(length(trim(title)) > 0),
  category text not null,
  amount numeric(14,2) not null default 0 check(amount >= 0),
  currency text not null default 'ARS',
  status text not null default 'estimated' check(status in ('estimated','confirmed','paid')),
  scope public.cost_scope not null default 'shared',
  included boolean not null default true,
  amount_basis text not null default 'per_person' check(amount_basis in ('per_person','group')),
  paid_by uuid references auth.users(id),
  expense_date date,
  itinerary_start_time time,
  itinerary_end_time time,
  place text,
  notes text,
  optional boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  title text not null,
  status public.reservation_status not null default 'pending',
  priority text not null default 'medium' check(priority in ('high','medium','low')),
  due_date date,
  booking_url text,
  confirmation_code text,
  amount numeric(14,2),
  notes text,
  position integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  category text not null default 'other',
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  url text,
  notes text,
  status text not null default 'saved' check(status in ('saved','candidate','confirmed','discarded','visited')),
  is_base boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index places_one_base_per_trip
  on public.places (trip_id)
  where is_base;

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  label text not null,
  category text not null default 'General',
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_label text,
  quantity integer not null default 1 check(quantity > 0),
  packed boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text,
  body text not null,
  pinned boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  code text not null unique default encode(gen_random_bytes(9),'hex'),
  role public.trip_role not null default 'editor',
  expires_at timestamptz,
  max_uses integer not null default 10 check(max_uses > 0),
  uses integer not null default 0,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.change_log (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Helpers ---------------------------------------------------------------
create or replace function public.is_trip_member(p_trip uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.trip_members tm where tm.trip_id=p_trip and tm.user_id=auth.uid()); $$;

create or replace function public.can_edit_trip(p_trip uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.trip_members tm where tm.trip_id=p_trip and tm.user_id=auth.uid() and tm.role in ('owner','editor')); $$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.trip_members tm where tm.trip_id=p_trip and tm.user_id=auth.uid() and tm.role='owner'); $$;

create or replace function public.shares_trip_with(p_user uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select p_user = auth.uid() or exists(
    select 1
    from public.trip_members mine
    join public.trip_members theirs on theirs.trip_id = mine.trip_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

create or replace function public.create_trip(
  p_name text, p_destination text, p_country text, p_start_date date, p_end_date date, p_currency text default 'ARS'
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_trip uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.trips(name,destination,country,start_date,end_date,currency,created_by)
  values(p_name,p_destination,p_country,p_start_date,p_end_date,p_currency,auth.uid()) returning id into v_trip;
  insert into public.trip_members(trip_id,user_id,role) values(v_trip,auth.uid(),'owner');
  return v_trip;
end $$;

create or replace function public.resolve_login_identifier(p_identifier text)
returns text language sql stable security definer set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(p_identifier))
  limit 1;
$$;

create or replace function public.join_trip_by_code(p_code text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_inv public.trip_invites%rowtype;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select * into v_inv from public.trip_invites where code=p_code for update;
  if not found then raise exception 'Invalid invite'; end if;
  if v_inv.expires_at is not null and v_inv.expires_at < now() then raise exception 'Invite expired'; end if;
  if v_inv.uses >= v_inv.max_uses then raise exception 'Invite exhausted'; end if;
  if not exists(select 1 from public.trip_members where trip_id=v_inv.trip_id and user_id=auth.uid()) then
    insert into public.trip_members(trip_id,user_id,role) values(v_inv.trip_id,auth.uid(),v_inv.role);
    update public.trip_invites set uses=uses+1 where id=v_inv.id;
  end if;
  return v_inv.trip_id;
end $$;

create or replace function public.move_reservation(p_reservation_id uuid, p_trip_id uuid, p_direction integer)
returns void language plpgsql security invoker set search_path=public as $$
declare v_current public.reservations%rowtype; v_target public.reservations%rowtype;
begin
  if p_direction not in (-1,1) then raise exception 'Dirección inválida.'; end if;
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  select * into v_current from public.reservations where id=p_reservation_id and trip_id=p_trip_id for update;
  if not found then raise exception 'No se encontró la reserva.'; end if;
  if p_direction=-1 then
    select * into v_target from public.reservations where trip_id=p_trip_id and position<v_current.position order by position desc, created_at desc limit 1 for update;
  else
    select * into v_target from public.reservations where trip_id=p_trip_id and position>v_current.position order by position, created_at limit 1 for update;
  end if;
  if not found then return; end if;
  update public.reservations set position=case when id=v_current.id then v_target.position else v_current.position end
  where id in (v_current.id,v_target.id);
end;
$$;

create or replace function public.save_expense_plan(
  p_expense_id uuid, p_trip_id uuid, p_title text, p_category text, p_amount numeric,
  p_status text, p_included boolean, p_amount_basis text, p_date date,
  p_start_time time, p_end_time time, p_place text, p_notes text, p_optional boolean
) returns uuid language plpgsql security invoker set search_path=public as $$
declare
  v_expense public.expenses%rowtype;
  v_activity_id uuid;
  v_detached_activity_id uuid;
  v_expense_id uuid;
  v_activity_category text;
  v_activity_status public.activity_status;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if length(trim(coalesce(p_title, ''))) = 0 then raise exception 'El nombre no puede estar vacío.'; end if;
  if length(trim(coalesce(p_category, ''))) = 0 then raise exception 'La categoría no puede estar vacía.'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'El importe no puede ser negativo.'; end if;
  if p_status not in ('estimated','confirmed','paid') then raise exception 'Estado de gasto inválido.'; end if;
  if p_amount_basis not in ('per_person','group') then raise exception 'Base de importe inválida.'; end if;

  v_activity_category := case
    when lower(p_category) like any(array['%transporte%','%micro%','%uber%','%taxi%']) then 'transport'
    when lower(p_category) like '%aloj%' then 'lodging'
    when lower(p_category) like any(array['%comida%','%cena%','%almuerzo%']) then 'food'
    when lower(p_category) like '%museo%' then 'museum'
    when lower(p_category) like any(array['%salida%','%noche%','%boliche%']) then 'nightlife'
    when lower(p_category) like any(array['%entrada%','%recital%']) then 'event'
    else 'activity'
  end;
  v_activity_status := case p_status
    when 'paid' then 'paid'::public.activity_status
    when 'confirmed' then 'reserved'::public.activity_status
    else 'planned'::public.activity_status
  end;

  if p_expense_id is not null then
    select * into v_expense from public.expenses where id=p_expense_id and trip_id=p_trip_id for update;
    if not found then raise exception 'No se encontró el gasto.'; end if;
    v_activity_id := v_expense.activity_id;
  end if;

  if p_date is not null then
    if v_activity_id is null then
      insert into public.activities(trip_id,date,start_time,end_time,title,category,place,notes,estimated_cost,actual_cost,cost_scope,status,optional,created_by,updated_by)
      values(p_trip_id,p_date,p_start_time,p_end_time,trim(p_title),v_activity_category,nullif(trim(coalesce(p_place,'')),''),nullif(trim(coalesce(p_notes,'')),''),p_amount,case when p_status='paid' then p_amount else null end,case when p_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,v_activity_status,coalesce(p_optional,false),auth.uid(),auth.uid())
      returning id into v_activity_id;
    else
      update public.activities
      set date=p_date,start_time=p_start_time,end_time=p_end_time,title=trim(p_title),category=v_activity_category,
          place=nullif(trim(coalesce(p_place,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),estimated_cost=p_amount,
          actual_cost=case when p_status='paid' then p_amount else null end,
          cost_scope=case when p_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
          status=v_activity_status,optional=coalesce(p_optional,false),updated_by=auth.uid()
      where id=v_activity_id and trip_id=p_trip_id;
      if not found then raise exception 'La actividad vinculada no pertenece al viaje.'; end if;
    end if;
  elsif v_activity_id is not null then
    v_detached_activity_id := v_activity_id;
    v_activity_id := null;
  end if;

  if p_expense_id is null then
    insert into public.expenses(trip_id,activity_id,title,category,amount,currency,status,scope,included,amount_basis,expense_date,itinerary_start_time,itinerary_end_time,place,notes,optional,created_by)
    select p_trip_id,v_activity_id,trim(p_title),trim(p_category),p_amount,t.currency,p_status,'per_person',coalesce(p_included,false),p_amount_basis,p_date,p_start_time,p_end_time,nullif(trim(coalesce(p_place,'')),''),nullif(trim(coalesce(p_notes,'')),''),coalesce(p_optional,false),auth.uid()
    from public.trips t where t.id=p_trip_id
    returning id into v_expense_id;
  else
    update public.expenses
    set activity_id=v_activity_id,title=trim(p_title),category=trim(p_category),amount=p_amount,status=p_status,
        included=coalesce(p_included,false),amount_basis=p_amount_basis,expense_date=p_date,
        itinerary_start_time=p_start_time,itinerary_end_time=p_end_time,place=nullif(trim(coalesce(p_place,'')),''),
        notes=nullif(trim(coalesce(p_notes,'')),''),optional=coalesce(p_optional,false)
    where id=p_expense_id and trip_id=p_trip_id
    returning id into v_expense_id;
  end if;

  if v_expense_id is null then raise exception 'No se pudo guardar el gasto.'; end if;
  if v_detached_activity_id is not null and not exists(select 1 from public.expenses where activity_id=v_detached_activity_id) then
    delete from public.activities where id=v_detached_activity_id and trip_id=p_trip_id;
  end if;
  return v_expense_id;
end;
$$;

create or replace function public.delete_expense_plan(p_expense_id uuid, p_trip_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare v_activity_id uuid;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  delete from public.expenses where id=p_expense_id and trip_id=p_trip_id returning activity_id into v_activity_id;
  if not found then raise exception 'No se encontró el gasto.'; end if;
  if v_activity_id is not null and not exists(select 1 from public.expenses where activity_id=v_activity_id) then
    delete from public.activities where id=v_activity_id and trip_id=p_trip_id;
  end if;
end;
$$;

-- Profile on signup -----------------------------------------------------
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
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- updated_at helper -----------------------------------------------------
create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger trips_updated before update on public.trips for each row execute function public.set_updated_at();
create trigger activities_updated before update on public.activities for each row execute function public.set_updated_at();
create trigger expenses_updated before update on public.expenses for each row execute function public.set_updated_at();
create trigger reservations_updated before update on public.reservations for each row execute function public.set_updated_at();
create trigger places_updated before update on public.places for each row execute function public.set_updated_at();
create trigger packing_updated before update on public.packing_items for each row execute function public.set_updated_at();
create trigger notes_updated before update on public.trip_notes for each row execute function public.set_updated_at();

-- RLS -------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.activities enable row level security;
alter table public.expenses enable row level security;
alter table public.reservations enable row level security;
alter table public.places enable row level security;
alter table public.packing_items enable row level security;
alter table public.trip_notes enable row level security;
alter table public.trip_invites enable row level security;
alter table public.change_log enable row level security;

create policy "profiles visible to travel companions" on public.profiles for select to authenticated using(public.shares_trip_with(id));
create policy "profile owner updates" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

revoke all on function public.resolve_login_identifier(text) from public, anon, authenticated;
grant execute on function public.resolve_login_identifier(text) to service_role;
revoke all on function public.save_expense_plan(uuid,uuid,text,text,numeric,text,boolean,text,date,time,time,text,text,boolean) from public, anon;
revoke all on function public.delete_expense_plan(uuid,uuid) from public, anon;
revoke all on function public.move_reservation(uuid,uuid,integer) from public, anon;
grant execute on function public.save_expense_plan(uuid,uuid,text,text,numeric,text,boolean,text,date,time,time,text,text,boolean) to authenticated;
grant execute on function public.delete_expense_plan(uuid,uuid) to authenticated;
grant execute on function public.move_reservation(uuid,uuid,integer) to authenticated;

create policy "members read trips" on public.trips for select to authenticated using(public.is_trip_member(id));
create policy "owners update trips" on public.trips for update to authenticated using(public.is_trip_owner(id)) with check(public.is_trip_owner(id));
create policy "owners delete trips" on public.trips for delete to authenticated using(public.is_trip_owner(id));

create policy "members read memberships" on public.trip_members for select to authenticated using(public.is_trip_member(trip_id));
create policy "owners manage memberships" on public.trip_members for all to authenticated using(public.is_trip_owner(trip_id)) with check(public.is_trip_owner(trip_id));

-- Generic member/edit policies per collaborative table
create policy "members read activities" on public.activities for select to authenticated using(public.is_trip_member(trip_id));
create policy "editors write activities" on public.activities for all to authenticated using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));
create policy "members read expenses" on public.expenses for select to authenticated using(public.is_trip_member(trip_id));
create policy "editors write expenses" on public.expenses for all to authenticated using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));
create policy "members read reservations" on public.reservations for select to authenticated using(public.is_trip_member(trip_id));
create policy "editors write reservations" on public.reservations for all to authenticated using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));
create policy "members read places" on public.places for select to authenticated using(public.is_trip_member(trip_id));
create policy "editors write places" on public.places for all to authenticated using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));
create policy "members read own packing" on public.packing_items for select to authenticated using(public.is_trip_member(trip_id) and assigned_to=auth.uid());
create policy "members insert own packing" on public.packing_items for insert to authenticated with check(public.is_trip_member(trip_id) and assigned_to=auth.uid());
create policy "members update own packing" on public.packing_items for update to authenticated using(public.is_trip_member(trip_id) and assigned_to=auth.uid()) with check(public.is_trip_member(trip_id) and assigned_to=auth.uid());
create policy "members delete own packing" on public.packing_items for delete to authenticated using(public.is_trip_member(trip_id) and assigned_to=auth.uid());
create policy "members read notes" on public.trip_notes for select to authenticated using(public.is_trip_member(trip_id));
create policy "editors write notes" on public.trip_notes for all to authenticated using(public.can_edit_trip(trip_id)) with check(public.can_edit_trip(trip_id));
create policy "owners read invites" on public.trip_invites for select to authenticated using(public.is_trip_owner(trip_id));
create policy "owners write invites" on public.trip_invites for all to authenticated using(public.is_trip_owner(trip_id)) with check(public.is_trip_owner(trip_id));
create policy "members read log" on public.change_log for select to authenticated using(public.is_trip_member(trip_id) and entity_type <> 'packing');
create policy "editors write log" on public.change_log for insert to authenticated with check(public.can_edit_trip(trip_id));

-- Realtime --------------------------------------------------------------
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.packing_items;
alter publication supabase_realtime add table public.places;
alter publication supabase_realtime add table public.change_log;

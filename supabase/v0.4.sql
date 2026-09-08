-- TripMate v0.4 migration
-- Ejecutar una vez en SQL Editor sobre una base existente con v0.3 aplicada.
-- No elimina gastos, actividades ni importes existentes.

alter table public.trips
  add column if not exists traveler_count integer;

-- Conserva el comportamiento visible actual al migrar. Después el organizador
-- puede ajustar esta cantidad sin agregar o expulsar cuentas del viaje.
update public.trips trip
set traveler_count = greatest(1, (
  select count(*)::integer from public.trip_members member
  where member.trip_id = trip.id
))
where trip.traveler_count is null;

alter table public.trips
  alter column traveler_count set default 1,
  alter column traveler_count set not null;
alter table public.trips
  drop constraint if exists trips_traveler_count_valid;
alter table public.trips
  add constraint trips_traveler_count_valid check (traveler_count between 1 and 100);

drop function if exists public.create_trip(text,text,text,date,date,text);
create or replace function public.create_trip(
  p_name text,
  p_destination text,
  p_country text,
  p_start_date date,
  p_end_date date,
  p_currency text default 'ARS',
  p_traveler_count integer default 1
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_trip uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if length(trim(coalesce(p_name,''))) = 0 then raise exception 'El nombre no puede estar vacío.'; end if;
  if length(trim(coalesce(p_destination,''))) = 0 then raise exception 'El destino no puede estar vacío.'; end if;
  if p_end_date < p_start_date then raise exception 'Las fechas del viaje no son válidas.'; end if;
  if p_traveler_count is null or p_traveler_count not between 1 and 100 then
    raise exception 'La cantidad de viajeros debe estar entre 1 y 100.';
  end if;
  insert into public.trips(name,destination,country,start_date,end_date,currency,traveler_count,created_by)
  values(trim(p_name),trim(p_destination),nullif(trim(coalesce(p_country,'')),''),p_start_date,p_end_date,p_currency,p_traveler_count,auth.uid())
  returning id into v_trip;
  insert into public.trip_members(trip_id,user_id,role) values(v_trip,auth.uid(),'owner');
  return v_trip;
end;
$$;

revoke all on function public.create_trip(text,text,text,date,date,text,integer) from public, anon;
grant execute on function public.create_trip(text,text,text,date,date,text,integer) to authenticated;

alter table public.expenses
  add column if not exists amount_basis text not null default 'per_person',
  add column if not exists itinerary_start_time time,
  add column if not exists itinerary_end_time time,
  add column if not exists place text,
  add column if not exists optional boolean not null default false,
  add column if not exists occurrence_pricing text not null default 'total';

alter table public.expenses
  drop constraint if exists expenses_amount_basis_valid;
alter table public.expenses
  add constraint expenses_amount_basis_valid
  check (amount_basis in ('per_person', 'group'));

alter table public.expenses
  drop constraint if exists expenses_occurrence_pricing_valid;
alter table public.expenses
  add constraint expenses_occurrence_pricing_valid
  check (occurrence_pricing in ('total', 'per_occurrence'));

alter table public.activities
  add column if not exists expense_id uuid references public.expenses(id) on delete cascade;

create index if not exists activities_expense_id_idx on public.activities(expense_id);

create table if not exists public.activity_steps (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  title text not null check(length(trim(title)) > 0),
  amount numeric(14,2) not null default 0,
  start_time time,
  end_time time,
  place text,
  notes text,
  optional boolean not null default false,
  position integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activity_steps
  add column if not exists amount numeric(14,2) not null default 0;
alter table public.activity_steps
  drop constraint if exists activity_steps_amount_nonnegative;
alter table public.activity_steps
  add constraint activity_steps_amount_nonnegative check(amount >= 0) not valid;

create index if not exists activity_steps_activity_position_idx
  on public.activity_steps(activity_id, position);

alter table public.activity_steps enable row level security;
drop policy if exists "members read activity steps" on public.activity_steps;
drop policy if exists "editors write activity steps" on public.activity_steps;
create policy "members read activity steps" on public.activity_steps
  for select to authenticated using(
    public.is_trip_member(trip_id)
    and exists (
      select 1 from public.activities activity
      where activity.id=activity_steps.activity_id and activity.trip_id=activity_steps.trip_id
    )
  );
create policy "editors write activity steps" on public.activity_steps
  for all to authenticated
  using(public.can_edit_trip(trip_id))
  with check(
    public.can_edit_trip(trip_id)
    and exists (
      select 1 from public.activities activity
      where activity.id=activity_steps.activity_id and activity.trip_id=activity_steps.trip_id
    )
  );

drop trigger if exists activity_steps_updated on public.activity_steps;
create trigger activity_steps_updated before update on public.activity_steps
  for each row execute function public.set_updated_at();

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename='activity_steps'
    ) then
    alter publication supabase_realtime add table public.activity_steps;
  end if;
end;
$$;

-- Cada vínculo uno a uno existente pasa a ser la primera ocurrencia del gasto.
update public.activities activity
set expense_id = expense.id
from public.expenses expense
where expense.activity_id = activity.id
  and activity.expense_id is null;

alter table public.expenses
  drop constraint if exists expenses_amount_nonnegative;
alter table public.expenses
  add constraint expenses_amount_nonnegative check (amount >= 0) not valid;

alter table public.expenses
  drop constraint if exists expenses_title_not_blank;
alter table public.expenses
  add constraint expenses_title_not_blank check (length(trim(title)) > 0) not valid;

-- El modelo actual es uno a uno: un gasto puede generar una sola actividad y
-- una actividad puede pertenecer a un solo gasto.
create unique index if not exists expenses_one_per_activity
  on public.expenses (activity_id)
  where activity_id is not null;

-- Copia datos actuales del itinerario al gasto para que puedan conservarse al quitar la fecha.
update public.expenses e
set expense_date = coalesce(e.expense_date, a.date),
    itinerary_start_time = coalesce(e.itinerary_start_time, a.start_time),
    itinerary_end_time = coalesce(e.itinerary_end_time, a.end_time),
    place = coalesce(e.place, a.place),
    notes = coalesce(e.notes, a.notes),
    optional = e.optional or a.optional
from public.activities a
where e.activity_id = a.id;

-- El email asociado a un usuario sólo puede resolverse desde el servidor de TripMate.
revoke all on function public.resolve_login_identifier(text) from public, anon, authenticated;
grant execute on function public.resolve_login_identifier(text) to service_role;

-- La valija es personal incluso para integrantes con rol lector.
drop policy if exists "members read own packing" on public.packing_items;
drop policy if exists "editors insert own packing" on public.packing_items;
drop policy if exists "editors update own packing" on public.packing_items;
drop policy if exists "editors delete own packing" on public.packing_items;
drop policy if exists "members insert own packing" on public.packing_items;
drop policy if exists "members update own packing" on public.packing_items;
drop policy if exists "members delete own packing" on public.packing_items;

create policy "members read own packing" on public.packing_items
  for select to authenticated
  using (public.is_trip_member(trip_id) and assigned_to = auth.uid());
create policy "members insert own packing" on public.packing_items
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and assigned_to = auth.uid());
create policy "members update own packing" on public.packing_items
  for update to authenticated
  using (public.is_trip_member(trip_id) and assigned_to = auth.uid())
  with check (public.is_trip_member(trip_id) and assigned_to = auth.uid());
create policy "members delete own packing" on public.packing_items
  for delete to authenticated
  using (public.is_trip_member(trip_id) and assigned_to = auth.uid());

-- Oculta del historial compartido cualquier evento viejo o futuro de valija.
drop policy if exists "members read log" on public.change_log;
create policy "members read log" on public.change_log
  for select to authenticated
  using (public.is_trip_member(trip_id) and entity_type <> 'packing');

-- Normaliza el orden actual sin cambiar el orden visible previo de cada viaje.
with ordered as (
  select id, row_number() over(partition by trip_id order by position, created_at, id) - 1 as next_position
  from public.reservations
)
update public.reservations r set position=ordered.next_position
from ordered where ordered.id=r.id;

create or replace function public.move_reservation(p_reservation_id uuid, p_trip_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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

create or replace function public.set_trip_base_place(p_place_id uuid, p_trip_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_edit_trip(p_trip_id) then
    raise exception 'No tenés permiso para editar este viaje.';
  end if;
  perform 1 from public.trips where id = p_trip_id for update;
  if not exists (
    select 1 from public.places
    where id = p_place_id and trip_id = p_trip_id
    for update
  ) then
    raise exception 'No se encontró el lugar.';
  end if;

  update public.places set is_base = false
  where trip_id = p_trip_id and is_base;
  update public.places set is_base = true
  where id = p_place_id and trip_id = p_trip_id;
end;
$$;


create or replace function public.save_expense_plan(
  p_expense_id uuid,
  p_trip_id uuid,
  p_title text,
  p_category text,
  p_amount numeric,
  p_status text,
  p_included boolean,
  p_amount_basis text,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_place text,
  p_notes text,
  p_optional boolean
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense public.expenses%rowtype;
  v_activity_id uuid;
  v_detached_activity_id uuid;
  v_expense_id uuid;
  v_activity_category text;
  v_activity_status public.activity_status;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if p_date is not null and not exists (
    select 1 from public.trips
    where id = p_trip_id and p_date between start_date and end_date
  ) then raise exception 'El día del itinerario debe estar dentro de las fechas del viaje.'; end if;
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
  v_activity_status := case p_status when 'paid' then 'paid'::public.activity_status when 'confirmed' then 'reserved'::public.activity_status else 'planned'::public.activity_status end;

  if p_expense_id is not null then
    select * into v_expense from public.expenses where id = p_expense_id and trip_id = p_trip_id for update;
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
          actual_cost=case when p_status='paid' then p_amount else null end,cost_scope=case when p_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,status=v_activity_status,
          optional=coalesce(p_optional,false),updated_by=auth.uid()
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

create or replace function public.save_expense_plan_v2(
  p_expense_id uuid, p_trip_id uuid, p_title text, p_category text, p_amount numeric,
  p_status text, p_included boolean, p_amount_basis text, p_occurrence_pricing text,
  p_occurrences jsonb, p_place text, p_notes text, p_optional boolean
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense public.expenses%rowtype;
  v_expense_id uuid;
  v_legacy_activity_id uuid;
  v_activity_id uuid;
  v_first_activity_id uuid;
  v_item jsonb;
  v_step jsonb;
  v_step_id uuid;
  v_kept_step_ids uuid[];
  v_step_position integer;
  v_steps_total numeric(14,2);
  v_activity_steps_total numeric(14,2);
  v_date date;
  v_start_time time;
  v_end_time time;
  v_kept_ids uuid[] := array[]::uuid[];
  v_activity_category text;
  v_activity_status public.activity_status;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if length(trim(coalesce(p_title,''))) = 0 then raise exception 'El nombre no puede estar vacío.'; end if;
  if length(trim(coalesce(p_category,''))) = 0 then raise exception 'La categoría no puede estar vacía.'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'El importe no puede ser negativo.'; end if;
  if p_status not in ('estimated','confirmed','paid') then raise exception 'Estado de gasto inválido.'; end if;
  if p_amount_basis not in ('per_person','group') then raise exception 'Base de importe inválida.'; end if;
  if p_occurrence_pricing not in ('total','per_occurrence') then raise exception 'Cálculo de repeticiones inválido.'; end if;
  if p_occurrences is not null and jsonb_typeof(p_occurrences) <> 'array' then raise exception 'Los días del itinerario no son válidos.'; end if;

  v_activity_category := case
    when lower(p_category) like any(array['%transporte%','%micro%','%uber%','%taxi%']) then 'transport'
    when lower(p_category) like '%aloj%' then 'lodging'
    when lower(p_category) like any(array['%comida%','%cena%','%almuerzo%']) then 'food'
    when lower(p_category) like '%museo%' then 'museum'
    when lower(p_category) like any(array['%salida%','%noche%','%boliche%']) then 'nightlife'
    when lower(p_category) like any(array['%entrada%','%recital%']) then 'event'
    else 'activity'
  end;
  v_activity_status := case p_status when 'paid' then 'paid'::public.activity_status when 'confirmed' then 'reserved'::public.activity_status else 'planned'::public.activity_status end;

  if p_expense_id is not null then
    select * into v_expense from public.expenses where id=p_expense_id and trip_id=p_trip_id for update;
    if not found then raise exception 'No se encontró el gasto.'; end if;
    v_expense_id := v_expense.id;
    v_legacy_activity_id := v_expense.activity_id;
    update public.expenses
    set title=trim(p_title),category=trim(p_category),amount=p_amount,status=p_status,
        included=coalesce(p_included,false),amount_basis=p_amount_basis,occurrence_pricing=p_occurrence_pricing,
        place=nullif(trim(coalesce(p_place,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),
        optional=coalesce(p_optional,false)
    where id=v_expense_id;
  else
    insert into public.expenses(trip_id,title,category,amount,currency,status,scope,included,amount_basis,occurrence_pricing,place,notes,optional,created_by)
    select p_trip_id,trim(p_title),trim(p_category),p_amount,trip.currency,p_status,'per_person',
      coalesce(p_included,false),p_amount_basis,p_occurrence_pricing,nullif(trim(coalesce(p_place,'')),''),
      nullif(trim(coalesce(p_notes,'')),''),coalesce(p_optional,false),auth.uid()
    from public.trips trip where trip.id=p_trip_id
    returning id into v_expense_id;
  end if;

  if v_expense_id is null then raise exception 'No se pudo guardar el gasto.'; end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_occurrences,'[]'::jsonb))
  loop
    v_activity_id := nullif(v_item->>'id','')::uuid;
    v_date := nullif(v_item->>'date','')::date;
    v_start_time := nullif(v_item->>'start_time','')::time;
    v_end_time := nullif(v_item->>'end_time','')::time;
    if v_date is null then raise exception 'Cada aparición debe tener un día.'; end if;
    if not exists(select 1 from public.trips where id=p_trip_id and v_date between start_date and end_date) then
      raise exception 'Los días del itinerario deben estar dentro de las fechas del viaje.';
    end if;

    if v_activity_id is null then
      insert into public.activities(trip_id,expense_id,date,start_time,end_time,title,category,place,notes,estimated_cost,actual_cost,cost_scope,status,optional,created_by,updated_by)
      values(p_trip_id,v_expense_id,v_date,v_start_time,v_end_time,trim(p_title),v_activity_category,
        nullif(trim(coalesce(p_place,'')),''),nullif(trim(coalesce(p_notes,'')),''),p_amount,
        case when p_status='paid' then p_amount else null end,
        case when p_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
        v_activity_status,coalesce(p_optional,false),auth.uid(),auth.uid())
      returning id into v_activity_id;
    else
      update public.activities
      set expense_id=v_expense_id,date=v_date,start_time=v_start_time,end_time=v_end_time,title=trim(p_title),
          category=v_activity_category,place=nullif(trim(coalesce(p_place,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),
          estimated_cost=p_amount,actual_cost=case when p_status='paid' then p_amount else null end,
          cost_scope=case when p_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
          status=v_activity_status,optional=coalesce(p_optional,false),updated_by=auth.uid()
      where id=v_activity_id and trip_id=p_trip_id
        and (expense_id=v_expense_id or (expense_id is null and id=v_legacy_activity_id));
      if not found then raise exception 'Una aparición del itinerario no pertenece a este gasto.'; end if;
    end if;

    if v_item ? 'steps' and jsonb_typeof(v_item->'steps') <> 'array' then
      raise exception 'Las paradas de una aparición no son válidas.';
    end if;
    v_kept_step_ids := array[]::uuid[];
    v_step_position := 0;
    for v_step in select value from jsonb_array_elements(coalesce(v_item->'steps','[]'::jsonb))
    loop
      if length(trim(coalesce(v_step->>'title',''))) = 0 then
        raise exception 'Cada parada debe tener un nombre.';
      end if;
      if nullif(v_step->>'amount','') is null or (v_step->>'amount')::numeric < 0 then
        raise exception 'El importe de cada parada debe ser cero o mayor.';
      end if;
      v_step_id := nullif(v_step->>'id','')::uuid;
      if v_step_id is null then
        insert into public.activity_steps(trip_id,activity_id,title,amount,start_time,end_time,place,notes,optional,position,created_by)
        values(p_trip_id,v_activity_id,trim(v_step->>'title'),(v_step->>'amount')::numeric,nullif(v_step->>'start_time','')::time,
          nullif(v_step->>'end_time','')::time,nullif(trim(coalesce(v_step->>'place','')),''),
          nullif(trim(coalesce(v_step->>'notes','')),''),coalesce((v_step->>'optional')::boolean,false),
          v_step_position,auth.uid())
        returning id into v_step_id;
      else
        update public.activity_steps
        set title=trim(v_step->>'title'),amount=(v_step->>'amount')::numeric,start_time=nullif(v_step->>'start_time','')::time,
            end_time=nullif(v_step->>'end_time','')::time,place=nullif(trim(coalesce(v_step->>'place','')),''),
            notes=nullif(trim(coalesce(v_step->>'notes','')),''),
            optional=coalesce((v_step->>'optional')::boolean,false),position=v_step_position
        where id=v_step_id and activity_id=v_activity_id and trip_id=p_trip_id;
        if not found then raise exception 'Una parada no pertenece a esta aparición.'; end if;
      end if;
      if v_step_id=any(v_kept_step_ids) then raise exception 'Hay una parada repetida en el formulario.'; end if;
      v_kept_step_ids := array_append(v_kept_step_ids,v_step_id);
      v_step_position := v_step_position + 1;
    end loop;

    delete from public.activity_steps
    where activity_id=v_activity_id
      and (cardinality(v_kept_step_ids)=0 or not (id=any(v_kept_step_ids)));

    if cardinality(v_kept_step_ids)>0 then
      select coalesce(sum(amount),0) into v_activity_steps_total
      from public.activity_steps where activity_id=v_activity_id;
      update public.activities
      set estimated_cost=v_activity_steps_total,
          actual_cost=case when p_status='paid' then v_activity_steps_total else null end
      where id=v_activity_id;
    end if;

    if v_activity_id=any(v_kept_ids) then raise exception 'Hay una aparición repetida en el formulario.'; end if;
    v_kept_ids := array_append(v_kept_ids,v_activity_id);
  end loop;

  delete from public.activities
  where expense_id=v_expense_id and (cardinality(v_kept_ids)=0 or not (id=any(v_kept_ids)));

  if exists(
    select 1 from public.activity_steps step
    join public.activities activity on activity.id=step.activity_id
    where activity.expense_id=v_expense_id
  ) then
    select coalesce(sum(step.amount),0) into v_steps_total
    from public.activity_steps step
    join public.activities activity on activity.id=step.activity_id
    where activity.expense_id=v_expense_id;
    update public.expenses
    set amount=v_steps_total,occurrence_pricing='total'
    where id=v_expense_id;
  end if;

  select id into v_first_activity_id from public.activities
  where expense_id=v_expense_id order by date,start_time nulls last,id limit 1;

  if v_first_activity_id is null then
    update public.expenses set activity_id=null,expense_date=null,itinerary_start_time=null,itinerary_end_time=null
    where id=v_expense_id;
  else
    update public.expenses expense
    set activity_id=v_first_activity_id,expense_date=activity.date,
        itinerary_start_time=activity.start_time,itinerary_end_time=activity.end_time
    from public.activities activity
    where expense.id=v_expense_id and activity.id=v_first_activity_id;
  end if;
  return v_expense_id;
end;
$$;

create or replace function public.delete_expense_plan(p_expense_id uuid, p_trip_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
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

revoke all on function public.save_expense_plan(uuid,uuid,text,text,numeric,text,boolean,text,date,time,time,text,text,boolean) from public, anon;
revoke all on function public.save_expense_plan_v2(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) from public, anon;
revoke all on function public.delete_expense_plan(uuid,uuid) from public, anon;
revoke all on function public.move_reservation(uuid,uuid,integer) from public, anon;
revoke all on function public.set_trip_base_place(uuid,uuid) from public, anon;
grant execute on function public.save_expense_plan(uuid,uuid,text,text,numeric,text,boolean,text,date,time,time,text,text,boolean) to authenticated;
grant execute on function public.save_expense_plan_v2(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) to authenticated;
grant execute on function public.delete_expense_plan(uuid,uuid) to authenticated;
grant execute on function public.move_reservation(uuid,uuid,integer) to authenticated;
grant execute on function public.set_trip_base_place(uuid,uuid) to authenticated;

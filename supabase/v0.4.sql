-- TripMate v0.4 migration
-- Ejecutar una vez en SQL Editor sobre una base existente con v0.3 aplicada.
-- No elimina gastos, actividades ni importes existentes.

alter table public.expenses
  add column if not exists amount_basis text not null default 'per_person',
  add column if not exists itinerary_start_time time,
  add column if not exists itinerary_end_time time,
  add column if not exists place text,
  add column if not exists optional boolean not null default false;

alter table public.expenses
  drop constraint if exists expenses_amount_basis_valid;
alter table public.expenses
  add constraint expenses_amount_basis_valid
  check (amount_basis in ('per_person', 'group'));

alter table public.expenses
  drop constraint if exists expenses_amount_nonnegative;
alter table public.expenses
  add constraint expenses_amount_nonnegative check (amount >= 0) not valid;

alter table public.expenses
  drop constraint if exists expenses_title_not_blank;
alter table public.expenses
  add constraint expenses_title_not_blank check (length(trim(title)) > 0) not valid;

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
revoke all on function public.delete_expense_plan(uuid,uuid) from public, anon;
revoke all on function public.move_reservation(uuid,uuid,integer) from public, anon;
grant execute on function public.save_expense_plan(uuid,uuid,text,text,numeric,text,boolean,text,date,time,time,text,text,boolean) to authenticated;
grant execute on function public.delete_expense_plan(uuid,uuid) to authenticated;
grant execute on function public.move_reservation(uuid,uuid,integer) to authenticated;

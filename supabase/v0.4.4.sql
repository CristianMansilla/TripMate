-- TripMate v0.4.4: actividades independientes del presupuesto
-- Ejecutar una vez después de v0.4.3. No modifica actividades existentes.

create or replace function public.save_activity_plan(
  p_activity_id uuid, p_trip_id uuid, p_expected_updated_at timestamptz,
  p_title text, p_date date, p_start_time time, p_end_time time,
  p_category text, p_place text, p_notes text, p_status text, p_optional boolean,
  p_cost_mode text, p_cost_amount numeric, p_cost_amount_basis text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_activity public.activities%rowtype;
  v_activity_id uuid;
  v_expense_id uuid;
  v_expense_category text;
  v_expense_status text;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if length(trim(coalesce(p_title,'')))=0 then raise exception 'El nombre no puede estar vacío.'; end if;
  if p_date is null or not exists(
    select 1 from public.trips where id=p_trip_id and p_date between start_date and end_date
  ) then raise exception 'El día debe estar dentro de las fechas del viaje.'; end if;
  if p_start_time is not null and p_end_time is not null and p_end_time<=p_start_time then
    raise exception 'La hora de fin debe ser posterior a la hora de inicio.';
  end if;
  if p_category is null or p_category not in ('transport','lodging','food','activity','museum','nightlife','event','other') then
    raise exception 'La categoría no es válida.';
  end if;
  if p_status is null or p_status not in ('idea','planned','reserved','paid','done') then
    raise exception 'El estado no es válido.';
  end if;
  if p_cost_mode is null or p_cost_mode not in ('none','new') then raise exception 'La opción de costo no es válida.'; end if;
  if p_cost_mode='new' then
    if p_cost_amount is null or p_cost_amount<0 then raise exception 'El costo debe ser cero o mayor.'; end if;
    if p_cost_amount_basis is null or p_cost_amount_basis not in ('per_person','group') then
      raise exception 'La base del costo no es válida.';
    end if;
  end if;

  if p_activity_id is not null then
    select * into v_activity from public.activities
    where id=p_activity_id and trip_id=p_trip_id for update;
    if not found then raise exception 'No se encontró la actividad.'; end if;
    if v_activity.expense_id is not null then
      raise exception 'Esta actividad tiene un gasto vinculado. Editala desde Presupuesto.';
    end if;
    if p_expected_updated_at is null or v_activity.updated_at is distinct from p_expected_updated_at then
      raise exception 'La actividad cambió mientras la estabas editando. Tus cambios no se guardaron. Cerrá y volvé a abrirla para revisar la versión actual.';
    end if;
  end if;

  if p_activity_id is null then
    insert into public.activities(
      trip_id,date,start_time,end_time,title,category,place,notes,estimated_cost,actual_cost,
      cost_scope,status,optional,created_by,updated_by
    ) values(
      p_trip_id,p_date,p_start_time,p_end_time,trim(p_title),p_category,
      nullif(trim(coalesce(p_place,'')),''),nullif(trim(coalesce(p_notes,'')),''),
      case when p_cost_mode='new' then p_cost_amount else 0 end,
      case when p_cost_mode='new' and p_status='paid' then p_cost_amount else null end,
      case when p_cost_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
      p_status::public.activity_status,coalesce(p_optional,false),auth.uid(),auth.uid()
    ) returning id into v_activity_id;
  else
    update public.activities set
      date=p_date,start_time=p_start_time,end_time=p_end_time,title=trim(p_title),category=p_category,
      place=nullif(trim(coalesce(p_place,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),
      estimated_cost=case when p_cost_mode='new' then p_cost_amount else estimated_cost end,
      actual_cost=case when p_cost_mode='new' and p_status='paid' then p_cost_amount
        when p_cost_mode='new' then null else actual_cost end,
      cost_scope=case when p_cost_mode='new' and p_cost_amount_basis='group' then 'shared'::public.cost_scope
        when p_cost_mode='new' then 'per_person'::public.cost_scope else cost_scope end,
      status=p_status::public.activity_status,optional=coalesce(p_optional,false),updated_by=auth.uid()
    where id=p_activity_id and trip_id=p_trip_id returning id into v_activity_id;
  end if;

  if p_cost_mode='new' then
    v_expense_category:=case p_category
      when 'transport' then 'Transporte' when 'lodging' then 'Alojamiento'
      when 'food' then 'Comidas' when 'museum' then 'Museos'
      when 'nightlife' then 'Salidas' when 'event' then 'Entradas' else 'Paseos' end;
    v_expense_status:=case when p_status='paid' then 'paid' when p_status='reserved' then 'confirmed' else 'estimated' end;
    insert into public.expenses(
      trip_id,activity_id,title,category,amount,currency,status,scope,included,amount_basis,
      occurrence_pricing,expense_date,itinerary_start_time,itinerary_end_time,place,notes,optional,created_by
    ) select
      p_trip_id,v_activity_id,trim(p_title),v_expense_category,p_cost_amount,trip.currency,
      v_expense_status,case when p_cost_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
      true,p_cost_amount_basis,'total',p_date,p_start_time,p_end_time,
      nullif(trim(coalesce(p_place,'')),''),nullif(trim(coalesce(p_notes,'')),''),coalesce(p_optional,false),auth.uid()
    from public.trips trip where trip.id=p_trip_id returning id into v_expense_id;
    if v_expense_id is null then raise exception 'No se pudo crear el gasto de la actividad.'; end if;
    update public.activities set expense_id=v_expense_id where id=v_activity_id and trip_id=p_trip_id;
  end if;

  return v_activity_id;
end;
$$;

create or replace function public.delete_activity_plan(p_activity_id uuid,p_trip_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if exists(select 1 from public.activities where id=p_activity_id and trip_id=p_trip_id and expense_id is not null) then
    raise exception 'Esta actividad tiene un gasto vinculado. Eliminala desde Presupuesto.';
  end if;
  delete from public.activities where id=p_activity_id and trip_id=p_trip_id and expense_id is null;
  if not found then raise exception 'No se encontró la actividad.'; end if;
end;
$$;

revoke all on function public.save_activity_plan(uuid,uuid,timestamptz,text,date,time,time,text,text,text,text,boolean,text,numeric,text) from public, anon;
revoke all on function public.delete_activity_plan(uuid,uuid) from public, anon;
grant execute on function public.save_activity_plan(uuid,uuid,timestamptz,text,date,time,time,text,text,text,text,boolean,text,numeric,text) to authenticated;
grant execute on function public.delete_activity_plan(uuid,uuid) to authenticated;

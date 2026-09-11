-- TripMate v0.6: contrato transaccional para la ficha única
-- Ejecutar una vez después de v0.5.

begin;

-- Los elementos creados por el editor nuevo nacen como identidad propia y no
-- necesitan fingir que una de sus facetas ya existía.
alter table public.trip_items
  drop constraint if exists trip_items_origin_type_check;
alter table public.trip_items
  add constraint trip_items_origin_type_check
  check(origin_type in ('item','expense','activity','reservation'));

-- Cualquier escritura realizada todavía por una RPC v0.4 invalida la versión
-- de la ficha completa. Así el editor unificado detecta cambios concurrentes.
create or replace function public.touch_trip_item_from_facet()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='DELETE' then
    update public.trip_items set updated_at=now() where id=old.item_id;
  elsif tg_op='UPDATE' then
    update public.trip_items set updated_at=now()
    where id=new.item_id or (old.item_id is distinct from new.item_id and id=old.item_id);
  else
    update public.trip_items set updated_at=now() where id=new.item_id;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists activities_touch_trip_item on public.activities;
create trigger activities_touch_trip_item after insert or update or delete on public.activities
  for each row execute function public.touch_trip_item_from_facet();
drop trigger if exists expenses_touch_trip_item on public.expenses;
create trigger expenses_touch_trip_item after insert or update or delete on public.expenses
  for each row execute function public.touch_trip_item_from_facet();
drop trigger if exists reservations_touch_trip_item on public.reservations;
create trigger reservations_touch_trip_item after insert or update or delete on public.reservations
  for each row execute function public.touch_trip_item_from_facet();

create or replace function public.cleanup_empty_trip_item()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  -- save_trip_item_v1 puede reemplazar una faceta por otra dentro de la misma
  -- transacción. En ese intervalo la identidad no debe considerarse huérfana.
  if current_setting('tripmate.preserve_item_id',true)=old.item_id::text then return old; end if;
  if not exists(select 1 from public.activities where item_id=old.item_id)
    and not exists(select 1 from public.expenses where item_id=old.item_id)
    and not exists(select 1 from public.reservations where item_id=old.item_id)
  then
    delete from public.trip_items where id=old.item_id;
  end if;
  return old;
end;
$$;

create or replace function public.save_trip_item_v1(
  p_item_id uuid,
  p_trip_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_category text,
  p_place text,
  p_notes text,
  p_optional boolean,
  p_activities jsonb,
  p_expense jsonb,
  p_reservation jsonb
) returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_item public.trip_items%rowtype;
  v_item_id uuid;
  v_activity jsonb;
  v_activity_id uuid;
  v_first_activity_id uuid;
  v_kept_activity_ids uuid[]:=array[]::uuid[];
  v_activity_position integer:=0;
  v_step jsonb;
  v_step_id uuid;
  v_kept_step_ids uuid[];
  v_step_position integer;
  v_date date;
  v_start_time time;
  v_end_time time;
  v_activity_status public.activity_status;
  v_expense_id uuid;
  v_expense_amount numeric;
  v_expense_status text;
  v_amount_basis text;
  v_occurrence_pricing text;
  v_included boolean;
  v_reservation_id uuid;
  v_reservation_status public.reservation_status;
  v_priority text;
  v_due_date date;
  v_legacy_amount numeric;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if length(trim(coalesce(p_title,'')))=0 then raise exception 'El nombre no puede estar vacío.'; end if;
  if length(trim(coalesce(p_category,'')))=0 then raise exception 'El tipo no puede estar vacío.'; end if;
  if length(trim(p_category))>60 then raise exception 'El tipo no puede superar los 60 caracteres.'; end if;
  if p_activities is not null and jsonb_typeof(p_activities)<>'array' then raise exception 'El itinerario no es válido.'; end if;
  if p_expense is not null and jsonb_typeof(p_expense)<>'object' then raise exception 'El costo no es válido.'; end if;
  if p_reservation is not null and jsonb_typeof(p_reservation)<>'object' then raise exception 'La reserva no es válida.'; end if;
  if jsonb_array_length(coalesce(p_activities,'[]'::jsonb))=0 and p_expense is null and p_reservation is null then
    raise exception 'El elemento debe tener itinerario, costo o reserva.';
  end if;

  if p_item_id is null then
    v_item_id:=gen_random_uuid();
    insert into public.trip_items(
      id,trip_id,title,category,place,notes,optional,origin_type,origin_id,created_by
    ) values(
      v_item_id,p_trip_id,trim(p_title),trim(p_category),nullif(trim(coalesce(p_place,'')),''),
      nullif(trim(coalesce(p_notes,'')),''),coalesce(p_optional,false),'item',v_item_id,auth.uid()
    );
  else
    select * into v_item from public.trip_items
    where id=p_item_id and trip_id=p_trip_id for update;
    if not found then raise exception 'No se encontró el elemento del viaje.'; end if;
    if p_expected_updated_at is null or v_item.updated_at is distinct from p_expected_updated_at then
      raise exception 'El elemento cambió mientras lo estabas editando. Tus cambios no se guardaron. Cerrá y volvé a abrirlo para revisar la versión actual.';
    end if;
    v_item_id:=v_item.id;
    update public.trip_items set
      title=trim(p_title),category=trim(p_category),place=nullif(trim(coalesce(p_place,'')),''),
      notes=nullif(trim(coalesce(p_notes,'')),''),optional=coalesce(p_optional,false)
    where id=v_item_id;
  end if;
  perform set_config('tripmate.preserve_item_id',v_item_id::text,true);

  if p_expense is null then
    update public.activities set expense_id=null where item_id=v_item_id;
    update public.reservations set expense_id=null where item_id=v_item_id;
    delete from public.expenses where item_id=v_item_id;
  else
    v_expense_id:=nullif(p_expense->>'id','')::uuid;
    v_expense_amount:=nullif(p_expense->>'amount','')::numeric;
    v_expense_status:=coalesce(nullif(p_expense->>'status',''),'estimated');
    v_amount_basis:=coalesce(nullif(p_expense->>'amount_basis',''),'per_person');
    v_occurrence_pricing:=coalesce(nullif(p_expense->>'occurrence_pricing',''),'total');
    v_included:=coalesce((p_expense->>'included')::boolean,true);
    if v_expense_amount is null or v_expense_amount<0 then raise exception 'El costo debe ser cero o mayor.'; end if;
    if v_expense_status not in ('estimated','confirmed','paid') then raise exception 'El estado del costo no es válido.'; end if;
    if v_amount_basis not in ('per_person','group') then raise exception 'La base del costo no es válida.'; end if;
    if v_occurrence_pricing not in ('total','per_occurrence') then raise exception 'El cálculo de repeticiones no es válido.'; end if;

    if v_expense_id is null then
      select id into v_expense_id from public.expenses where item_id=v_item_id for update;
    else
      perform 1 from public.expenses where id=v_expense_id and item_id=v_item_id and trip_id=p_trip_id for update;
      if not found then raise exception 'El costo no pertenece a este elemento.'; end if;
    end if;
    if v_expense_id is null then
      insert into public.expenses(
        trip_id,item_id,activity_id,title,category,amount,currency,status,scope,included,
        amount_basis,occurrence_pricing,place,notes,optional,created_by
      ) select
        p_trip_id,v_item_id,null,trim(p_title),trim(p_category),v_expense_amount,trip.currency,
        v_expense_status,case when v_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
        v_included,v_amount_basis,v_occurrence_pricing,nullif(trim(coalesce(p_place,'')),''),
        nullif(trim(coalesce(p_notes,'')),''),coalesce(p_optional,false),auth.uid()
      from public.trips trip where trip.id=p_trip_id returning id into v_expense_id;
    else
      update public.expenses set
        activity_id=null,title=trim(p_title),category=trim(p_category),amount=v_expense_amount,
        status=v_expense_status,scope=case when v_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
        included=v_included,amount_basis=v_amount_basis,occurrence_pricing=v_occurrence_pricing,
        place=nullif(trim(coalesce(p_place,'')),''),notes=nullif(trim(coalesce(p_notes,'')),''),
        optional=coalesce(p_optional,false)
      where id=v_expense_id;
    end if;
  end if;

  for v_activity in select value from jsonb_array_elements(coalesce(p_activities,'[]'::jsonb)) loop
    v_activity_id:=nullif(v_activity->>'id','')::uuid;
    v_date:=nullif(v_activity->>'date','')::date;
    v_start_time:=nullif(v_activity->>'start_time','')::time;
    v_end_time:=nullif(v_activity->>'end_time','')::time;
    v_activity_status:=coalesce(nullif(v_activity->>'status',''),'planned')::public.activity_status;
    if v_date is null or not exists(
      select 1 from public.trips where id=p_trip_id and v_date between start_date and end_date
    ) then raise exception 'Cada día del itinerario debe estar dentro de las fechas del viaje.'; end if;
    if v_start_time is not null and v_end_time is not null and v_end_time<=v_start_time then
      raise exception 'La hora de fin debe ser posterior a la hora de inicio.';
    end if;

    if v_activity_id is null then
      insert into public.activities(
        trip_id,item_id,expense_id,date,start_time,end_time,title,category,place,notes,
        estimated_cost,actual_cost,cost_scope,status,optional,position,created_by,updated_by
      ) values(
        p_trip_id,v_item_id,v_expense_id,v_date,v_start_time,v_end_time,trim(p_title),trim(p_category),
        nullif(trim(coalesce(p_place,'')),''),nullif(trim(coalesce(p_notes,'')),''),
        coalesce(v_expense_amount,0),case when v_expense_status='paid' then v_expense_amount else null end,
        case when v_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
        v_activity_status,coalesce(p_optional,false),v_activity_position,auth.uid(),auth.uid()
      ) returning id into v_activity_id;
    else
      update public.activities set
        expense_id=v_expense_id,date=v_date,start_time=v_start_time,end_time=v_end_time,
        title=trim(p_title),category=trim(p_category),place=nullif(trim(coalesce(p_place,'')),''),
        notes=nullif(trim(coalesce(p_notes,'')),''),estimated_cost=coalesce(v_expense_amount,0),
        actual_cost=case when v_expense_status='paid' then v_expense_amount else null end,
        cost_scope=case when v_amount_basis='group' then 'shared'::public.cost_scope else 'per_person'::public.cost_scope end,
        status=v_activity_status,optional=coalesce(p_optional,false),position=v_activity_position,updated_by=auth.uid()
      where id=v_activity_id and item_id=v_item_id and trip_id=p_trip_id;
      if not found then raise exception 'Una aparición no pertenece a este elemento.'; end if;
    end if;
    if v_activity_id=any(v_kept_activity_ids) then raise exception 'Hay una aparición repetida en el formulario.'; end if;
    v_kept_activity_ids:=array_append(v_kept_activity_ids,v_activity_id);
    if v_first_activity_id is null then v_first_activity_id:=v_activity_id; end if;

    if v_activity ? 'steps' and jsonb_typeof(v_activity->'steps')<>'array' then raise exception 'Las paradas no son válidas.'; end if;
    v_kept_step_ids:=array[]::uuid[];
    v_step_position:=0;
    for v_step in select value from jsonb_array_elements(coalesce(v_activity->'steps','[]'::jsonb)) loop
      if length(trim(coalesce(v_step->>'title','')))=0 then raise exception 'Cada parada debe tener un nombre.'; end if;
      if coalesce(nullif(v_step->>'amount','')::numeric,0)<0 then raise exception 'El costo de una parada no puede ser negativo.'; end if;
      v_start_time:=nullif(v_step->>'start_time','')::time;
      v_end_time:=nullif(v_step->>'end_time','')::time;
      if v_start_time is not null and v_end_time is not null and v_end_time<=v_start_time then
        raise exception 'La hora de fin de una parada debe ser posterior a su inicio.';
      end if;
      v_step_id:=nullif(v_step->>'id','')::uuid;
      if v_step_id is null then
        insert into public.activity_steps(
          trip_id,activity_id,title,amount,start_time,end_time,place,notes,optional,position,created_by
        ) values(
          p_trip_id,v_activity_id,trim(v_step->>'title'),coalesce(nullif(v_step->>'amount','')::numeric,0),
          v_start_time,v_end_time,nullif(trim(coalesce(v_step->>'place','')),''),
          nullif(trim(coalesce(v_step->>'notes','')),''),coalesce((v_step->>'optional')::boolean,false),
          v_step_position,auth.uid()
        ) returning id into v_step_id;
      else
        update public.activity_steps set
          title=trim(v_step->>'title'),amount=coalesce(nullif(v_step->>'amount','')::numeric,0),
          start_time=v_start_time,end_time=v_end_time,place=nullif(trim(coalesce(v_step->>'place','')),''),
          notes=nullif(trim(coalesce(v_step->>'notes','')),''),optional=coalesce((v_step->>'optional')::boolean,false),
          position=v_step_position
        where id=v_step_id and activity_id=v_activity_id and trip_id=p_trip_id;
        if not found then raise exception 'Una parada no pertenece a esta aparición.'; end if;
      end if;
      if v_step_id=any(v_kept_step_ids) then raise exception 'Hay una parada repetida en el formulario.'; end if;
      v_kept_step_ids:=array_append(v_kept_step_ids,v_step_id);
      v_step_position:=v_step_position+1;
    end loop;
    delete from public.activity_steps
    where activity_id=v_activity_id and (cardinality(v_kept_step_ids)=0 or not(id=any(v_kept_step_ids)));
    v_activity_position:=v_activity_position+1;
  end loop;

  delete from public.activities
  where item_id=v_item_id and (cardinality(v_kept_activity_ids)=0 or not(id=any(v_kept_activity_ids)));

  if v_expense_id is not null then
    update public.expenses expense set
      activity_id=v_first_activity_id,expense_date=activity.date,
      itinerary_start_time=activity.start_time,itinerary_end_time=activity.end_time
    from (select * from public.activities where id=v_first_activity_id) activity
    where expense.id=v_expense_id;
    if v_first_activity_id is null then
      update public.expenses set activity_id=null,expense_date=null,
        itinerary_start_time=null,itinerary_end_time=null where id=v_expense_id;
    end if;
  end if;

  if p_reservation is null then
    delete from public.reservations where item_id=v_item_id;
  else
    if (select count(*) from public.reservations where item_id=v_item_id)>1 then
      raise exception 'Este elemento tiene más de una reserva y necesita revisión antes de editarlo.';
    end if;
    v_reservation_id:=nullif(p_reservation->>'id','')::uuid;
    v_reservation_status:=coalesce(nullif(p_reservation->>'status',''),'pending')::public.reservation_status;
    v_priority:=coalesce(nullif(p_reservation->>'priority',''),'medium');
    v_due_date:=nullif(p_reservation->>'due_date','')::date;
    v_legacy_amount:=nullif(p_reservation->>'legacy_amount','')::numeric;
    if v_priority not in ('high','medium','low') then raise exception 'La prioridad no es válida.'; end if;
    if v_legacy_amount is not null and v_legacy_amount<0 then raise exception 'El importe anterior no es válido.'; end if;
    if v_expense_id is not null then v_legacy_amount:=null; end if;
    if v_reservation_id is null then
      select id into v_reservation_id from public.reservations where item_id=v_item_id for update;
    else
      perform 1 from public.reservations where id=v_reservation_id and item_id=v_item_id and trip_id=p_trip_id for update;
      if not found then raise exception 'La reserva no pertenece a este elemento.'; end if;
    end if;
    if v_reservation_id is null then
      insert into public.reservations(
        trip_id,item_id,activity_id,expense_id,title,status,priority,due_date,notes,amount,position,created_by
      ) values(
        p_trip_id,v_item_id,v_first_activity_id,v_expense_id,trim(p_title),v_reservation_status,
        v_priority,v_due_date,nullif(trim(coalesce(p_notes,'')),''),v_legacy_amount,
        coalesce((select max(position)+1 from public.reservations where trip_id=p_trip_id),0),auth.uid()
      ) returning id into v_reservation_id;
    else
      update public.reservations set
        activity_id=v_first_activity_id,expense_id=v_expense_id,title=trim(p_title),status=v_reservation_status,
        priority=v_priority,due_date=v_due_date,notes=nullif(trim(coalesce(p_notes,'')),''),amount=v_legacy_amount
      where id=v_reservation_id;
    end if;
  end if;

  perform set_config('tripmate.preserve_item_id','',true);
  return v_item_id;
end;
$$;

create or replace function public.delete_trip_item_v1(
  p_item_id uuid,p_trip_id uuid,p_expected_updated_at timestamptz
) returns void
language plpgsql
security invoker
set search_path=public
as $$
declare v_updated_at timestamptz;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  select updated_at into v_updated_at from public.trip_items
  where id=p_item_id and trip_id=p_trip_id for update;
  if not found then raise exception 'No se encontró el elemento del viaje.'; end if;
  if p_expected_updated_at is null or v_updated_at is distinct from p_expected_updated_at then
    raise exception 'El elemento cambió mientras lo estabas editando. Cerrá y volvé a abrirlo antes de eliminarlo.';
  end if;
  delete from public.trip_items where id=p_item_id and trip_id=p_trip_id;
end;
$$;

revoke all on function public.save_trip_item_v1(uuid,uuid,timestamptz,text,text,text,text,boolean,jsonb,jsonb,jsonb) from public,anon;
revoke all on function public.delete_trip_item_v1(uuid,uuid,timestamptz) from public,anon;
grant execute on function public.save_trip_item_v1(uuid,uuid,timestamptz,text,text,text,text,boolean,jsonb,jsonb,jsonb) to authenticated;
grant execute on function public.delete_trip_item_v1(uuid,uuid,timestamptz) to authenticated;

commit;

-- Resultado esperado: las cuatro columnas deben devolver true.
select
  to_regprocedure('public.save_trip_item_v1(uuid,uuid,timestamp with time zone,text,text,text,text,boolean,jsonb,jsonb,jsonb)') is not null
    as unified_save_ready,
  to_regprocedure('public.delete_trip_item_v1(uuid,uuid,timestamp with time zone)') is not null
    as unified_delete_ready,
  (
    select count(distinct trigger_name)=3
    from information_schema.triggers
    where trigger_schema='public'
      and trigger_name in (
        'activities_touch_trip_item',
        'expenses_touch_trip_item',
        'reservations_touch_trip_item'
      )
  ) as legacy_version_tracking_ready,
  exists(
    select 1
    from pg_constraint
    where conrelid='public.trip_items'::regclass
      and conname='trip_items_origin_type_check'
      and pg_get_constraintdef(oid) like '%item%'
  ) as native_item_identity_ready;

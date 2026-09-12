-- TripMate v0.8: finalizacion explicita de actividades
-- Ejecutar una vez despues de v0.7.1.

begin;

alter table public.activities add column if not exists end_date date;

-- Las actividades historicas siguen representando exactamente el mismo dia.
update public.activities set end_date=date where end_date is null;

-- v0.6.1 tiene un constraint trigger diferido sobre activities. El backfill
-- debe ejecutarlo antes de volver a modificar la definicion de esta tabla.
set constraints all immediate;

alter table public.activities alter column end_date set not null;
alter table public.activities drop constraint if exists activities_end_date_check;
alter table public.activities add constraint activities_end_date_check
  check(end_date>=date) not valid;
alter table public.activities validate constraint activities_end_date_check;

create or replace function public.validate_activity_date_range()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_trip_start date;
  v_trip_end date;
begin
  new.end_date:=coalesce(new.end_date,new.date);
  select trip.start_date,trip.end_date into v_trip_start,v_trip_end
  from public.trips trip where trip.id=new.trip_id;
  if not found then raise exception 'No se encontro el viaje de la actividad.'; end if;
  if new.date is null or new.date<v_trip_start or new.date>v_trip_end
    or new.end_date<v_trip_start or new.end_date>v_trip_end then
    raise exception 'La actividad debe comenzar y finalizar dentro de las fechas del viaje.';
  end if;
  if new.end_date<new.date then
    raise exception 'La fecha de finalizacion no puede ser anterior al inicio.';
  end if;
  if new.end_date=new.date and new.start_time is not null and new.end_time is not null
    and new.end_time<=new.start_time then
    raise exception 'La hora de fin debe ser posterior a la hora de inicio.';
  end if;
  return new;
end;
$$;

drop trigger if exists activities_validate_date_range on public.activities;
create trigger activities_validate_date_range
  before insert or update of trip_id,date,end_date,start_time,end_time on public.activities
  for each row execute function public.validate_activity_date_range();

create or replace function public.validate_trip_activity_ranges()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if exists(
    select 1 from public.activities activity
    where activity.trip_id=new.id
      and (activity.date<new.start_date or activity.end_date>new.end_date)
  ) then
    raise exception 'Las nuevas fechas del viaje dejarian actividades fuera del rango.';
  end if;
  return new;
end;
$$;

drop trigger if exists trips_validate_activity_ranges on public.trips;
create trigger trips_validate_activity_ranges
  before update of start_date,end_date on public.trips
  for each row execute function public.validate_trip_activity_ranges();

create or replace function public.save_trip_item_v3(
  p_item_id uuid,
  p_trip_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_category text,
  p_place text,
  p_place_id uuid,
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
  v_item_id uuid;
  v_activity jsonb;
  v_normalized_activities jsonb:='[]'::jsonb;
  v_position integer;
  v_date date;
  v_end_date date;
  v_start_time time;
  v_end_time time;
  v_saved_activity_id uuid;
begin
  if p_activities is not null and jsonb_typeof(p_activities)<>'array' then
    raise exception 'El itinerario no es valido.';
  end if;

  for v_activity,v_position in
    select value,(ordinality-1)::integer
    from jsonb_array_elements(coalesce(p_activities,'[]'::jsonb)) with ordinality
  loop
    v_date:=nullif(v_activity->>'date','')::date;
    v_end_date:=coalesce(nullif(v_activity->>'end_date','')::date,v_date);
    v_start_time:=nullif(v_activity->>'start_time','')::time;
    v_end_time:=nullif(v_activity->>'end_time','')::time;

    if v_date is null or v_end_date is null or not exists(
      select 1 from public.trips trip
      where trip.id=p_trip_id
        and v_date between trip.start_date and trip.end_date
        and v_end_date between trip.start_date and trip.end_date
    ) then
      raise exception 'Cada actividad debe comenzar y finalizar dentro de las fechas del viaje.';
    end if;
    if v_end_date<v_date then
      raise exception 'La fecha de finalizacion no puede ser anterior al inicio.';
    end if;
    if v_end_date=v_date and v_start_time is not null and v_end_time is not null
      and v_end_time<=v_start_time then
      raise exception 'La hora de fin debe ser posterior a la hora de inicio.';
    end if;

    -- v2 delega en el contrato anterior, que no conocia cambios de dia. Se le
    -- entrega una hora compatible y luego se restaura el rango exacto abajo.
    if v_end_date>v_date and v_start_time is not null and v_end_time is not null
      and v_end_time<=v_start_time then
      v_activity:=jsonb_set(v_activity,'{end_time}','null'::jsonb,true);
    end if;
    v_normalized_activities:=v_normalized_activities || jsonb_build_array(v_activity);
  end loop;

  select public.save_trip_item_v2(
    p_item_id,p_trip_id,p_expected_updated_at,p_title,p_category,p_place,p_place_id,
    p_notes,p_optional,v_normalized_activities,p_expense,p_reservation
  ) into v_item_id;

  for v_activity,v_position in
    select value,(ordinality-1)::integer
    from jsonb_array_elements(coalesce(p_activities,'[]'::jsonb)) with ordinality
  loop
    v_end_date:=coalesce(nullif(v_activity->>'end_date','')::date,nullif(v_activity->>'date','')::date);
    v_end_time:=nullif(v_activity->>'end_time','')::time;
    update public.activities set end_date=v_end_date,end_time=v_end_time
    where item_id=v_item_id and trip_id=p_trip_id and position=v_position
    returning id into v_saved_activity_id;
    if not found then raise exception 'No se pudo guardar el rango de una actividad.'; end if;
    if nullif(v_activity->>'id','') is not null
      and v_saved_activity_id<>nullif(v_activity->>'id','')::uuid then
      raise exception 'Una actividad no pertenece a esta aparicion.';
    end if;
  end loop;

  update public.expenses expense set itinerary_end_time=activity.end_time
  from public.activities activity
  where expense.item_id=v_item_id and activity.item_id=v_item_id and activity.position=0;

  return v_item_id;
end;
$$;

revoke all on function public.validate_activity_date_range() from public,anon,authenticated;
revoke all on function public.validate_trip_activity_ranges() from public,anon,authenticated;
revoke all on function public.save_trip_item_v3(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_trip_item_v3(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb) to authenticated;

commit;

-- Resultado esperado: las cinco columnas deben devolver true.
select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='activities' and column_name='end_date' and is_nullable='NO'
  ) as activity_end_date_ready,
  not exists(select 1 from public.activities where end_date is null) as historical_backfill_ready,
  exists(
    select 1 from pg_trigger
    where tgrelid='public.activities'::regclass and tgname='activities_validate_date_range'
  ) as activity_range_guard_ready,
  exists(
    select 1 from pg_trigger
    where tgrelid='public.trips'::regclass and tgname='trips_validate_activity_ranges'
  ) as trip_range_guard_ready,
  to_regprocedure('public.save_trip_item_v3(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)') is not null
    as unified_save_v3_ready;

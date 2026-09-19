-- Keep date and end_date consistent while save_trip_item_v3 updates an existing activity.
create or replace function public.validate_activity_date_range()
returns trigger language plpgsql set search_path=public as $$
declare
  v_trip_start date;
  v_trip_end date;
begin
  new.end_date:=coalesce(new.end_date,new.date);

  -- save_trip_item_v1, used internally by v3, updates date before v3 applies
  -- end_date. Normalize only that controlled intermediate update.
  if tg_op='UPDATE'
    and current_setting('tripmate.sync_activity_range',true)='on'
    and new.date is distinct from old.date
    and new.end_date is not distinct from old.end_date
    and new.end_date<new.date then
    new.end_date:=new.date;
  end if;

  select trip.start_date,trip.end_date into v_trip_start,v_trip_end
  from public.trips trip where trip.id=new.trip_id;
  if not found then raise exception 'No se encontro el viaje de la actividad.'; end if;
  if new.date is null or new.date<v_trip_start or new.date>v_trip_end
    or new.end_date<v_trip_start or new.end_date>v_trip_end then
    raise exception 'La actividad debe comenzar y finalizar dentro de las fechas del viaje.';
  end if;
  if new.end_date<new.date then raise exception 'La fecha de finalizacion no puede ser anterior al inicio.'; end if;
  if new.end_date=new.date and new.start_time is not null and new.end_time is not null and new.end_time<=new.start_time then
    raise exception 'La hora de fin debe ser posterior a la hora de inicio.';
  end if;
  return new;
end;
$$;

create or replace function public.save_trip_item_v3(
  p_item_id uuid,p_trip_id uuid,p_expected_updated_at timestamptz,
  p_title text,p_category text,p_place text,p_place_id uuid,p_notes text,p_optional boolean,
  p_activities jsonb,p_expense jsonb,p_reservation jsonb
) returns uuid
language plpgsql security invoker set search_path=public as $$
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
  if p_activities is not null and jsonb_typeof(p_activities)<>'array' then raise exception 'El itinerario no es valido.'; end if;
  for v_activity,v_position in
    select value,(ordinality-1)::integer
    from jsonb_array_elements(coalesce(p_activities,'[]'::jsonb)) with ordinality
  loop
    v_date:=nullif(v_activity->>'date','')::date;
    v_end_date:=coalesce(nullif(v_activity->>'end_date','')::date,v_date);
    v_start_time:=nullif(v_activity->>'start_time','')::time;
    v_end_time:=nullif(v_activity->>'end_time','')::time;
    if v_date is null or v_end_date is null or not exists(
      select 1 from public.trips trip where trip.id=p_trip_id
        and v_date between trip.start_date and trip.end_date
        and v_end_date between trip.start_date and trip.end_date
    ) then raise exception 'Cada actividad debe comenzar y finalizar dentro de las fechas del viaje.'; end if;
    if v_end_date<v_date then raise exception 'La fecha de finalizacion no puede ser anterior al inicio.'; end if;
    if v_end_date=v_date and v_start_time is not null and v_end_time is not null and v_end_time<=v_start_time then
      raise exception 'La hora de fin debe ser posterior a la hora de inicio.';
    end if;
    if v_end_date>v_date and v_start_time is not null and v_end_time is not null and v_end_time<=v_start_time then
      v_activity:=jsonb_set(v_activity,'{end_time}','null'::jsonb,true);
    end if;
    v_normalized_activities:=v_normalized_activities || jsonb_build_array(v_activity);
  end loop;

  perform set_config('tripmate.sync_activity_range','on',true);
  select public.save_trip_item_v2(
    p_item_id,p_trip_id,p_expected_updated_at,p_title,p_category,p_place,p_place_id,
    p_notes,p_optional,v_normalized_activities,p_expense,p_reservation
  ) into v_item_id;
  perform set_config('tripmate.sync_activity_range','off',true);

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
    if nullif(v_activity->>'id','') is not null and v_saved_activity_id<>nullif(v_activity->>'id','')::uuid then
      raise exception 'Una actividad no pertenece a esta aparicion.';
    end if;
  end loop;
  update public.expenses expense set itinerary_end_time=activity.end_time
  from public.activities activity
  where expense.item_id=v_item_id and activity.item_id=v_item_id and activity.position=0;
  return v_item_id;
end;
$$;

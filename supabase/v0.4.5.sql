-- TripMate v0.4.5: paradas simples desde Itinerario
-- Ejecutar una vez después de v0.4.4. Conserva el precio principal.

create or replace function public.save_activity_plan_v2(
  p_activity_id uuid, p_trip_id uuid, p_expected_updated_at timestamptz,
  p_title text, p_date date, p_start_time time, p_end_time time,
  p_category text, p_place text, p_notes text, p_status text, p_optional boolean,
  p_cost_mode text, p_cost_amount numeric, p_cost_amount_basis text,
  p_steps jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_activity_id uuid;
  v_step jsonb;
  v_step_id uuid;
  v_kept_ids uuid[]:=array[]::uuid[];
  v_position integer:=0;
  v_step_start time;
  v_step_end time;
  v_category text;
  v_base_category text;
begin
  if p_steps is not null and jsonb_typeof(p_steps)<>'array' then
    raise exception 'Las paradas no son válidas.';
  end if;

  v_category:=trim(coalesce(p_category,''));
  if length(v_category)=0 then v_category:='other'; end if;
  if length(v_category)>60 then raise exception 'El tipo no puede superar los 60 caracteres.'; end if;
  v_base_category:=case when v_category in (
    'transport','lodging','food','activity','museum','nightlife','event','other'
  ) then v_category else 'other' end;

  v_activity_id:=public.save_activity_plan(
    p_activity_id,p_trip_id,p_expected_updated_at,p_title,p_date,p_start_time,p_end_time,
    v_base_category,p_place,p_notes,p_status,p_optional,p_cost_mode,p_cost_amount,p_cost_amount_basis
  );

  update public.activities set category=v_category
  where id=v_activity_id and trip_id=p_trip_id;
  if v_base_category='other' and v_category<>'other' and p_cost_mode='new' then
    update public.expenses expense set category=v_category
    from public.activities activity
    where activity.id=v_activity_id and activity.expense_id=expense.id and expense.trip_id=p_trip_id;
  end if;

  for v_step in select value from jsonb_array_elements(coalesce(p_steps,'[]'::jsonb))
  loop
    if length(trim(coalesce(v_step->>'title','')))=0 then raise exception 'Cada parada debe tener un nombre.'; end if;
    v_step_start:=nullif(v_step->>'start_time','')::time;
    v_step_end:=nullif(v_step->>'end_time','')::time;
    if v_step_start is not null and v_step_end is not null and v_step_end<=v_step_start then
      raise exception 'La hora de fin de una parada debe ser posterior a su inicio.';
    end if;
    if coalesce(nullif(v_step->>'amount','')::numeric,0)<0 then
      raise exception 'El costo de una parada no puede ser negativo.';
    end if;
    v_step_id:=nullif(v_step->>'id','')::uuid;
    if v_step_id is null then
      insert into public.activity_steps(
        trip_id,activity_id,title,amount,start_time,end_time,place,notes,optional,position,created_by
      ) values(
        p_trip_id,v_activity_id,trim(v_step->>'title'),coalesce(nullif(v_step->>'amount','')::numeric,0),
        v_step_start,v_step_end,nullif(trim(coalesce(v_step->>'place','')),''),
        nullif(trim(coalesce(v_step->>'notes','')),''),coalesce((v_step->>'optional')::boolean,false),
        v_position,auth.uid()
      ) returning id into v_step_id;
    else
      update public.activity_steps set
        title=trim(v_step->>'title'),start_time=v_step_start,end_time=v_step_end,
        place=nullif(trim(coalesce(v_step->>'place','')),''),notes=nullif(trim(coalesce(v_step->>'notes','')),''),
        optional=coalesce((v_step->>'optional')::boolean,false),position=v_position
      where id=v_step_id and activity_id=v_activity_id and trip_id=p_trip_id;
      if not found then raise exception 'Una parada no pertenece a esta actividad.'; end if;
    end if;
    if v_step_id=any(v_kept_ids) then raise exception 'Hay una parada repetida en el formulario.'; end if;
    v_kept_ids:=array_append(v_kept_ids,v_step_id);
    v_position:=v_position+1;
  end loop;

  delete from public.activity_steps
  where activity_id=v_activity_id and (cardinality(v_kept_ids)=0 or not(id=any(v_kept_ids)));
  return v_activity_id;
end;
$$;

revoke all on function public.save_activity_plan_v2(uuid,uuid,timestamptz,text,date,time,time,text,text,text,text,boolean,text,numeric,text,jsonb) from public, anon;
grant execute on function public.save_activity_plan_v2(uuid,uuid,timestamptz,text,date,time,time,text,text,text,text,boolean,text,numeric,text,jsonb) to authenticated;

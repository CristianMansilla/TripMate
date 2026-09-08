-- TripMate v0.4.1 reliability patch
-- Ejecutar una vez después de v0.4. No borra ni reinterpreta datos existentes.

alter table public.reservations
  drop constraint if exists reservations_title_not_blank;
alter table public.reservations
  add constraint reservations_title_not_blank check(length(trim(title)) > 0) not valid;
alter table public.places
  drop constraint if exists places_name_not_blank;
alter table public.places
  add constraint places_name_not_blank check(length(trim(name)) > 0) not valid;
alter table public.packing_items
  drop constraint if exists packing_items_label_not_blank;
alter table public.packing_items
  add constraint packing_items_label_not_blank check(length(trim(label)) > 0) not valid;

-- Conserva el importe principal aunque el gasto tenga paradas. Las paradas son
-- un detalle informativo hasta que el usuario elija un modo de desglose explícito.
create or replace function public.save_expense_plan_v3(
  p_expense_id uuid, p_trip_id uuid, p_title text, p_category text, p_amount numeric,
  p_status text, p_included boolean, p_amount_basis text, p_occurrence_pricing text,
  p_occurrences jsonb, p_place text, p_notes text, p_optional boolean
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare v_expense_id uuid;
begin
  v_expense_id := public.save_expense_plan_v2(
    p_expense_id,p_trip_id,p_title,p_category,p_amount,p_status,p_included,
    p_amount_basis,p_occurrence_pricing,p_occurrences,p_place,p_notes,p_optional
  );
  update public.expenses
  set amount=p_amount,occurrence_pricing=p_occurrence_pricing
  where id=v_expense_id and trip_id=p_trip_id;
  update public.activities
  set estimated_cost=p_amount,
      actual_cost=case when p_status='paid' then p_amount else null end
  where expense_id=v_expense_id and trip_id=p_trip_id;
  return v_expense_id;
end;
$$;

-- Cambiar un importe no reenvía ocurrencias ni paradas antiguas del cliente.
create or replace function public.update_expense_amount(
  p_expense_id uuid,
  p_trip_id uuid,
  p_amount numeric
) returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if p_amount is null or p_amount < 0 then raise exception 'El importe debe ser cero o mayor.'; end if;
  update public.expenses set amount=p_amount
  where id=p_expense_id and trip_id=p_trip_id;
  if not found then raise exception 'No se encontró el gasto.'; end if;
  update public.activities
  set estimated_cost=p_amount,
      actual_cost=case when status='paid' then p_amount else actual_cost end
  where expense_id=p_expense_id and trip_id=p_trip_id;
end;
$$;

revoke all on function public.save_expense_plan_v3(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) from public, anon;
revoke all on function public.update_expense_amount(uuid,uuid,numeric) from public, anon;
grant execute on function public.save_expense_plan_v3(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) to authenticated;
grant execute on function public.update_expense_amount(uuid,uuid,numeric) to authenticated;

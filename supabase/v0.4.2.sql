-- TripMate v0.4.2: parche de concurrencia
-- Ejecutar una vez después de v0.4.1. No modifica datos existentes.

-- Bloquea el gasto y compara la versión que el usuario abrió antes de guardar
-- el plan completo. Así una edición antigua no pisa cambios más recientes.
create or replace function public.save_expense_plan_v4(
  p_expense_id uuid, p_trip_id uuid, p_expected_updated_at timestamptz,
  p_title text, p_category text, p_amount numeric, p_status text,
  p_included boolean, p_amount_basis text, p_occurrence_pricing text,
  p_occurrences jsonb, p_place text, p_notes text, p_optional boolean
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_updated_at timestamptz;
begin
  if p_expense_id is not null then
    select updated_at into v_current_updated_at
    from public.expenses
    where id=p_expense_id and trip_id=p_trip_id
    for update;
    if not found then raise exception 'No se encontró el gasto.'; end if;
    if p_expected_updated_at is null or v_current_updated_at is distinct from p_expected_updated_at then
      raise exception 'El gasto cambió mientras lo estabas editando. Tus cambios no se guardaron. Cerrá y volvé a abrir el gasto para revisar la versión actual.';
    end if;
  end if;

  return public.save_expense_plan_v3(
    p_expense_id,p_trip_id,p_title,p_category,p_amount,p_status,p_included,
    p_amount_basis,p_occurrence_pricing,p_occurrences,p_place,p_notes,p_optional
  );
end;
$$;

revoke all on function public.save_expense_plan_v4(uuid,uuid,timestamptz,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) from public, anon;
grant execute on function public.save_expense_plan_v4(uuid,uuid,timestamptz,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) to authenticated;

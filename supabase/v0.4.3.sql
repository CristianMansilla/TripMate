-- TripMate v0.4.3: integración entre Reservas y Presupuesto
-- Ejecutar una vez después de v0.4.2. No reinterpreta importes existentes.

alter table public.reservations
  add column if not exists expense_id uuid references public.expenses(id) on delete set null;

create unique index if not exists reservations_one_per_expense
  on public.reservations(expense_id)
  where expense_id is not null;

create or replace function public.validate_reservation_expense_trip()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.expense_id is not null and not exists(
    select 1 from public.expenses
    where id=new.expense_id and trip_id=new.trip_id
  ) then
    raise exception 'La reserva y el gasto deben pertenecer al mismo viaje.';
  end if;
  return new;
end;
$$;

drop trigger if exists reservations_expense_trip on public.reservations;
create trigger reservations_expense_trip
  before insert or update of expense_id,trip_id on public.reservations
  for each row execute function public.validate_reservation_expense_trip();

create or replace function public.save_reservation_plan(
  p_reservation_id uuid,
  p_trip_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_status text,
  p_priority text,
  p_due_date date,
  p_notes text,
  p_cost_mode text,
  p_expense_id uuid,
  p_new_expense_amount numeric,
  p_new_expense_amount_basis text,
  p_legacy_amount numeric
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reservation_id uuid;
  v_expense_id uuid;
  v_current_updated_at timestamptz;
begin
  if not public.can_edit_trip(p_trip_id) then raise exception 'No tenés permiso para editar este viaje.'; end if;
  if length(trim(coalesce(p_title,'')))=0 then raise exception 'El nombre no puede estar vacío.'; end if;
  if p_status is null or p_status not in ('watching','pending','reserved','paid') then raise exception 'Estado de reserva inválido.'; end if;
  if p_priority is null or p_priority not in ('high','medium','low') then raise exception 'Prioridad inválida.'; end if;
  if p_cost_mode is null or p_cost_mode not in ('none','legacy','existing','new') then raise exception 'La opción de costo no es válida.'; end if;

  if p_reservation_id is not null then
    select updated_at into v_current_updated_at
    from public.reservations
    where id=p_reservation_id and trip_id=p_trip_id
    for update;
    if not found then raise exception 'No se encontró la reserva.'; end if;
    if p_expected_updated_at is null or v_current_updated_at is distinct from p_expected_updated_at then
      raise exception 'La reserva cambió mientras la estabas editando. Tus cambios no se guardaron. Cerrá y volvé a abrirla para revisar la versión actual.';
    end if;
  elsif p_cost_mode='legacy' then
    raise exception 'Una reserva nueva no puede usar un importe anterior.';
  end if;

  if p_cost_mode='existing' then
    if p_expense_id is null then raise exception 'No se encontró el gasto seleccionado.'; end if;
    perform 1 from public.expenses where id=p_expense_id and trip_id=p_trip_id for update;
    if not found then raise exception 'No se encontró el gasto seleccionado.'; end if;
    if exists(
      select 1 from public.reservations
      where expense_id=p_expense_id and id is distinct from p_reservation_id
    ) then raise exception 'Ese gasto ya está vinculado a otra reserva.'; end if;
    v_expense_id:=p_expense_id;
  elsif p_cost_mode='new' then
    if p_new_expense_amount is null or p_new_expense_amount<0 then raise exception 'El costo debe ser cero o mayor.'; end if;
    if p_new_expense_amount_basis is null or p_new_expense_amount_basis not in ('per_person','group') then raise exception 'La base del costo no es válida.'; end if;
    insert into public.expenses(
      trip_id,title,category,amount,currency,status,scope,included,amount_basis,
      occurrence_pricing,created_by
    )
    select p_trip_id,trim(p_title),'Reservas',p_new_expense_amount,trip.currency,
      'estimated','per_person',true,p_new_expense_amount_basis,'total',auth.uid()
    from public.trips trip where trip.id=p_trip_id
    returning id into v_expense_id;
    if v_expense_id is null then raise exception 'No se pudo crear el gasto de la reserva.'; end if;
  elsif p_cost_mode='legacy' then
    if p_legacy_amount is null or p_legacy_amount<0 then raise exception 'El importe anterior no es válido.'; end if;
  end if;

  if p_reservation_id is null then
    insert into public.reservations(
      trip_id,expense_id,title,status,priority,due_date,notes,amount,position,created_by
    )
    values(
      p_trip_id,v_expense_id,trim(p_title),p_status::public.reservation_status,p_priority,p_due_date,
      nullif(trim(coalesce(p_notes,'')),''),case when p_cost_mode='legacy' then p_legacy_amount else null end,
      coalesce((select max(position)+1 from public.reservations where trip_id=p_trip_id),0),auth.uid()
    ) returning id into v_reservation_id;
  else
    update public.reservations
    set expense_id=v_expense_id,title=trim(p_title),status=p_status::public.reservation_status,priority=p_priority,
        due_date=p_due_date,notes=nullif(trim(coalesce(p_notes,'')),''),
        amount=case when p_cost_mode='legacy' then p_legacy_amount else null end
    where id=p_reservation_id and trip_id=p_trip_id
    returning id into v_reservation_id;
  end if;

  return v_reservation_id;
end;
$$;

revoke all on function public.save_reservation_plan(uuid,uuid,timestamptz,text,text,text,date,text,text,uuid,numeric,text,numeric) from public, anon;
grant execute on function public.save_reservation_plan(uuid,uuid,timestamptz,text,text,text,date,text,text,uuid,numeric,text,numeric) to authenticated;

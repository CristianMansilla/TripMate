-- TripMate v0.6.1: integridad de reservas de la ficha unica
-- Ejecutar una vez despues de v0.6.

begin;

do $$
begin
  if exists(
    select item_id
    from public.reservations
    group by item_id
    having count(*)>1
  ) then
    raise exception 'Hay elementos con mas de una reserva. Revisalos antes de aplicar v0.6.1.';
  end if;

  if exists(
    select 1
    from public.reservations reservation
    join public.trip_items item on item.id=reservation.item_id
    join public.trips trip on trip.id=item.trip_id
    left join lateral (
      select min(activity.date) as first_date
      from public.activities activity
      where activity.item_id=reservation.item_id
    ) itinerary on true
    where reservation.due_date is not null
      and reservation.due_date>coalesce(itinerary.first_date,trip.end_date)
  ) then
    raise exception 'Hay reservas cuya fecha limite es posterior al primer dia programado o al final del viaje. Revisalas antes de aplicar v0.6.1.';
  end if;
end;
$$;

create unique index if not exists reservations_one_per_trip_item
  on public.reservations(item_id);

create or replace function public.validate_trip_item_reservation_due_date()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item_id uuid;
  v_previous_item_id uuid;
  v_reservation record;
  v_first_activity_date date;
  v_trip_end_date date;
begin
  if tg_table_name='reservations' then
    if tg_op='DELETE' then return old; end if;
    v_item_id:=new.item_id;
  else
    v_item_id:=case when tg_op='DELETE' then old.item_id else new.item_id end;
    if tg_op='UPDATE' and old.item_id is distinct from new.item_id then
      v_previous_item_id:=old.item_id;
    end if;
  end if;

  for v_reservation in
    select reservation.item_id,reservation.due_date,item.trip_id
    from public.reservations reservation
    join public.trip_items item on item.id=reservation.item_id
    where reservation.due_date is not null
      and reservation.item_id in (v_item_id,v_previous_item_id)
  loop
    select min(activity.date) into v_first_activity_date
    from public.activities activity
    where activity.item_id=v_reservation.item_id;

    select trip.end_date into v_trip_end_date
    from public.trips trip
    where trip.id=v_reservation.trip_id;

    if v_reservation.due_date>coalesce(v_first_activity_date,v_trip_end_date) then
      raise exception 'La fecha para reservar no puede ser posterior al primer dia programado ni al final del viaje.';
    end if;
  end loop;

  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists reservations_validate_due_date on public.reservations;
create constraint trigger reservations_validate_due_date
  after insert or update or delete on public.reservations
  deferrable initially deferred
  for each row execute function public.validate_trip_item_reservation_due_date();

drop trigger if exists activities_validate_reservation_due_date on public.activities;
create constraint trigger activities_validate_reservation_due_date
  after insert or update or delete on public.activities
  deferrable initially deferred
  for each row execute function public.validate_trip_item_reservation_due_date();

revoke all on function public.validate_trip_item_reservation_due_date() from public,anon,authenticated;

commit;

-- Resultado esperado: las tres columnas deben devolver true.
select
  to_regclass('public.reservations_one_per_trip_item') is not null as one_reservation_per_item_ready,
  exists(
    select 1 from pg_trigger
    where tgrelid='public.reservations'::regclass
      and tgname='reservations_validate_due_date'
      and tgdeferrable
  ) as reservation_due_date_ready,
  exists(
    select 1 from pg_trigger
    where tgrelid='public.activities'::regclass
      and tgname='activities_validate_reservation_due_date'
      and tgdeferrable
  ) as activity_date_tracking_ready;

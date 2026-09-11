-- TripMate v0.7: trip_items como fuente de los campos comunes
-- Ejecutar una vez despues de v0.6.1.
--
-- Esta migracion no reescribe datos historicos. Las diferencias legacy quedan
-- preservadas y la aplicacion lee los campos comunes desde trip_items. Cuando
-- una faceta vuelva a guardar esos campos, se alineara con su identidad.

begin;

create or replace function public.use_trip_item_common_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_item public.trip_items%rowtype;
begin
  select * into v_item
  from public.trip_items item
  where item.id=new.item_id and item.trip_id=new.trip_id;
  if not found then
    raise exception 'La faceta y el elemento deben pertenecer al mismo viaje.';
  end if;

  new.title:=v_item.title;
  new.notes:=v_item.notes;
  if tg_table_name in ('activities','expenses') then
    new.category:=v_item.category;
    new.place:=v_item.place;
    new.optional:=v_item.optional;
  end if;
  return new;
end;
$$;

-- Los nombres colocan estos triggers despues de *_trip_item, que asigna
-- item_id a las escrituras realizadas por clientes anteriores.
drop trigger if exists activities_use_trip_item_common on public.activities;
create trigger activities_use_trip_item_common
  before insert or update of item_id,trip_id,title,category,place,notes,optional on public.activities
  for each row execute function public.use_trip_item_common_fields();

drop trigger if exists expenses_use_trip_item_common on public.expenses;
create trigger expenses_use_trip_item_common
  before insert or update of item_id,trip_id,title,category,place,notes,optional on public.expenses
  for each row execute function public.use_trip_item_common_fields();

drop trigger if exists reservations_use_trip_item_common on public.reservations;
create trigger reservations_use_trip_item_common
  before insert or update of item_id,trip_id,title,notes on public.reservations
  for each row execute function public.use_trip_item_common_fields();

revoke all on function public.use_trip_item_common_fields() from public,anon,authenticated;

commit;

-- Resultado esperado: las cuatro columnas deben devolver true.
select
  to_regprocedure('public.use_trip_item_common_fields()') is not null as canonical_fields_ready,
  exists(select 1 from pg_trigger where tgrelid='public.activities'::regclass and tgname='activities_use_trip_item_common') as activities_ready,
  exists(select 1 from pg_trigger where tgrelid='public.expenses'::regclass and tgname='expenses_use_trip_item_common') as expenses_ready,
  exists(select 1 from pg_trigger where tgrelid='public.reservations'::regclass and tgname='reservations_use_trip_item_common') as reservations_ready;

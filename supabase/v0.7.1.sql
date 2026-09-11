-- TripMate v0.7.1: vinculo estable entre fichas y lugares guardados
-- Ejecutar una vez despues de v0.7.

begin;

alter table public.trip_items add column if not exists place_id uuid;
alter table public.trip_items drop constraint if exists trip_items_place_id_fkey;
alter table public.trip_items add constraint trip_items_place_id_fkey
  foreign key(place_id) references public.places(id) on delete set null not valid;
alter table public.trip_items validate constraint trip_items_place_id_fkey;
create index if not exists trip_items_place_id_idx on public.trip_items(place_id);

create or replace function public.ensure_trip_item_place_reference()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.place_id is not null and not exists(
    select 1 from public.places place
    where place.id=new.place_id and place.trip_id=new.trip_id
  ) then
    raise exception 'El lugar guardado y el elemento deben pertenecer al mismo viaje.';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_items_place_reference on public.trip_items;
create trigger trip_items_place_reference
  before insert or update of place_id,trip_id on public.trip_items
  for each row execute function public.ensure_trip_item_place_reference();

create or replace function public.save_trip_item_v2(
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
  v_place text:=p_place;
begin
  if p_place_id is not null then
    select case
      when nullif(trim(place.address),'') is null or trim(place.address)=trim(place.name) then trim(place.name)
      else trim(place.name)||', '||trim(place.address)
    end into v_place
    from public.places place
    where place.id=p_place_id and place.trip_id=p_trip_id;
    if not found then
      raise exception 'El lugar guardado y el elemento deben pertenecer al mismo viaje.';
    end if;
  end if;

  select public.save_trip_item_v1(
    p_item_id,p_trip_id,p_expected_updated_at,p_title,p_category,v_place,p_notes,
    p_optional,p_activities,p_expense,p_reservation
  ) into v_item_id;

  update public.trip_items set place_id=p_place_id
  where id=v_item_id and trip_id=p_trip_id;
  if not found then raise exception 'No se pudo vincular el lugar al elemento.'; end if;
  return v_item_id;
end;
$$;

revoke all on function public.ensure_trip_item_place_reference() from public,anon,authenticated;
revoke all on function public.save_trip_item_v2(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.save_trip_item_v2(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb) to authenticated;

commit;

-- Resultado esperado: las cuatro columnas deben devolver true.
select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trip_items' and column_name='place_id'
  ) as place_link_ready,
  to_regprocedure('public.save_trip_item_v2(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)') is not null as unified_save_v2_ready,
  exists(select 1 from pg_trigger where tgrelid='public.trip_items'::regclass and tgname='trip_items_place_reference') as same_trip_guard_ready,
  to_regclass('public.trip_items_place_id_idx') is not null as place_link_index_ready;

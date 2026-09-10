-- TripMate v0.5: identidad estable de los elementos del viaje
-- Ejecutar una vez después de v0.4.5.
--
-- Esta migración es aditiva: no elimina ni reinterpreta actividades, gastos,
-- reservas, importes, estados, paradas o textos existentes. Crea una identidad
-- compartida usando exclusivamente vínculos explícitos ya guardados.

begin;

-- Evita que una escritura concurrente quede fuera del backfill.
lock table public.activities, public.expenses, public.reservations
  in share row exclusive mode;

do $$
begin
  if exists(
    select 1
    from public.activities activity
    join public.expenses expense on expense.id=activity.expense_id
    where activity.trip_id<>expense.trip_id
  ) or exists(
    select 1
    from public.expenses expense
    join public.activities activity on activity.id=expense.activity_id
    where activity.trip_id<>expense.trip_id
  ) then
    raise exception 'Hay vínculos entre actividades y gastos de viajes diferentes.';
  end if;

  if exists(
    select 1
    from public.expenses expense
    join public.activities activity on activity.id=expense.activity_id
    where activity.expense_id is not null and activity.expense_id<>expense.id
  ) then
    raise exception 'Hay actividades vinculadas a dos gastos diferentes.';
  end if;

  if exists(
    select 1
    from public.reservations reservation
    join public.expenses expense on expense.id=reservation.expense_id
    join public.activities activity on activity.id=reservation.activity_id
    where reservation.expense_id is not null
      and reservation.activity_id is not null
      and activity.expense_id is distinct from expense.id
      and expense.activity_id is distinct from activity.id
  ) then
    raise exception 'Hay reservas con vínculos de actividad y gasto incompatibles.';
  end if;
end;
$$;

create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  title text not null check(length(trim(title))>0),
  category text not null default 'other',
  place text,
  notes text,
  optional boolean not null default false,
  origin_type text not null check(origin_type in ('expense','activity','reservation')),
  origin_id uuid not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(origin_type,origin_id)
);

alter table public.activities add column if not exists item_id uuid;
alter table public.expenses add column if not exists item_id uuid;
alter table public.reservations add column if not exists item_id uuid;

-- Un gasto explícitamente enlazado a una o más actividades representa una sola
-- identidad. Para la ficha se toma la actividad principal como texto inicial;
-- el nombre original del gasto permanece intacto en expenses.title.
insert into public.trip_items(
  trip_id,title,category,place,notes,optional,origin_type,origin_id,
  created_by,created_at,updated_at
)
select
  expense.trip_id,
  coalesce(activity.title,expense.title),
  coalesce(nullif(activity.category,''),nullif(expense.category,''),'other'),
  coalesce(activity.place,expense.place),
  coalesce(activity.notes,expense.notes),
  coalesce(activity.optional,expense.optional,false),
  'expense',expense.id,
  coalesce(activity.created_by,expense.created_by),
  least(coalesce(activity.created_at,expense.created_at),expense.created_at),
  greatest(coalesce(activity.updated_at,expense.updated_at),expense.updated_at)
from public.expenses expense
left join lateral (
  select candidate.*
  from public.activities candidate
  where candidate.trip_id=expense.trip_id
    and (candidate.id=expense.activity_id or candidate.expense_id=expense.id)
  order by
    case when candidate.id=expense.activity_id then 0 else 1 end,
    candidate.date,candidate.start_time nulls last,candidate.id
  limit 1
) activity on true
where expense.item_id is null
on conflict(origin_type,origin_id) do nothing;

update public.expenses expense
set item_id=item.id
from public.trip_items item
where item.origin_type='expense'
  and item.origin_id=expense.id
  and item.trip_id=expense.trip_id
  and expense.item_id is null;

update public.activities activity
set item_id=expense.item_id
from public.expenses expense
where activity.expense_id=expense.id
  and activity.trip_id=expense.trip_id
  and activity.item_id is null;

-- Compatibilidad con vínculos antiguos que sólo existan desde expenses.
update public.activities activity
set item_id=expense.item_id
from public.expenses expense
where expense.activity_id=activity.id
  and activity.trip_id=expense.trip_id
  and activity.item_id is null;

-- Cada actividad todavía independiente obtiene su propia identidad.
insert into public.trip_items(
  trip_id,title,category,place,notes,optional,origin_type,origin_id,
  created_by,created_at,updated_at
)
select
  activity.trip_id,activity.title,coalesce(nullif(activity.category,''),'other'),
  activity.place,activity.notes,activity.optional,'activity',activity.id,
  activity.created_by,activity.created_at,activity.updated_at
from public.activities activity
where activity.item_id is null
on conflict(origin_type,origin_id) do nothing;

update public.activities activity
set item_id=item.id
from public.trip_items item
where item.origin_type='activity'
  and item.origin_id=activity.id
  and item.trip_id=activity.trip_id
  and activity.item_id is null;

-- Las reservas usan primero sus vínculos explícitos. No se compara ningún nombre.
update public.reservations reservation
set item_id=expense.item_id
from public.expenses expense
where reservation.expense_id=expense.id
  and reservation.trip_id=expense.trip_id
  and reservation.item_id is null;

update public.reservations reservation
set item_id=activity.item_id
from public.activities activity
where reservation.activity_id=activity.id
  and reservation.trip_id=activity.trip_id
  and reservation.item_id is null;

-- Una reserva sin actividad ni gasto sigue siendo un elemento válido del viaje.
insert into public.trip_items(
  trip_id,title,category,notes,origin_type,origin_id,
  created_by,created_at,updated_at
)
select
  reservation.trip_id,reservation.title,'reservation',reservation.notes,
  'reservation',reservation.id,reservation.created_by,
  reservation.created_at,reservation.updated_at
from public.reservations reservation
where reservation.item_id is null
on conflict(origin_type,origin_id) do nothing;

update public.reservations reservation
set item_id=item.id
from public.trip_items item
where item.origin_type='reservation'
  and item.origin_id=reservation.id
  and item.trip_id=reservation.trip_id
  and reservation.item_id is null;

do $$
begin
  if exists(select 1 from public.activities where item_id is null) then
    raise exception 'No se pudo asignar identidad a todas las actividades.';
  end if;
  if exists(select 1 from public.expenses where item_id is null) then
    raise exception 'No se pudo asignar identidad a todos los gastos.';
  end if;
  if exists(select 1 from public.reservations where item_id is null) then
    raise exception 'No se pudo asignar identidad a todas las reservas.';
  end if;
  if exists(
    select 1 from public.activities activity
    join public.trip_items item on item.id=activity.item_id
    where item.trip_id<>activity.trip_id
  ) or exists(
    select 1 from public.expenses expense
    join public.trip_items item on item.id=expense.item_id
    where item.trip_id<>expense.trip_id
  ) or exists(
    select 1 from public.reservations reservation
    join public.trip_items item on item.id=reservation.item_id
    where item.trip_id<>reservation.trip_id
  ) then
    raise exception 'El backfill generó una identidad en un viaje incorrecto.';
  end if;
  if exists(
    select 1
    from public.activities activity
    join public.expenses expense on expense.id=activity.expense_id
    where activity.item_id<>expense.item_id
  ) or exists(
    select 1
    from public.expenses expense
    join public.activities activity on activity.id=expense.activity_id
    where expense.item_id<>activity.item_id
  ) then
    raise exception 'Una actividad y su gasto no recibieron la misma identidad.';
  end if;
  if exists(
    select 1
    from public.reservations reservation
    join public.expenses expense on expense.id=reservation.expense_id
    where reservation.item_id<>expense.item_id
  ) or exists(
    select 1
    from public.reservations reservation
    join public.activities activity on activity.id=reservation.activity_id
    where reservation.item_id<>activity.item_id
  ) then
    raise exception 'Una reserva y su elemento vinculado no recibieron la misma identidad.';
  end if;
end;
$$;

alter table public.activities
  drop constraint if exists activities_item_id_fkey;
alter table public.activities
  add constraint activities_item_id_fkey foreign key(item_id)
  references public.trip_items(id) on delete cascade not valid;
alter table public.activities validate constraint activities_item_id_fkey;
alter table public.activities alter column item_id set not null;

alter table public.expenses
  drop constraint if exists expenses_item_id_fkey;
alter table public.expenses
  add constraint expenses_item_id_fkey foreign key(item_id)
  references public.trip_items(id) on delete cascade not valid;
alter table public.expenses validate constraint expenses_item_id_fkey;
alter table public.expenses alter column item_id set not null;

alter table public.reservations
  drop constraint if exists reservations_item_id_fkey;
alter table public.reservations
  add constraint reservations_item_id_fkey foreign key(item_id)
  references public.trip_items(id) on delete cascade not valid;
alter table public.reservations validate constraint reservations_item_id_fkey;
alter table public.reservations alter column item_id set not null;

create index if not exists activities_item_id_idx on public.activities(item_id);
create unique index if not exists expenses_one_per_trip_item on public.expenses(item_id);
create index if not exists reservations_item_id_idx on public.reservations(item_id);
create index if not exists trip_items_trip_id_idx on public.trip_items(trip_id);

create or replace function public.ensure_trip_item_reference()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_linked_item_id uuid;
  v_activity_item_id uuid;
  v_origin_type text;
begin
  -- NEW es un record distinto para cada tabla. Separar primero por tabla evita
  -- que PostgreSQL intente resolver columnas que esa relación no posee.
  if tg_table_name='activities' then
    if new.expense_id is not null then
      select expense.item_id into v_linked_item_id
      from public.expenses expense
      where expense.id=new.expense_id and expense.trip_id=new.trip_id;
      if not found then raise exception 'La actividad y el gasto deben pertenecer al mismo viaje.'; end if;
    end if;
  elsif tg_table_name='expenses' then
    if new.activity_id is not null then
      select activity.item_id into v_linked_item_id
      from public.activities activity
      where activity.id=new.activity_id and activity.trip_id=new.trip_id;
      if not found then raise exception 'La actividad y el gasto deben pertenecer al mismo viaje.'; end if;
    end if;
  elsif tg_table_name='reservations' then
    if new.expense_id is not null then
      select expense.item_id into v_linked_item_id
      from public.expenses expense
      where expense.id=new.expense_id and expense.trip_id=new.trip_id;
      if not found then raise exception 'La reserva y el gasto deben pertenecer al mismo viaje.'; end if;
    end if;
    if new.activity_id is not null then
      select activity.item_id into v_activity_item_id
      from public.activities activity
      where activity.id=new.activity_id and activity.trip_id=new.trip_id;
      if not found then raise exception 'La reserva y la actividad deben pertenecer al mismo viaje.'; end if;
      if v_linked_item_id is not null and v_activity_item_id<>v_linked_item_id then
        raise exception 'La actividad y el gasto de la reserva no representan el mismo elemento.';
      end if;
      v_linked_item_id:=coalesce(v_linked_item_id,v_activity_item_id);
    end if;
  end if;

  -- Las RPC v0.4 no conocen item_id. Si ya existe una faceta vinculada se usa
  -- su identidad; de lo contrario se crea una sin alterar los datos legacy.
  if v_linked_item_id is not null then
    new.item_id:=v_linked_item_id;
  elsif new.item_id is null then
    v_origin_type:=case tg_table_name
      when 'activities' then 'activity'
      when 'expenses' then 'expense'
      when 'reservations' then 'reservation'
      else null
    end;
    if v_origin_type is null then raise exception 'No se puede crear la identidad del elemento.'; end if;

    if tg_table_name='activities' then
      insert into public.trip_items(
        trip_id,title,category,place,notes,optional,origin_type,origin_id,
        created_by,created_at,updated_at
      ) values(
        new.trip_id,new.title,coalesce(nullif(new.category,''),'other'),new.place,new.notes,
        coalesce(new.optional,false),v_origin_type,new.id,coalesce(new.created_by,auth.uid()),
        coalesce(new.created_at,now()),coalesce(new.updated_at,now())
      ) returning id into new.item_id;
    elsif tg_table_name='expenses' then
      insert into public.trip_items(
        trip_id,title,category,place,notes,optional,origin_type,origin_id,
        created_by,created_at,updated_at
      ) values(
        new.trip_id,new.title,coalesce(nullif(new.category,''),'other'),new.place,new.notes,
        coalesce(new.optional,false),v_origin_type,new.id,coalesce(new.created_by,auth.uid()),
        coalesce(new.created_at,now()),coalesce(new.updated_at,now())
      ) returning id into new.item_id;
    else
      insert into public.trip_items(
        trip_id,title,category,notes,origin_type,origin_id,
        created_by,created_at,updated_at
      ) values(
        new.trip_id,new.title,'reservation',new.notes,v_origin_type,new.id,coalesce(new.created_by,auth.uid()),
        coalesce(new.created_at,now()),coalesce(new.updated_at,now())
      ) returning id into new.item_id;
    end if;
  end if;

  if not exists(
    select 1 from public.trip_items item
    where item.id=new.item_id and item.trip_id=new.trip_id
  ) then
    raise exception 'El elemento y sus datos deben pertenecer al mismo viaje.';
  end if;
  return new;
end;
$$;

drop trigger if exists activities_trip_item on public.activities;
create trigger activities_trip_item
  before insert or update of item_id,trip_id,expense_id on public.activities
  for each row execute function public.ensure_trip_item_reference();

drop trigger if exists expenses_trip_item on public.expenses;
create trigger expenses_trip_item
  before insert or update of item_id,trip_id,activity_id on public.expenses
  for each row execute function public.ensure_trip_item_reference();

drop trigger if exists reservations_trip_item on public.reservations;
create trigger reservations_trip_item
  before insert or update of item_id,trip_id,expense_id,activity_id on public.reservations
  for each row execute function public.ensure_trip_item_reference();

-- Los borrados de las RPC v0.4 eliminan facetas, no la nueva identidad. Se
-- limpia el padre únicamente cuando la última faceta desapareció.
create or replace function public.cleanup_empty_trip_item()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if not exists(select 1 from public.activities where item_id=old.item_id)
    and not exists(select 1 from public.expenses where item_id=old.item_id)
    and not exists(select 1 from public.reservations where item_id=old.item_id)
  then
    delete from public.trip_items where id=old.item_id;
  end if;
  return old;
end;
$$;

drop trigger if exists activities_cleanup_trip_item on public.activities;
create trigger activities_cleanup_trip_item after delete or update of item_id,expense_id on public.activities
  for each row execute function public.cleanup_empty_trip_item();
drop trigger if exists expenses_cleanup_trip_item on public.expenses;
create trigger expenses_cleanup_trip_item after delete or update of item_id,activity_id on public.expenses
  for each row execute function public.cleanup_empty_trip_item();
drop trigger if exists reservations_cleanup_trip_item on public.reservations;
create trigger reservations_cleanup_trip_item after delete or update of item_id,expense_id,activity_id on public.reservations
  for each row execute function public.cleanup_empty_trip_item();

create or replace function public.protect_trip_item_identity()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.trip_id is distinct from old.trip_id
    or new.origin_type is distinct from old.origin_type
    or new.origin_id is distinct from old.origin_id then
    raise exception 'La identidad de un elemento del viaje no se puede reemplazar.';
  end if;
  return new;
end;
$$;

drop trigger if exists trip_items_protect_identity on public.trip_items;
create trigger trip_items_protect_identity
  before update of trip_id,origin_type,origin_id on public.trip_items
  for each row execute function public.protect_trip_item_identity();

drop trigger if exists trip_items_updated on public.trip_items;
create trigger trip_items_updated before update on public.trip_items
  for each row execute function public.set_updated_at();

alter table public.trip_items enable row level security;
revoke all on table public.trip_items from public,anon;
grant select,insert,update,delete on table public.trip_items to authenticated;
drop policy if exists "members read trip items" on public.trip_items;
drop policy if exists "editors write trip items" on public.trip_items;
create policy "members read trip items" on public.trip_items
  for select to authenticated using(public.is_trip_member(trip_id));
create policy "editors write trip items" on public.trip_items
  for all to authenticated
  using(public.can_edit_trip(trip_id))
  with check(public.can_edit_trip(trip_id));

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename='trip_items'
    ) then
    alter publication supabase_realtime add table public.trip_items;
  end if;
end;
$$;

commit;

-- Resultado esperado del backfill, sólo con cantidades y sin datos personales.
select 'trip_items' as entity,count(*)::bigint as rows from public.trip_items
union all select 'activities',count(*) from public.activities where item_id is not null
union all select 'expenses',count(*) from public.expenses where item_id is not null
union all select 'reservations',count(*) from public.reservations where item_id is not null
order by entity;

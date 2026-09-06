-- TripMate v0.3 migration
-- Ejecutar una vez en SQL Editor sobre una base existente de TripMate v0.2.

alter table public.places
  add column if not exists is_base boolean not null default false;

create unique index if not exists places_one_base_per_trip
  on public.places (trip_id)
  where is_base;

alter table public.reservations
  add column if not exists position integer not null default 0;

alter table public.packing_items
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists assigned_label text;

update public.packing_items
  set assigned_to = created_by,
      assigned_label = null
  where assigned_to is null
    and created_by is not null;

drop policy if exists "members read packing" on public.packing_items;
drop policy if exists "editors write packing" on public.packing_items;
drop policy if exists "members read own packing" on public.packing_items;
drop policy if exists "editors insert own packing" on public.packing_items;
drop policy if exists "editors update own packing" on public.packing_items;
drop policy if exists "editors delete own packing" on public.packing_items;

create policy "members read own packing" on public.packing_items
  for select to authenticated
  using (
    public.is_trip_member(trip_id)
    and assigned_to = auth.uid()
  );

create policy "editors insert own packing" on public.packing_items
  for insert to authenticated
  with check (
    public.can_edit_trip(trip_id)
    and assigned_to = auth.uid()
  );

create policy "editors update own packing" on public.packing_items
  for update to authenticated
  using (
    public.can_edit_trip(trip_id)
    and assigned_to = auth.uid()
  )
  with check (
    public.can_edit_trip(trip_id)
    and assigned_to = auth.uid()
  );

create policy "editors delete own packing" on public.packing_items
  for delete to authenticated
  using (
    public.can_edit_trip(trip_id)
    and assigned_to = auth.uid()
  );

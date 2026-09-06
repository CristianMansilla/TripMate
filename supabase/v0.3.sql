-- TripMate v0.3 migration
-- Ejecutar una vez en SQL Editor sobre una base existente de TripMate v0.2.

alter table public.places
  add column if not exists is_base boolean not null default false;

create unique index if not exists places_one_base_per_trip
  on public.places (trip_id)
  where is_base;

alter table public.reservations
  add column if not exists position integer not null default 0;

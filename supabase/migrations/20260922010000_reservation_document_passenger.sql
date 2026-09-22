-- Identify the passenger covered by each private reservation document.

alter table public.reservation_documents
  add column passenger_label text not null default 'Sin asignar'
  check(length(trim(passenger_label)) between 1 and 80);

select exists(
  select 1 from information_schema.columns
  where table_schema='public'
    and table_name='reservation_documents'
    and column_name='passenger_label'
    and is_nullable='NO'
) as passenger_label_ready;

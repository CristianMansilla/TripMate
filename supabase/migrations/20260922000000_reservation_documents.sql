-- Private PDF documents attached to reservations.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('reservation-documents','reservation-documents',false,10485760,array['application/pdf'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create unique index if not exists reservations_id_trip_id_idx
  on public.reservations(id,trip_id);

create table public.reservation_documents(
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  reservation_id uuid not null,
  storage_path text not null unique check(length(trim(storage_path))>0),
  file_name text not null check(length(trim(file_name)) between 1 and 255),
  mime_type text not null default 'application/pdf' check(mime_type='application/pdf'),
  size_bytes bigint not null check(size_bytes between 1 and 10485760),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  constraint reservation_documents_reservation_trip_fkey
    foreign key(reservation_id,trip_id) references public.reservations(id,trip_id) on delete cascade
);

create index reservation_documents_reservation_idx
  on public.reservation_documents(reservation_id,created_at);

alter table public.reservation_documents enable row level security;
revoke all on table public.reservation_documents from public,anon;
grant select,insert,delete on table public.reservation_documents to authenticated;

create policy "members read reservation documents"
  on public.reservation_documents for select to authenticated
  using(public.is_trip_member(trip_id));

create policy "editors insert reservation documents"
  on public.reservation_documents for insert to authenticated
  with check(public.can_edit_trip(trip_id) and created_by=auth.uid());

create policy "editors delete reservation documents"
  on public.reservation_documents for delete to authenticated
  using(public.can_edit_trip(trip_id));

create policy "members read reservation files"
  on storage.objects for select to authenticated
  using(
    bucket_id='reservation-documents'
    and exists(
      select 1 from public.reservations reservation
      where reservation.trip_id::text=(storage.foldername(name))[1]
        and reservation.id::text=(storage.foldername(name))[2]
        and public.is_trip_member(reservation.trip_id)
    )
  );

create policy "editors upload reservation files"
  on storage.objects for insert to authenticated
  with check(
    bucket_id='reservation-documents'
    and exists(
      select 1 from public.reservations reservation
      where reservation.trip_id::text=(storage.foldername(name))[1]
        and reservation.id::text=(storage.foldername(name))[2]
        and public.can_edit_trip(reservation.trip_id)
    )
  );

create policy "editors delete reservation files"
  on storage.objects for delete to authenticated
  using(
    bucket_id='reservation-documents'
    and exists(
      select 1 from public.reservations reservation
      where reservation.trip_id::text=(storage.foldername(name))[1]
        and reservation.id::text=(storage.foldername(name))[2]
        and public.can_edit_trip(reservation.trip_id)
    )
  );

alter publication supabase_realtime add table public.reservation_documents;

select
  exists(select 1 from storage.buckets where id='reservation-documents' and public=false) as private_bucket_ready,
  to_regclass('public.reservation_documents') is not null as metadata_table_ready;

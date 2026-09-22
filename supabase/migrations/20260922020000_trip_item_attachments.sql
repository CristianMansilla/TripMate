-- Attach private PDFs and external links directly to a trip item.

create unique index if not exists trip_items_id_trip_id_idx
  on public.trip_items(id,trip_id);

alter table public.reservation_documents
  add column if not exists item_id uuid,
  add column if not exists attachment_type text not null default 'pdf',
  add column if not exists external_url text;

update public.reservation_documents document
set item_id=reservation.item_id
from public.reservations reservation
where document.reservation_id=reservation.id
  and document.trip_id=reservation.trip_id
  and document.item_id is null;

alter table public.reservation_documents
  alter column item_id set not null,
  alter column reservation_id drop not null,
  alter column storage_path drop not null,
  alter column mime_type drop not null,
  alter column size_bytes drop not null,
  alter column passenger_label drop not null;

alter table public.reservation_documents
  drop constraint if exists reservation_documents_reservation_trip_fkey,
  drop constraint if exists reservation_documents_item_trip_fkey,
  add constraint reservation_documents_item_trip_fkey
    foreign key(item_id,trip_id) references public.trip_items(id,trip_id) on delete cascade,
  drop constraint if exists reservation_documents_attachment_type_check,
  add constraint reservation_documents_attachment_type_check
    check(attachment_type in ('pdf','link')),
  drop constraint if exists reservation_documents_content_check,
  add constraint reservation_documents_content_check check(
    (attachment_type='pdf' and storage_path is not null and mime_type='application/pdf' and size_bytes between 1 and 10485760 and external_url is null and passenger_label is not null)
    or
    (attachment_type='link' and external_url like 'https://%' and storage_path is null and mime_type is null and size_bytes is null)
  );

create index if not exists reservation_documents_item_idx
  on public.reservation_documents(item_id,created_at);

alter table public.reservation_documents drop column reservation_id;
alter table public.reservation_documents rename to trip_item_attachments;
alter index if exists reservation_documents_item_idx rename to trip_item_attachments_item_idx;

revoke all on table public.trip_item_attachments from public,anon;
grant select,insert,delete on table public.trip_item_attachments to authenticated;

drop policy if exists "members read reservation documents" on public.trip_item_attachments;
drop policy if exists "editors insert reservation documents" on public.trip_item_attachments;
drop policy if exists "editors delete reservation documents" on public.trip_item_attachments;

create policy "members read trip item attachments"
  on public.trip_item_attachments for select to authenticated
  using(public.is_trip_member(trip_id));

create policy "editors insert trip item attachments"
  on public.trip_item_attachments for insert to authenticated
  with check(public.can_edit_trip(trip_id) and created_by=auth.uid());

create policy "editors delete trip item attachments"
  on public.trip_item_attachments for delete to authenticated
  using(public.can_edit_trip(trip_id));

drop policy if exists "members read reservation files" on storage.objects;
drop policy if exists "editors upload reservation files" on storage.objects;
drop policy if exists "editors delete reservation files" on storage.objects;
drop policy if exists "members read trip item attachment files" on storage.objects;
drop policy if exists "editors upload trip item attachment files" on storage.objects;
drop policy if exists "editors delete trip item attachment files" on storage.objects;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('trip-item-attachments','trip-item-attachments',false,10485760,array['application/pdf'])
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

create policy "members read trip item attachment files"
  on storage.objects for select to authenticated
  using(
    bucket_id='trip-item-attachments'
    and exists(
      select 1 from public.trip_item_attachments attachment
      where attachment.storage_path=name
        and public.is_trip_member(attachment.trip_id)
    )
  );

create policy "editors upload trip item attachment files"
  on storage.objects for insert to authenticated
  with check(
    bucket_id='trip-item-attachments'
    and exists(
      select 1 from public.trip_items item
      where item.trip_id::text=(storage.foldername(name))[1]
        and item.id::text=(storage.foldername(name))[2]
        and public.can_edit_trip(item.trip_id)
    )
  );

create policy "editors delete trip item attachment files"
  on storage.objects for delete to authenticated
  using(
    bucket_id='trip-item-attachments'
    and exists(
      select 1 from public.trip_item_attachments attachment
      where attachment.storage_path=name
        and public.can_edit_trip(attachment.trip_id)
    )
  );

select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trip_item_attachments' and column_name='item_id' and is_nullable='NO'
  ) as item_attachments_ready,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='trip_item_attachments' and column_name='external_url'
  ) as links_ready;

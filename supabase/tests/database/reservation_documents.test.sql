begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

select ok(to_regclass('public.reservation_documents') is not null,'existe la tabla de documentos de reserva');
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='reservation_documents' and column_name='passenger_label' and is_nullable='NO'),
  'cada documento conserva la identificacion del pasajero'
);
select ok(
  exists(select 1 from storage.buckets where id='reservation-documents' and public=false),
  'el bucket de documentos es privado'
);
select is(
  (select file_size_limit from storage.buckets where id='reservation-documents'),
  10485760::bigint,
  'el bucket limita cada PDF a 10 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id='reservation-documents'),
  array['application/pdf']::text[],
  'el bucket acepta unicamente PDF'
);
select ok(
  has_table_privilege('authenticated','public.reservation_documents','select'),
  'authenticated puede consultar metadatos sujetos a RLS'
);
select ok(
  not has_table_privilege('anon','public.reservation_documents','select'),
  'anon no puede consultar documentos'
);
select is(
  (select count(*) from pg_policies where policyname in (
    'members read reservation documents','editors insert reservation documents','editors delete reservation documents',
    'members read reservation files','editors upload reservation files','editors delete reservation files'
  )),
  6::bigint,
  'estan instaladas las politicas de metadatos y Storage'
);

select * from finish();
rollback;

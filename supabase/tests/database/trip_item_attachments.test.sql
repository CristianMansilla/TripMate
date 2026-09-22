begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

select ok(to_regclass('public.trip_item_attachments') is not null,'existe la tabla de adjuntos del elemento');
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='trip_item_attachments' and column_name='item_id' and is_nullable='NO'),
  'cada adjunto pertenece a un elemento del viaje'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='trip_item_attachments' and column_name='passenger_label' and is_nullable='YES'),
  'los PDF pueden identificar pasajero y los enlaces ser generales'
);
select ok(
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='trip_item_attachments' and column_name='external_url'),
  'los adjuntos admiten enlaces externos'
);
select ok(
  exists(select 1 from storage.buckets where id='trip-item-attachments' and public=false),
  'el bucket de adjuntos es privado'
);
select is(
  (select file_size_limit from storage.buckets where id='trip-item-attachments'),
  10485760::bigint,
  'el bucket limita cada PDF a 10 MB'
);
select is(
  (select allowed_mime_types from storage.buckets where id='trip-item-attachments'),
  array['application/pdf']::text[],
  'el bucket acepta unicamente PDF'
);
select ok(
  has_table_privilege('authenticated','public.trip_item_attachments','select'),
  'authenticated puede consultar metadatos sujetos a RLS'
);
select ok(
  not has_table_privilege('anon','public.trip_item_attachments','select'),
  'anon no puede consultar adjuntos'
);
select is(
  (select count(*) from pg_policies where policyname in (
    'members read trip item attachments','editors insert trip item attachments','editors delete trip item attachments',
    'members read trip item attachment files','editors upload trip item attachment files','editors delete trip item attachment files'
  )),
  6::bigint,
  'estan instaladas las politicas de metadatos y Storage'
);

select * from finish();
rollback;

begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users(id,email,raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000101','owner@tripmate.test','{}'::jsonb),
  ('00000000-0000-0000-0000-000000000102','viewer@tripmate.test','{}'::jsonb),
  ('00000000-0000-0000-0000-000000000103','outsider@tripmate.test','{}'::jsonb);

insert into public.trips(
  id,name,destination,country,start_date,end_date,currency,traveler_count,created_by
) values(
  '00000000-0000-0000-0000-000000000201','Viaje de prueba','Cordoba','Argentina',
  '2026-11-09','2026-11-15','ARS',2,'00000000-0000-0000-0000-000000000101'
);

insert into public.trip_members(trip_id,user_id,role)
values
  ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','owner'),
  ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000102','viewer');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',
  true
);

select ok(
  public.can_edit_trip('00000000-0000-0000-0000-000000000201'),
  'el owner puede editar el viaje'
);

select lives_ok(
  $$
    select public.save_trip_item_v3(
      null,
      '00000000-0000-0000-0000-000000000201',
      null,
      'Bus nocturno',
      'Transporte',
      'Terminal',
      null,
      'Prueba transaccional',
      false,
      '[{"date":"2026-11-09","end_date":"2026-11-10","start_time":"23:00","end_time":"01:00","status":"planned","steps":[]}]'::jsonb,
      '{"amount":"12000","status":"estimated","amount_basis":"group","occurrence_pricing":"total","included":true}'::jsonb,
      '{"status":"pending","priority":"high","due_date":"2026-11-08"}'::jsonb
    )
  $$,
  'la RPC crea agenda, costo y reserva en una transaccion'
);

select is(
  (select count(*) from public.trip_items where trip_id='00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'se crea una sola identidad'
);
select is(
  (select count(*) from public.activities where trip_id='00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'se crea una aparicion'
);
select is(
  (select count(*) from public.expenses where trip_id='00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'se crea un costo'
);
select is(
  (select count(*) from public.reservations where trip_id='00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'se crea una reserva'
);
select is(
  (
    select count(distinct item_id)
    from (
      select item_id from public.activities where trip_id='00000000-0000-0000-0000-000000000201'
      union all
      select item_id from public.expenses where trip_id='00000000-0000-0000-0000-000000000201'
      union all
      select item_id from public.reservations where trip_id='00000000-0000-0000-0000-000000000201'
    ) facets
  ),
  1::bigint,
  'todas las facetas comparten la misma identidad'
);
select is(
  (select (end_date::text||' '||end_time::text) from public.activities where trip_id='00000000-0000-0000-0000-000000000201'),
  '2026-11-10 01:00:00',
  'la actividad nocturna conserva fecha y hora de finalizacion'
);
select is(
  (select amount from public.expenses where trip_id='00000000-0000-0000-0000-000000000201'),
  12000::numeric,
  'el costo se guarda una sola vez'
);
select is(
  (select due_date from public.reservations where trip_id='00000000-0000-0000-0000-000000000201'),
  '2026-11-08'::date,
  'la fecha limite anterior al itinerario se conserva'
);

select lives_ok(
  $$
    select public.save_trip_item_v3(
      item.id,
      item.trip_id,
      item.updated_at,
      item.title,
      item.category,
      item.place,
      item.place_id,
      item.notes,
      item.optional,
      jsonb_build_array(jsonb_build_object(
        'id',activity.id,
        'date',activity.date,
        'end_date',activity.end_date,
        'start_time',activity.start_time,
        'end_time',activity.end_time,
        'status',activity.status,
        'steps','[]'::jsonb
      )),
      null,
      null
    )
    from public.trip_items item
    join public.activities activity on activity.item_id=item.id
    where item.trip_id='00000000-0000-0000-0000-000000000201'
  $$,
  'quitar costo y reserva conserva la agenda'
);
select is(
  (select count(*) from public.expenses where trip_id='00000000-0000-0000-0000-000000000201'),
  0::bigint,
  'el costo fue eliminado'
);
select is(
  (select count(*) from public.activities where trip_id='00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'la aparicion permanece'
);
select is(
  (select count(*) from public.trip_items where trip_id='00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'la identidad permanece'
);

select throws_ok(
  $$
    select public.save_trip_item_v3(
      null,'00000000-0000-0000-0000-000000000201',null,
      'Fuera de rango','Actividad',null,null,null,false,
      '[{"date":"2026-11-16","end_date":"2026-11-16","status":"planned","steps":[]}]'::jsonb,
      null,null
    )
  $$,
  'P0001',
  'Cada actividad debe comenzar y finalizar dentro de las fechas del viaje.',
  'la RPC rechaza fechas fuera del viaje'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000102","role":"authenticated"}',
  true
);
select throws_ok(
  $$
    select public.save_trip_item_v3(
      null,'00000000-0000-0000-0000-000000000201',null,
      'Sin permiso','Actividad',null,null,null,false,
      '[{"date":"2026-11-11","end_date":"2026-11-11","status":"planned","steps":[]}]'::jsonb,
      null,null
    )
  $$,
  'P0001',
  'No tenés permiso para editar este viaje.',
  'un viewer no puede guardar fichas'
);
select is(
  (select count(*) from public.trip_items where trip_id='00000000-0000-0000-0000-000000000201'),
  1::bigint,
  'un viewer puede leer las fichas compartidas'
);
select is_empty(
  $$
    update public.trip_items set title='Cambio no permitido'
    where trip_id='00000000-0000-0000-0000-000000000201'
    returning id
  $$,
  'un viewer no puede modificar datos compartidos directamente'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000103","role":"authenticated"}',
  true
);
select is(
  (select count(*) from public.trips where id='00000000-0000-0000-0000-000000000201'),
  0::bigint,
  'un usuario ajeno no puede leer el viaje'
);
select is(
  (select count(*) from public.trip_items where trip_id='00000000-0000-0000-0000-000000000201'),
  0::bigint,
  'un usuario ajeno no puede leer sus fichas'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000101","role":"authenticated"}',
  true
);
select throws_ok(
  $$
    select public.save_trip_item_v3(
      item.id,item.trip_id,'2000-01-01 00:00:00+00'::timestamptz,
      item.title,item.category,item.place,item.place_id,item.notes,item.optional,
      jsonb_build_array(jsonb_build_object(
        'id',activity.id,'date',activity.date,'end_date',activity.end_date,
        'start_time',activity.start_time,'end_time',activity.end_time,
        'status',activity.status,'steps','[]'::jsonb
      )),
      null,null
    )
    from public.trip_items item
    join public.activities activity on activity.item_id=item.id
    where item.trip_id='00000000-0000-0000-0000-000000000201'
  $$,
  'P0001',
  'El elemento cambió mientras lo estabas editando. Tus cambios no se guardaron. Cerrá y volvé a abrirlo para revisar la versión actual.',
  'una version desactualizada no pisa cambios recientes'
);
select lives_ok(
  $$
    select public.delete_trip_item_v1(item.id,item.trip_id,item.updated_at)
    from public.trip_items item
    where item.trip_id='00000000-0000-0000-0000-000000000201'
  $$,
  'el owner puede eliminar la ficha completa'
);
select is(
  (select count(*) from public.trip_items where trip_id='00000000-0000-0000-0000-000000000201'),
  0::bigint,
  'el borrado elimina la identidad'
);
select is(
  (
    select count(*) from (
      select id from public.activities where trip_id='00000000-0000-0000-0000-000000000201'
      union all
      select id from public.expenses where trip_id='00000000-0000-0000-0000-000000000201'
      union all
      select id from public.reservations where trip_id='00000000-0000-0000-0000-000000000201'
    ) facets
  ),
  0::bigint,
  'el borrado no deja facetas huerfanas'
);

select * from finish();
rollback;

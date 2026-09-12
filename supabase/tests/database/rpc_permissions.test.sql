begin;

create extension if not exists pgtap with schema extensions;
select plan(7);

select ok(
  has_function_privilege(
    'authenticated',
    'public.save_trip_item_v3(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'authenticated conserva la RPC unificada vigente'
);
select ok(
  (
    select prosecdef
    from pg_proc
    where oid='public.save_trip_item_v3(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)'::regprocedure
  ),
  'la RPC vigente puede delegar en implementaciones privadas'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.delete_trip_item_v1(uuid,uuid,timestamp with time zone)',
    'execute'
  ),
  'authenticated puede eliminar una ficha completa'
);
select ok(
  has_function_privilege('authenticated', 'public.update_expense_amount(uuid,uuid,numeric)', 'execute'),
  'authenticated conserva la edicion rapida de importes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_trip_item_v2(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)',
    'execute'
  ),
  'la version anterior del guardado unificado queda cerrada'
);
select is(
  (
    select count(*)
    from (values
      ('public.save_reservation_plan(uuid,uuid,timestamp with time zone,text,text,text,date,text,text,uuid,numeric,text,numeric)'),
      ('public.save_expense_plan(uuid,uuid,text,text,numeric,text,boolean,text,date,time without time zone,time without time zone,text,text,boolean)'),
      ('public.save_expense_plan_v2(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean)'),
      ('public.save_expense_plan_v3(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean)'),
      ('public.save_expense_plan_v4(uuid,uuid,timestamp with time zone,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean)'),
      ('public.delete_expense_plan(uuid,uuid)'),
      ('public.save_activity_plan(uuid,uuid,timestamp with time zone,text,date,time without time zone,time without time zone,text,text,text,text,boolean,text,numeric,text)'),
      ('public.save_activity_plan_v2(uuid,uuid,timestamp with time zone,text,date,time without time zone,time without time zone,text,text,text,text,boolean,text,numeric,text,jsonb)'),
      ('public.delete_activity_plan(uuid,uuid)'),
      ('public.save_trip_item_v1(uuid,uuid,timestamp with time zone,text,text,text,text,boolean,jsonb,jsonb,jsonb)')
    ) as legacy(signature)
    where has_function_privilege('authenticated', legacy.signature, 'execute')
  ),
  0::bigint,
  'ninguna RPC heredada de fichas sigue expuesta'
);
select ok(
  has_function_privilege('service_role', 'public.resolve_login_identifier(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.resolve_login_identifier(text)', 'execute')
    and not has_function_privilege('anon', 'public.resolve_login_identifier(text)', 'execute'),
  'la resolucion de usuario sigue limitada al servidor'
);

select * from finish();
rollback;

-- TripMate v0.8.1: una sola ruta publica de escritura para las fichas
-- Aplicar una vez despues de v0.8 en bases existentes.

begin;

-- v3 valida la membresia mediante auth.uid() y todos los identificadores contra
-- p_trip_id. Se ejecuta con el propietario solamente para poder delegar en sus
-- implementaciones v1/v2 una vez que dejan de ser publicas.
alter function public.save_trip_item_v3(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb
) security definer;

-- Estas funciones se conservan para documentar la evolucion y para que las
-- dependencias SQL historicas sigan resolviendo. La aplicacion actual ya no
-- las invoca: toda ficha se guarda por save_trip_item_v3.
revoke execute on function public.save_reservation_plan(uuid,uuid,timestamptz,text,text,text,date,text,text,uuid,numeric,text,numeric) from authenticated;
revoke execute on function public.save_expense_plan(uuid,uuid,text,text,numeric,text,boolean,text,date,time,time,text,text,boolean) from authenticated;
revoke execute on function public.save_expense_plan_v2(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) from authenticated;
revoke execute on function public.save_expense_plan_v3(uuid,uuid,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) from authenticated;
revoke execute on function public.save_expense_plan_v4(uuid,uuid,timestamptz,text,text,numeric,text,boolean,text,text,jsonb,text,text,boolean) from authenticated;
revoke execute on function public.delete_expense_plan(uuid,uuid) from authenticated;
revoke execute on function public.save_activity_plan(uuid,uuid,timestamptz,text,date,time,time,text,text,text,text,boolean,text,numeric,text) from authenticated;
revoke execute on function public.save_activity_plan_v2(uuid,uuid,timestamptz,text,date,time,time,text,text,text,text,boolean,text,numeric,text,jsonb) from authenticated;
revoke execute on function public.delete_activity_plan(uuid,uuid) from authenticated;
revoke execute on function public.save_trip_item_v1(uuid,uuid,timestamptz,text,text,text,text,boolean,jsonb,jsonb,jsonb) from authenticated;
revoke execute on function public.save_trip_item_v2(uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb) from authenticated;

commit;

select
  has_function_privilege(
    'authenticated',
    'public.save_trip_item_v3(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)',
    'execute'
  ) as unified_save_ready,
  (
    select prosecdef
    from pg_proc
    where oid='public.save_trip_item_v3(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)'::regprocedure
  ) as unified_save_can_delegate,
  not has_function_privilege(
    'authenticated',
    'public.save_trip_item_v2(uuid,uuid,timestamp with time zone,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb)',
    'execute'
  ) as legacy_save_closed;

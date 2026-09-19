-- CREATE OR REPLACE in the previous migration restored the default invoker
-- mode. v3 must delegate to the private v1/v2 implementations without making
-- those legacy functions callable from the client.
alter function public.save_trip_item_v3(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb
) security definer;

revoke all on function public.save_trip_item_v3(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb
) from public,anon;
grant execute on function public.save_trip_item_v3(
  uuid,uuid,timestamptz,text,text,text,uuid,text,boolean,jsonb,jsonb,jsonb
) to authenticated;

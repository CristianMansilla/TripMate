-- TripMate v0.4 - separación de actividades históricas restantes
-- Ejecutar una vez, después de v0.4-data-repair.sql.
-- No elimina registros. Si una validación falla, se revierte toda la operación.

begin;

do $$
declare
  trip_id_value uuid;
  currency_value text;
  actor_id_value uuid;
  wednesday_return_id uuid;
  boliche_activity_id uuid;
  matching_count integer;
begin
  select activity.trip_id, trip.currency, activity.created_by
  into trip_id_value, currency_value, actor_id_value
  from public.activities activity
  join public.trips trip on trip.id = activity.trip_id
  where activity.id = 'f9da917f-5a4a-4d31-88fb-5545a8e9b28e';

  if trip_id_value is null then
    raise exception 'Reparación cancelada: no se encontró el viaje histórico.';
  end if;

  select count(*) into matching_count
  from public.activities
  where trip_id = trip_id_value
    and id in (
      'f9da917f-5a4a-4d31-88fb-5545a8e9b28e',
      '113dd195-0ef6-4557-a446-990dc672e2fc',
      '4f0eaa6f-781e-4f94-8ca3-fa1f9d3ff0f7',
      '307e4d86-178f-4eea-a6c7-513c4fd216d2',
      'bb5f9dbe-8499-4cf3-a8b5-1aaf602ebce6',
      '59893f6d-5bae-4a3d-9056-ef8fd6523505',
      '0ed53cec-e4b5-4978-9893-336060fb35f5'
    );
  if matching_count <> 7 then
    raise exception 'Reparación cancelada: se esperaban 7 actividades y se encontraron %.', matching_count;
  end if;

  -- Centro histórico queda asociado al gasto del Museo Histórico UNC.
  update public.expenses expense
  set activity_id = activity.id,
      expense_date = activity.date,
      itinerary_start_time = activity.start_time,
      itinerary_end_time = activity.end_time,
      place = coalesce(expense.place, activity.place),
      notes = coalesce(expense.notes, activity.notes),
      optional = expense.optional or activity.optional
  from public.activities activity
  where expense.id = '6d9edb2d-1406-4e28-9ae3-a35074cc9a64'
    and activity.id = 'f9da917f-5a4a-4d31-88fb-5545a8e9b28e'
    and expense.trip_id = activity.trip_id
    and expense.activity_id is null;
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo vincular Centro histórico.'; end if;

  update public.activities activity
  set estimated_cost = expense.amount,
      actual_cost = case when expense.status = 'paid' then expense.amount else null end,
      cost_scope = 'per_person'::public.cost_scope
  from public.expenses expense
  where activity.id = 'f9da917f-5a4a-4d31-88fb-5545a8e9b28e'
    and expense.activity_id = activity.id;

  -- Actividades gratuitas o todavía sin precio.
  insert into public.expenses (
    trip_id, activity_id, title, category, amount, currency, status, scope,
    included, amount_basis, expense_date, itinerary_start_time,
    itinerary_end_time, place, notes, optional, created_by
  )
  select activity.trip_id, activity.id, activity.title, 'Paseos', 0,
    currency_value, 'estimated', 'per_person'::public.cost_scope, true,
    'per_person', activity.date, activity.start_time, activity.end_time,
    activity.place, activity.notes, activity.optional, coalesce(activity.created_by, actor_id_value)
  from public.activities activity
  where activity.id = '113dd195-0ef6-4557-a446-990dc672e2fc'
    and not exists (select 1 from public.expenses where activity_id = activity.id);
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo crear el gasto de Cerro de la Cruz.'; end if;

  update public.activities
  set estimated_cost = 0, actual_cost = null, cost_scope = 'per_person'::public.cost_scope
  where id = '113dd195-0ef6-4557-a446-990dc672e2fc';

  insert into public.expenses (
    trip_id, activity_id, title, category, amount, currency, status, scope,
    included, amount_basis, expense_date, itinerary_start_time,
    itinerary_end_time, place, notes, optional, created_by
  )
  select activity.trip_id, activity.id, activity.title, 'Entradas', 0,
    currency_value, 'estimated', 'per_person'::public.cost_scope, true,
    'per_person', activity.date, activity.start_time, activity.end_time,
    activity.place, activity.notes, activity.optional, coalesce(activity.created_by, actor_id_value)
  from public.activities activity
  where activity.id = '307e4d86-178f-4eea-a6c7-513c4fd216d2'
    and not exists (select 1 from public.expenses where activity_id = activity.id);
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo crear el gasto del recital.'; end if;

  update public.activities
  set estimated_cost = 0, actual_cost = null, cost_scope = 'per_person'::public.cost_scope
  where id = '307e4d86-178f-4eea-a6c7-513c4fd216d2';

  -- Separa el traslado a Kempes del fondo general de Uber sin aumentar el total.
  update public.expenses
  set amount = amount - 12500
  where id = 'a1ca0264-9d60-4806-b0bc-3d2c8a0973d9'
    and trip_id = trip_id_value
    and activity_id is null
    and amount >= 12500;
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo separar el traslado del fondo de Uber.'; end if;

  insert into public.expenses (
    trip_id, activity_id, title, category, amount, currency, status, scope,
    included, amount_basis, expense_date, itinerary_start_time,
    itinerary_end_time, place, notes, optional, created_by
  )
  select activity.trip_id, activity.id, activity.title, 'Transporte', 12500,
    currency_value, 'estimated', 'per_person'::public.cost_scope, true,
    'per_person', activity.date, activity.start_time, activity.end_time,
    activity.place, activity.notes, activity.optional, coalesce(activity.created_by, actor_id_value)
  from public.activities activity
  where activity.id = '4f0eaa6f-781e-4f94-8ca3-fa1f9d3ff0f7'
    and not exists (select 1 from public.expenses where activity_id = activity.id);
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo crear el gasto del traslado a Kempes.'; end if;

  update public.activities
  set estimated_cost = 12500, actual_cost = null, cost_scope = 'per_person'::public.cost_scope
  where id = '4f0eaa6f-781e-4f94-8ca3-fa1f9d3ff0f7';

  -- Miércoles: divide los 12.000 existentes en ida y vuelta de 6.000.
  update public.expenses
  set title = 'Córdoba → Carlos Paz · miércoles', amount = 6000
  where activity_id = '9d648be1-117b-4f2f-bbd7-6b0d7be3e27b'
    and amount = 12000;
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo dividir el transporte del miércoles.'; end if;

  update public.activities
  set title = 'Córdoba → Carlos Paz · miércoles', estimated_cost = 6000,
      actual_cost = null, cost_scope = 'per_person'::public.cost_scope
  where id = '9d648be1-117b-4f2f-bbd7-6b0d7be3e27b';

  insert into public.activities (
    trip_id, date, start_time, end_time, title, category, notes,
    estimated_cost, actual_cost, cost_scope, status, optional, created_by, updated_by
  ) values (
    trip_id_value, '2026-11-11', null, null, 'Carlos Paz → Córdoba · miércoles',
    'transport', 'Horario pendiente.', 6000, null, 'per_person'::public.cost_scope,
    'planned'::public.activity_status, false, actor_id_value, actor_id_value
  ) returning id into wednesday_return_id;

  insert into public.expenses (
    trip_id, activity_id, title, category, amount, currency, status, scope,
    included, amount_basis, expense_date, notes, created_by
  ) values (
    trip_id_value, wednesday_return_id, 'Carlos Paz → Córdoba · miércoles',
    'Transporte', 6000, currency_value, 'estimated',
    'per_person'::public.cost_scope, true, 'per_person', '2026-11-11',
    'Horario pendiente.', actor_id_value
  );

  -- Viernes/madrugada: divide el gasto de ida y vuelta entre las dos actividades existentes.
  update public.expenses expense
  set activity_id = activity.id,
      title = 'Córdoba → Carlos Paz · viernes',
      amount = 6000,
      expense_date = activity.date,
      itinerary_start_time = activity.start_time,
      itinerary_end_time = activity.end_time,
      place = coalesce(expense.place, activity.place),
      notes = coalesce(expense.notes, activity.notes)
  from public.activities activity
  where expense.id = 'b2f309ba-975c-49dc-bf32-19ffe4f30e06'
    and activity.id = 'bb5f9dbe-8499-4cf3-a8b5-1aaf602ebce6'
    and expense.activity_id is null
    and expense.amount = 12000;
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo vincular la ida del viernes.'; end if;

  update public.activities
  set title = 'Córdoba → Carlos Paz · viernes', estimated_cost = 6000,
      actual_cost = null, cost_scope = 'per_person'::public.cost_scope
  where id = 'bb5f9dbe-8499-4cf3-a8b5-1aaf602ebce6';

  insert into public.expenses (
    trip_id, activity_id, title, category, amount, currency, status, scope,
    included, amount_basis, expense_date, itinerary_start_time,
    itinerary_end_time, place, notes, optional, created_by
  )
  select activity.trip_id, activity.id, 'Carlos Paz → Córdoba · madrugada',
    'Transporte', 6000, currency_value, 'estimated',
    'per_person'::public.cost_scope, true, 'per_person', activity.date,
    activity.start_time, activity.end_time, activity.place, activity.notes,
    activity.optional, coalesce(activity.created_by, actor_id_value)
  from public.activities activity
  where activity.id = '59893f6d-5bae-4a3d-9056-ef8fd6523505'
    and not exists (select 1 from public.expenses where activity_id = activity.id);
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo vincular la vuelta del viernes.'; end if;

  update public.activities
  set title = 'Carlos Paz → Córdoba · madrugada', estimated_cost = 6000,
      actual_cost = null, cost_scope = 'per_person'::public.cost_scope
  where id = '59893f6d-5bae-4a3d-9056-ef8fd6523505';

  -- Separa la previa y el boliche. Bebidas continúa como gasto sin horario.
  update public.expenses expense
  set activity_id = activity.id,
      expense_date = activity.date,
      itinerary_start_time = activity.start_time,
      itinerary_end_time = activity.end_time,
      place = coalesce(expense.place, activity.place),
      notes = coalesce(expense.notes, activity.notes)
  from public.activities activity
  where expense.id = '9cf674ce-373e-44ff-8a7f-8ae13fa7268a'
    and activity.id = '0ed53cec-e4b5-4978-9893-336060fb35f5'
    and expense.activity_id is null;
  get diagnostics matching_count = row_count;
  if matching_count <> 1 then raise exception 'No se pudo vincular la previa.'; end if;

  update public.activities
  set title = 'Previa Carlos Paz', estimated_cost = 40000,
      actual_cost = null, cost_scope = 'per_person'::public.cost_scope
  where id = '0ed53cec-e4b5-4978-9893-336060fb35f5';

  insert into public.activities (
    trip_id, date, start_time, end_time, title, category, notes,
    estimated_cost, actual_cost, cost_scope, status, optional, created_by, updated_by
  )
  select expense.trip_id, '2026-11-14', null, null, expense.title, 'nightlife',
    'Horario pendiente.', expense.amount, null, 'per_person'::public.cost_scope,
    case expense.status
      when 'paid' then 'paid'::public.activity_status
      when 'confirmed' then 'reserved'::public.activity_status
      else 'planned'::public.activity_status
    end,
    false, coalesce(expense.created_by, actor_id_value), coalesce(expense.created_by, actor_id_value)
  from public.expenses expense
  where expense.id = '5a34ef9d-7829-4e7d-9e17-e418ee6006c6'
    and expense.activity_id is null
  returning id into boliche_activity_id;

  if boliche_activity_id is null then raise exception 'No se pudo crear la actividad del boliche.'; end if;

  update public.expenses
  set activity_id = boliche_activity_id,
      expense_date = '2026-11-14',
      itinerary_start_time = null,
      itinerary_end_time = null,
      notes = coalesce(notes, 'Horario pendiente.')
  where id = '5a34ef9d-7829-4e7d-9e17-e418ee6006c6';

  -- Todas las actividades anteriores y las dos nuevas deben terminar vinculadas.
  select count(*) into matching_count
  from public.activities activity
  where activity.id in (
      'f9da917f-5a4a-4d31-88fb-5545a8e9b28e',
      '113dd195-0ef6-4557-a446-990dc672e2fc',
      '4f0eaa6f-781e-4f94-8ca3-fa1f9d3ff0f7',
      '307e4d86-178f-4eea-a6c7-513c4fd216d2',
      'bb5f9dbe-8499-4cf3-a8b5-1aaf602ebce6',
      '59893f6d-5bae-4a3d-9056-ef8fd6523505',
      '0ed53cec-e4b5-4978-9893-336060fb35f5',
      wednesday_return_id,
      boliche_activity_id
    )
    and exists (select 1 from public.expenses expense where expense.activity_id = activity.id);

  if matching_count <> 9 then
    raise exception 'Validación final cancelada: sólo quedaron % de 9 actividades vinculadas.', matching_count;
  end if;

  raise notice 'Reparación completada: 7 casos resueltos y 2 actividades separadas.';
end;
$$;

commit;

select '7 casos resueltos y 2 actividades separadas correctamente' as resultado;

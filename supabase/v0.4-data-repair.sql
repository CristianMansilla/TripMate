-- TripMate v0.4 - reparación de vínculos históricos
-- Ejecutar una vez, después de aplicar v0.4.sql.
-- No crea ni elimina gastos o actividades. Toda la operación se confirma o se revierte junta.

begin;

do $$
declare
  links constant jsonb := '[
    {"activity_id":"5dd33987-59a9-44e5-a1c5-13dda2296498","expense_title":"Via Tac · Goya → Santa Fe"},
    {"activity_id":"ae20331b-0326-44e6-a824-805e626142a9","expense_title":"El Práctico · Santa Fe → Córdoba"},
    {"activity_id":"d186ed3e-1dfa-4f78-a292-8ccfe3dabbb5","expense_title":"Alojamiento · Vilaut + late checkout"},
    {"activity_id":"170a60e8-e5e1-47f4-a3c3-b481d376358f","expense_title":"Museo Ciencias Naturales"},
    {"activity_id":"2cb6e242-a895-4f38-9318-f02a3602bccb","expense_title":"Bachata martes"},
    {"activity_id":"c886c62b-f7c0-4077-a57f-665bad9bd1ad","expense_title":"Martes · cena + bares Güemes"},
    {"activity_id":"9d648be1-117b-4f2f-bbd7-6b0d7be3e27b","expense_title":"Córdoba ↔ Carlos Paz · miércoles"},
    {"activity_id":"ca40231f-7203-4e56-b351-b68fe92e323d","expense_title":"Aerosilla"},
    {"activity_id":"e981eb50-7858-4fa0-aaf5-5fa5d3c896e2","expense_title":"Miércoles · almuerzo Carlos Paz"},
    {"activity_id":"28814fa8-eeef-403f-89eb-a74ba38a018d","expense_title":"Lago / kayak / hidropedal / catamarán"},
    {"activity_id":"eea20cfa-da5c-43dd-8126-abdccce8cc27","expense_title":"Infinito Water Park · opcional"},
    {"activity_id":"d2e0bc0f-93a2-42d5-a348-4b00f9dfc2af","expense_title":"Bachata viernes"},
    {"activity_id":"1b1b1525-d5f3-4d69-97cd-7703aab7ddaa","expense_title":"El Práctico · Córdoba → Santa Fe"},
    {"activity_id":"c8766e60-7ae5-4cad-9ce2-65549dcf6485","expense_title":"Via Tac · Santa Fe → Goya"},
    {"activity_id":"5aa27469-4eac-4490-8dc2-ba42432b71c7","expense_title":"Tren de las Sierras · opcional"},
    {"activity_id":"8b51668e-53d2-49c6-a610-61907bbd02bb","expense_title":"Parque aéreo"}
  ]'::jsonb;
  link record;
  matching_count integer;
  repaired_count integer := 0;
begin
  for link in
    select *
    from jsonb_to_recordset(links) as item(activity_id uuid, expense_title text)
  loop
    select count(*) into matching_count
    from public.activities activity
    join public.expenses expense on expense.trip_id = activity.trip_id
    where activity.id = link.activity_id
      and expense.title = link.expense_title
      and (expense.activity_id is null or expense.activity_id = activity.id);

    if matching_count <> 1 then
      raise exception
        'Reparación cancelada para la actividad %: se esperaba un gasto y se encontraron %.',
        link.activity_id, matching_count;
    end if;

    update public.expenses expense
    set activity_id = activity.id,
        expense_date = activity.date,
        itinerary_start_time = activity.start_time,
        itinerary_end_time = activity.end_time,
        place = coalesce(expense.place, activity.place),
        notes = coalesce(expense.notes, activity.notes),
        optional = expense.optional or activity.optional
    from public.activities activity
    where activity.id = link.activity_id
      and expense.trip_id = activity.trip_id
      and expense.title = link.expense_title
      and (expense.activity_id is null or expense.activity_id = activity.id);

    -- El itinerario usa la misma base e importe que Presupuesto. No se inventa
    -- un precio nuevo: se reutiliza el valor existente en el gasto.
    update public.activities activity
    set estimated_cost = expense.amount,
        actual_cost = case when expense.status = 'paid' then expense.amount else null end,
        cost_scope = case
          when expense.amount_basis = 'group' then 'shared'::public.cost_scope
          else 'per_person'::public.cost_scope
        end,
        status = case expense.status
          when 'paid' then 'paid'::public.activity_status
          when 'confirmed' then 'reserved'::public.activity_status
          else 'planned'::public.activity_status
        end
    from public.expenses expense
    where activity.id = link.activity_id
      and expense.activity_id = activity.id;

    select count(*) into matching_count
    from public.activities activity
    join public.expenses expense on expense.activity_id = activity.id
    where activity.id = link.activity_id
      and expense.expense_date = activity.date
      and expense.amount = activity.estimated_cost
      and (
        (expense.amount_basis = 'group' and activity.cost_scope = 'shared')
        or (expense.amount_basis = 'per_person' and activity.cost_scope = 'per_person')
      );

    if matching_count <> 1 then
      raise exception
        'Reparación cancelada al validar la actividad %.', link.activity_id;
    end if;

    repaired_count := repaired_count + 1;
  end loop;

  if repaired_count <> 16 then
    raise exception
      'Reparación cancelada: sólo se procesaron % de 16 vínculos.', repaired_count;
  end if;

  raise notice 'Reparación completada: % gastos vinculados.', repaired_count;
end;
$$;

commit;

-- Casos dejados intencionalmente para revisión manual:
-- Centro histórico; Cerro de la Cruz nocturno; Traslado Vilaut → Kempes;
-- Romeo Santos + Prince Royce; Córdoba/Carlos Paz del viernes y madrugada;
-- Previa + boliche Carlos Paz.

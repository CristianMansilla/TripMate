# TripMate · dirección de producto

## Propuesta

Una sola fuente de verdad para un viaje compartido. La ficha de un elemento concentra sus datos comunes y puede tener agenda, costo y reserva sin convertirse en tres registros conceptualmente distintos para el usuario.

## Estado

Revisado el 10 de septiembre de 2026. `v0.5` incorporó la identidad estable `trip_items`; `v0.6` agregó el guardado transaccional de la ficha única; `v0.6.1` completó la integridad de reservas y las correcciones de UX detectadas en la auditoría posterior. `v0.7` está consolidando `trip_items` como fuente canónica para eliminar divergencias heredadas.

Los botones “Agregar actividad”, “Agregar gasto” y “Agregar reserva” se conservan dentro de sus secciones porque representan la intención inicial, no fuentes de datos distintas. Los tres abren el mismo editor, guardan mediante la misma RPC y permiten añadir las demás facetas.

## Principios UX

- **Una identidad:** editar desde cualquier sección abre la misma ficha.
- **Creación contextual explícita:** Datos primero y revisión obligatoria de la faceta elegida antes de crear.
- **Responsabilidades claras:** Itinerario organiza cuándo; Presupuesto cuánto; Reservas qué debe confirmarse.
- **Eliminación predecible:** quitar costo, reserva o agenda requiere confirmación y conserva las otras facetas.
- **Estados separados:** planificado, reservado y pagado no forman una única cadena obligatoria.
- **Un costo, una suma:** repetir una actividad no duplica un importe definido como total.
- **Complejidad optativa:** paradas, repeticiones y seguimiento aparecen sólo cuando hacen falta.
- **Categorías coherentes:** alias históricos se normalizan al guardar y al agrupar.
- **Costo de infraestructura contenido:** servicios externos opcionales, con alternativa manual y sin dependencia de planes pagos.
- **Mobile-first y accesible:** flujos habituales utilizables con teclado, lector y pantallas pequeñas.

## Navegación vigente

- Inicio / viajes
- Resumen
- Itinerario
- Presupuesto
- Reservas
- Lugares
- Valija
- Integrantes

No agregar pestañas para resolver problemas internos de una ficha. Las altas contextuales permanecen visibles en Itinerario, Presupuesto y Reservas.

## Próximas etapas

### Cerrar v0.6.1

- Aplicar y validar la migración incremental.
- Probar la ficha desde los tres accesos contextuales.
- Confirmar que quitar una faceta no borre las demás.
- Verificar categorías, repeticiones, fechas límite y costos informativos de paradas.
- Repetir una auditoría visual breve en escritorio y móvil.

### v0.7 · relaciones y consistencia

- Leer y proteger los campos comunes desde `trip_items`, incluso ante escrituras heredadas. Implementado localmente; pendiente de migración y validación.
- Vincular una ficha con un `place_id` reutilizable, manteniendo texto libre. Implementado localmente en `v0.7.1`; pendiente de migración y validación.
- Revisar la presentación conjunta de estados de agenda, reserva y pago. Implementado localmente: los estados se muestran por responsabilidad y los valores históricos dejan de ofrecerse para nuevas fichas.
- Ampliar las pruebas automatizadas: las reglas de categorías, estados, costos repetidos y Lugares ya están cubiertas; faltan integración de RPC y recorridos del navegador.
- Medir rendimiento y calidad del autocompletado antes de conservarlo como función estable.

### Después de estabilizar

- Señales y saldos sólo si el uso real lo necesita.
- Exportación e impresión.
- Plantillas genéricas opcionales y copia de valija propia.
- Consulta offline con caché privado por cuenta.

Chat, IA, clima, mapas embebidos, conversión automática multimoneda, votaciones, reparto de deudas y edición offline completa permanecen postergados. No se amplía el producto para compensar un flujo básico confuso.

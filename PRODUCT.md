# TripMate · dirección de producto

## Propuesta

Una sola fuente de verdad para un viaje compartido. La ficha de un elemento concentra sus datos comunes y puede tener agenda, costo y reserva sin convertirse en tres registros conceptualmente distintos para el usuario.

## Estado

Revisado el 11 de septiembre de 2026. `v0.5` incorporó la identidad estable `trip_items`; `v0.6` agregó el guardado transaccional de la ficha única; `v0.6.1` completó la integridad de reservas. `v0.7` consolidó `trip_items` como fuente canónica y `v0.7.1` vinculó cada ficha con un lugar guardado opcional. Las dos migraciones están aplicadas y sus comprobaciones posteriores devolvieron `true`.

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

### v0.7 cerrada

- `trip_items` posee los campos comunes y las facetas heredadas se alinean con esa identidad.
- Actividades, costos y reservas abren y guardan la misma ficha desde sus accesos contextuales.
- Quitar una faceta conserva las demás; eliminar la ficha completa mantiene confirmación explícita.
- Las categorías, repeticiones, fechas límite, costos y lugares reutilizables tienen reglas compartidas.
- Reservas conserva prioridad y posición antiguas en la base, pero la interfaz usa un orden automático por acción y vencimiento.
- Las pruebas manuales colaborativas, las comprobaciones SQL y la auditoría visual automatizada en escritorio y móvil pasaron.
- La sección activa forma parte de la URL y se conserva al recargar, compartir y navegar con atrás o adelante.

### Próxima etapa · agenda y robustez

- Modelar transporte nocturno y estancias con fecha de finalización explícita, sin reinterpretar horarios históricos.
- Ampliar pruebas de integración de RPC cuando exista una base de prueba aislada.
- Mantener una comprobación visual breve en escritorio y móvil ante cada cambio relevante de interfaz.
- Medir rendimiento y calidad del autocompletado antes de declararlo una función estable.

### Después de estabilizar

- Señales y saldos sólo si el uso real lo necesita.
- Exportación e impresión.
- Plantillas genéricas opcionales y copia de valija propia.
- Consulta offline con caché privado por cuenta.

Chat, IA, clima, mapas embebidos, conversión automática multimoneda, votaciones, reparto de deudas y edición offline completa permanecen postergados. No se amplía el producto para compensar un flujo básico confuso.

# TripMate · dirección de producto

## Propuesta

Una sola fuente de verdad para un viaje compartido. La ficha de un elemento concentra sus datos comunes y puede tener agenda, costo y reserva sin convertirse en tres registros conceptualmente distintos para el usuario.

## Estado

Revisado el 12 de septiembre de 2026. `v0.5` incorporó la identidad estable `trip_items`; `v0.6` agregó el guardado transaccional de la ficha única; `v0.6.1` completó la integridad de reservas. `v0.7` consolidó `trip_items` como fuente canónica y `v0.7.1` vinculó cada ficha con un lugar guardado opcional. `v0.8` agregó la fecha de finalización explícita y `v0.8.1` retiró el acceso cliente a las RPC antiguas. Todas están aplicadas en la base remota y sus comprobaciones posteriores devolvieron `true`.

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

### v0.8 cerrada

- Transporte nocturno y estancias ya admiten fecha de finalización explícita sin reinterpretar los horarios históricos.
- `supabase/v0.8.sql` está aplicada y sus cinco comprobaciones devolvieron `true`.
- La interfaz pasó la revisión visual focalizada en escritorio y 390 × 844, y el guardado real de una actividad nocturna conservó ambas fechas y horarios.

### Autocompletado verificado

- Geoapify se consulta una sola vez por búsqueda, con sesgo no restrictivo por país y sin convertir aproximaciones en direcciones exactas.
- La interfaz cancela solicitudes reemplazadas, limpia resultados anteriores al cambiar la consulta y conserva la escritura manual como alternativa.
- La medición local del 11 de septiembre de 2026 quedó documentada en `docs/AUTOCOMPLETE-BENCHMARK-2026-09-11.md`.

### Robustez cerrada

- La base completa puede reconstruirse localmente desde la migración canónica sin enlazar ni modificar producción.
- Las 31 pruebas pgTAP de RPC, RLS, permisos, fechas, facetas e identidad compartida pasaron el 11 de septiembre de 2026.
- La aplicación conserva una sola RPC pública de guardado de fichas; las implementaciones antiguas quedan como dependencias SQL privadas.
- El login limita intentos repetidos sin incorporar servicios pagos y las redirecciones de autenticación sólo aceptan rutas internas.
- La auditoría breve de v0.8.1 no dejó hallazgos críticos o altos abiertos. El detalle está en `docs/AUDITORIA-v0.8.1.md`.
- Las comprobaciones visuales breves en escritorio y móvil quedan como requisito de regresión ante cambios relevantes de interfaz.

### v0.9 cerrada

- El plan compartido se puede guardar como PDF desde el navegador.
- La salida reúne itinerario, presupuesto, reservas y lugares, pero excluye la valija personal y los datos de acceso de integrantes.

### Ideas futuras no comprometidas

Estas propuestas no son trabajo pendiente de la versión actual. Se evaluarán sólo cuando el uso real muestre una necesidad repetida:

- Señales, anticipos y saldos de reservas.
- Plantillas genéricas de viajes y copia de la valija propia.
- Exportación estructurada en un formato adicional al PDF.
- Consulta offline mediante una caché privada por cuenta.
- Comprobantes almacenados de forma privada.
- Chat interno entre integrantes.
- Asistencia con inteligencia artificial.
- Clima para las fechas y destinos del viaje.
- Mapas y rutas dentro de TripMate.
- Conversión automática entre monedas.
- Votaciones para decidir actividades o lugares.
- Reparto de gastos, pagos y deudas entre integrantes.
- Edición completamente offline con sincronización posterior.

Antes de implementar una idea se debe comprobar que resuelve un problema real, que no duplica una función existente y que su costo operativo es apropiado para la cantidad de usuarios. No se amplía el producto para compensar un flujo básico confuso.

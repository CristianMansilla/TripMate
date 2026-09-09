# TripMate · dirección de producto

## Propuesta
Una sola fuente de verdad para un viaje compartido. Reduce chats dispersos, capturas, notas, planillas y links sueltos.

## Estado de esta dirección
Revisada el 8 de septiembre de 2026. `v0.4.2` y `v0.4.3` ya fueron validadas en la base conectada. `v0.4.4` incorpora la creación directa de actividades desde Itinerario y deja el costo como una decisión opcional. El parche local `v0.4.5` extiende ese flujo con paradas progresivas y tipos personalizados mediante la opción `Otro`; todavía debe ejecutarse y validarse. Ver [auditoría completa y evidencias](docs/AUDITORIA-UX-2026-09-08.md).

## Principios UX
- **Confiabilidad primero:** no perder borradores, duplicar compras ni cambiar importes como efecto lateral de editar una agenda.
- **Mobile-first:** tareas habituales con pocos campos y acciones accesibles; cabecera compacta y contexto conservado al volver.
- **Edición en contexto:** crear y corregir desde Presupuesto, Itinerario o Reservas usando las mismas reglas y los mismos datos.
- **Responsabilidades claras:** Itinerario organiza qué y cuándo; Presupuesto concentra costos; Reservas gestiona confirmaciones. Ninguno es obligatorio para usar los otros.
- **Estados separados:** programado, reservado y pagado no son pasos obligatorios de una única cadena. Cancelar no equivale a reembolso.
- **Un costo, una fuente:** una compra suma una sola vez aunque aparezca en varias vistas y horarios. El promedio por persona no es un reparto de deudas.
- **Complejidad optativa:** actividad simple primero; paradas, repeticiones, desglose y seguimiento sólo cuando hacen falta. Agregar una parada no cambia un precio fijo.
- **Compartido con permisos:** datos del viaje para sus integrantes; valija personal incluso para lectores. Viajeros y cuentas invitadas son cantidades distintas.
- **Empezar de cero:** siempre posible. Las futuras plantillas genéricas son opcionales y se importan como copia editable. El viaje privado de Córdoba nunca es una plantilla pública.
- **Costo de infraestructura contenido:** preferir enlaces externos y funciones sin APIs pagas cuando resuelven la necesidad.
- **Universal:** no depender de un destino, moneda o cantidad fija de viajeros.

## Navegación propuesta
- Inicio / viajes
- Resumen
- Itinerario
- Presupuesto
- Reservas
- Lugares
- Valija
- Integrantes

Mantener estas secciones por ahora; no agregar más pestañas para resolver problemas de las actuales. Notas puede empezar como un detalle contextual, no como módulo obligatorio. La sección y el día deben poder conservarse en la URL.

## Roadmap
### 1. Estabilizar v0.4.x
Borradores y conflictos de edición, guardado de importe sin reenviar todo el plan, pila de modales, cancelación coherente, validaciones y errores recuperables. Hacer explícito precio fijo frente a desglose. Añadir pruebas de regresión.

Cierre: ningún borrador pisado por realtime; ninguna parada eliminada al cambiar sólo un importe; un descarte no promete cancelar un guardado en curso; agregar una parada incluida no cambia el precio del paquete.

### 2. Simplificar el núcleo en v0.5
Alta desde agenda, actividad gratuita o con precio por definir, gasto general sin fecha, agregar al viaje frente a guardar como idea. Formularios progresivos, actividad/paradas como vocabulario, repeticiones con total visible y separación entre agenda e inclusión presupuestaria.

Estado local: la primera parte está implementada en `v0.4.4` y `v0.4.5`. Itinerario permite crear una actividad sin pasar por Presupuesto y, sólo si el usuario carga un costo, crea un gasto vinculado que suma una vez. Las paradas comparten un editor compacto: nombre y horario primero; detalles bajo demanda. Las categorías frecuentes siguen siendo directas y `Otro` habilita un nombre personalizado opcional.

Cierre: resolver paseo gratis, seguro, paquete y gasto repetido sin doble carga ni pasos ocultos. Revisar datos históricos antes de reinterpretar sus checks o precios.

### 3. Conectar Reservas en v0.5
Vincular gasto existente, crear uno o mantener reserva sin gasto. Precio canónico, estado de reserva separado del pago, edición contextual, creación transaccional y revisión manual de relaciones históricas.

Estado: primera versión implementada y validada en `v0.4.3`. Falta la prueba específica con dos cuentas antes de ampliarla con señas.

Cierre: el hotel aparece en ambas vistas y suma una vez; borrar seguimiento no elimina gasto ni agenda. No fusionar por nombre ni copiar precios en ambos sentidos. Pagado significa pago total; las señas requieren soporte explícito posterior.

### 4. Completar el uso diario en v0.5.x
Cabecera compacta, navegación persistente, resumen por fecha, contraste/etiquetas/teclado, textos largos, ajustes y archivo de viajes, base explícita, valija filtrable e invitaciones revocables. La accesibilidad básica empieza en la primera tanda, no se deja para el final.

### 5. Validar antes de ampliar
Dos cuentas, owner/editor/viewer/no integrante, privacidad de valija, red lenta/fallida, concurrencia, base nueva y migrada, móvil y pruebas de tareas con usuarios. No publicar la ampliación del núcleo con problemas P1 abiertos.

### 6. Evolución optativa
Señas y saldos si hacen falta; plantillas genéricas opcionales, copia de valija propia y exportación/impresión. Después, consulta offline con caché privado por cuenta. Adjuntos, notas ampliadas y avisos agrupados según uso observado.

Chat, IA, clima, mapas embebidos, conversión automática multi-moneda, votaciones, reparto de deudas y edición offline completa quedan postergados. No sumar complejidad para compensar un flujo básico confuso.

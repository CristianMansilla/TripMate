# TripMate: auditoría de producto, flujos y UX

Fecha: 2026-09-08. Base revisada: `5f22796`, commit #20.

Estado: diagnóstico y ruta propuesta sobre el commit auditado; la primera tanda de correcciones ya comenzó.
Complementa y sustituye las prioridades de la [auditoría anterior](AUDITORIA-v0.4.md).

> Estado actual: se corrigieron los fallos reproducidos de borradores, guardado estrecho de importe, precio de paradas, agenda, modales y altas vacías; también el cierre preventivo de permisos de H07, el snackbar/contraste de H10 y las etiquetas de autenticación de H11. `v0.4.2` y `v0.4.3` fueron probadas en la base conectada. `v0.4.4` agrega actividades directas desde Itinerario y `v0.4.5` simplifica sus paradas y permite nombrar un tipo personalizado desde `Otro`; esta última tanda todavía requiere validación conectada y móvil.
La dirección resumida queda en [PRODUCT.md](../PRODUCT.md).

## 1. Hallazgos prioritarios

**La dirección del producto es adecuada; el siguiente paso no es agregar más módulos.** Primero hay que recuperar previsibilidad en los guardados y precios, simplificar Presupuesto/Itinerario y luego integrar Reservas sobre esas reglas. Una interfaz profesional no exige que el usuario conozca las tablas, los vínculos ni el modelo de repeticiones.

Prioridades: P1 = resolver antes de ampliar el núcleo; P2 = siguiente entrega de usabilidad; P3 = evolución optativa. No se identificó un P0 en este alcance, pero esto no constituye una certificación de seguridad ni de producción.

Evidencia: **R** = reproducido en navegador con datos ficticios; **C** = confirmado por lectura de código; **V** = falta validar conectado o con usuarios. Las referencias de línea corresponden al commit auditado.

### H01. P1: una actualización puede borrar el borrador

- **R/C.** En el editor, cambiar el nombre y reemplazar `activities` por un nuevo array devuelve el nombre al valor original. Se reprodujo con el componente real y una actualización de props; no se simuló un evento real de Supabase.
- `ExpenseModal.tsx:28` reinicializa todo el formulario cuando cambia `activities`. `TripWorkspace.tsx:266` reemplaza ese array al recargar; las suscripciones de `TripWorkspace.tsx:314` recargan por cambios en múltiples secciones.
- Impacto: otra persona modifica una reserva o actividad y el usuario pierde lo que estaba escribiendo, aunque no haya cerrado el editor.
- Corrección: inicializar el borrador al abrir/cambiar de registro, mantener una versión base estable y avisar de cambios remotos sin pisarlo. Al guardar, detectar conflictos sobre esa versión.

### H02. P1: editar un importe reenvía el plan completo antiguo

- **C/V.** `TripWorkspace.tsx:414` usa `save_expense_plan_v2` para guardar un importe en línea. Incluye todas las ocurrencias y paradas conocidas por ese cliente.
- `supabase/v0.4.sql:508` y `:525` eliminan las paradas/actividades ausentes del payload. El bloqueo de fila serializa escrituras, pero no detecta que el segundo cliente partió de una versión anterior.
- Riesgo: guardar un precio desde una pantalla desactualizada puede sobrescribir datos o retirar una parada agregada por otro integrante. La posibilidad se deduce del contrato; falta reproducirla con dos sesiones de base de datos.
- Corrección: comando estrecho para modificar importe; versión esperada en operaciones sobre el plan completo; conflicto visible con borrador preservado. No usar un guardado de todo el árbol para cada `blur`.

### H03. P1: agregar una subactividad cambia el precio sin elegirlo

- **R/C.** Un gasto de 100 pasó a 0 al agregar una parada incluida/gratuita de importe 0 y guardar.
- `ExpenseModal.tsx:30` y `:45`, `QuickAddModal.tsx:45` y `:60`: si existe cualquier parada, el importe pasa a ser la suma de paradas y el cálculo pasa a `total`. La misma regla está en `supabase/v0.4.sql:528`.
- **C.** En un gasto con varias ocurrencias, basta que una tenga paradas para que la suma ignore los precios de las ocurrencias sin desglose. La marca `optional` tampoco las excluye de esa suma.
- Impacto: una estructura descriptiva modifica dinero; no se distingue un paquete con paradas incluidas de varias compras separadas.
- Corrección: separar estructura de agenda y fuente del precio. Precio fijo por defecto; desglose solo por elección explícita y con vista previa del total. No intentar reconstruir automáticamente importes históricos que ya se hayan reemplazado.

### H04. P1: guardar con fecha puede no mostrar nada en la agenda

- **R/C.** Un gasto nuevo con fecha se guarda, pero no aparece en Itinerario ni suma al total. El alta no ofrece el control de inclusión; exige volver a buscarlo y activarlo.
- `TripWorkspace.tsx:649` crea con `included:false`; `:339` filtra la agenda por esa misma inclusión. Excluir un gasto existente también oculta la actividad programada.
- Era una decisión del flujo anterior, no una regresión atribuible al último commit. Ahora su etiqueta presupuestaria no expresa la consecuencia sobre la agenda.
- Corrección propuesta: separar pertenencia al plan, programación e inclusión presupuestaria. Mostrar dos intenciones simples, agregar al viaje o guardar como idea, sin exponer tres interruptores en el alta básica. Una actividad agendada no debe desaparecer por ajustar un total.
- Migración: los antiguos `included:false` son ambiguos. Conservar inicialmente su visibilidad anterior y ofrecer revisión; no incluirlos todos ni reinterpretarlos masivamente.

### H05. P1: cerrar, cancelar y descartar no siempre conservan lo esperado

- **R.** Editar un gasto, pulsar Eliminar y cancelar la confirmación deja cerrado el editor y pierde el borrador. `TripWorkspace.tsx:946` lo desmonta antes de confirmar.
- **R.** Abrir confirmación de descarte y confirmar deja `document.body.style.overflow = 'hidden'` después de cerrar ambos diálogos. Cada instancia de `useModalBehavior.ts:9` restaura su propio valor anterior, incompatible con el desmontaje simultaneo de modales anidados.
- **R.** Con `onSave` demorado, se pudo elegir Descartar y la operación igualmente terminó guardando. `useDiscardConfirmation.ts:13` no conoce el estado de envío. `ConfirmDialog.tsx:28` también permite cerrar por fondo/Escape durante la operación aunque deshabilite sus botones.
- Corrección: pila de modales/foco/bloqueo de scroll compartida; conservar editor y borrador al cancelar eliminación; impedir prometer descarte mientras un envío ya está en curso. Ante demora o resultado incierto, mostrar ese estado y reconciliar antes de reintentar.

### H06. P1: las altas admiten registros sin nombre

- **R/C.** Guardar sin completar Nueva reserva, Nuevo lugar o Agregar a valija cierra el modal y crea una fila con título/nombre vacío en modo local.
- `QuickAddModal.tsx:49` valida título solo para gastos y el formulario usa `noValidate`; `TripWorkspace.tsx:662` en adelante inserta los otros tipos sin validar su nombre. Las tablas correspondientes exigen `NOT NULL`, no texto no vacío.
- Corrección: validadores compartidos entre alta y edición, trim, números finitos y límites; restricciones equivalentes en base de datos mediante migración incremental. Error junto al campo y foco en el primer problema; conservar todo el formulario.
- No limpiar registros existentes automáticamente. Un vacío se revisa, no se transforma en una eliminación masiva.

### H07. P1: la recuperación de errores y la sincronización son ambiguas

- **C/V.** Si falla la carga del viaje, `TripWorkspace.tsx:219` sale mostrando error pero conserva el estado inicial de viaje de ejemplo. No hay una pantalla exclusiva de viaje inaccesible con reintento.
- **C.** `canEdit = trip.role !== 'viewer'` en `:344` admite rol desconocido en la UI. La RLS sigue siendo una barrera distinta; esto no demuestra un acceso no autorizado a datos.
- **C.** `SUBSCRIBED` se interpreta como sincronizado (`:323`), aunque significa conexión al canal, no que toda la lectura haya terminado bien. Un `showSuccess` después de recargar puede borrar un error de lectura. La insignia se oculta en móvil (`globals.css:382`).
- **C.** No hay suscripcion a cambios de `trips`, `trip_members` o perfiles: viajeros y permisos pueden quedar desactualizados hasta otra recarga. Algunas operaciones no garantizan `catch/finally` ante excepciones de red.
- Corrección: estados separados de acceso, carga, envío y actualización; permisos de UI cerrados hasta conocer el rol; error persistente con reintento; conservar últimos datos válidos identificados como tales. El éxito de una escritura y el fallo posterior de lectura deben poder coexistir.

### H08. P2: Reservas y Presupuesto no representan una misma compra

- **R/C.** En el ejemplo de prueba, un hotel pagado de 500 en Reservas no cambia el presupuesto de grupo de 180. Este último suma exclusivamente `expenses` (`TripWorkspace.tsx:336`).
- `Reservation` no tiene `expenseId` (`lib/types.ts:63`). La base tiene un `activity_id` de reserva, pero el flujo de UI no lo utiliza para integrar costos. `amount` es otro valor independiente.
- **C.** El chip recorre estados de forma circular, incluso Pagado -> Esperando (`TripWorkspace.tsx:529`). Confirmar una reserva y pagar no son el mismo proceso.
- Decisión: integrar por referencia a un gasto canónico, no sumando ambas tablas ni sincronizando dos importes editables. Detalle en la sección 3.
- **Implementado y validado en el flujo principal.** `v0.4.3` agrega `reservations.expense_id`, valida que ambos registros pertenezcan al mismo viaje y evita compartir un gasto entre dos reservas. La UI permite usar un gasto existente, crear uno nuevo o no asociar costo; los importes históricos no se migran automáticamente. El selector directo también elimina la transición circular de estados. Sigue pendiente la prueba específica con dos cuentas simultáneas.

### H09. P2: complejidad y densidad no ajustadas al uso móvil

- **R.** Con contenido ordinario, las siete secciones no desbordaron horizontalmente a 1440, 390 y 320 px. Con un nombre largo sin espacios, Presupuesto pasó a 538 px de ancho en un viewport de 320 px.
- **R.** La cabecera ocupa 256 px en escritorio y 364/406 px en móvil. Se repite completa en todas las secciones. Un editor con una sola subactividad tiene 1415 px de contenido en un modal de 824 px de alto.
- **C.** Se mezclan gasto, actividad principal, bloque, día, aparicion, parada, subactividad e hito. Se pide precio y otros seis campos por parada; un seguro o gasto general también se presenta como actividad principal.
- Corrección: cabecera compacta; contenido operativo sin paneles decorativos anidados; filas con límites de ancho y quiebre de texto; detalles progresivos. Mantener identidad, iconos y colores semanticos sin otra renovacion visual completa.

### H10. P2: feedback visual mejorado, pero todavía inconsistente

- **R/C.** Repetir el mismo mensaje de éxito antes de que venza no reinicia su duración: dos segundos después del segundo guardado ya había desaparecido. `Snackbar.tsx:31` depende de `message` y `duration`, no de una identidad de operación.
- El fondo verde suave, borde y sombra del snackbar actual resuelven la anterior pérdida contra blanco. El texto oscuro sobre ese verde tiene contraste aproximado de 14.72:1 según los colores CSS; no conviene volver a cambiarlo por preferencia estética.
- **R/C.** La opacidad global `.budget-line.excluded { opacity:.56 }` reduce también texto y controles de filas todavía utilizables. Componiendo los colores CSS observados sobre el panel blanco, el contraste es aproximadamente 3.77:1 para el título y 2.13:1 para el detalle.
- Corrección: notificaciones con ID y reanuncio por operación; error de campo persistente y asociado al control; éxito breve arriba a la derecha; controles de cerrar/reintentar accesibles. Diferenciar excluidos con estado y fondo, sin reducir la opacidad del texto.
- Referencia: texto normal requiere 4.5:1; texto grande, 3:1. Estos cálculos son comprobaciones puntuales, no una auditoría completa de conformidad. [W3C: contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### H11. P2: accesibilidad incompleta en formularios y controles

- **R/C.** Los dos inputs de login tienen `labels.length = 0` y carecen de `aria-label`. También hay etiquetas sin asociar en registro, recuperación y perfil (`app/(auth)/login/page.tsx:47`, `components/AppBar.tsx:82`).
- **C/V.** El selector de foco de `useModalBehavior.ts:5` incluye campos dentro de secciones ocultas y no vuelve inerte el fondo. La prueba de Tab hacia adelante desde el pie del editor pasó; eso no valida todos los recorridos de teclado ni lectores de pantalla.
- **C.** Checks de presupuesto y valija usan botones sin `aria-checked`/`aria-pressed`; tabs y menu Más necesitan completar su comportamiento de teclado. El color no puede ser el único indicador de estado.
- Corrección: etiquetas asociadas, checkbox nativo para binarios, controles visibles en el orden de foco, foco inicial seguro/restaurado y errores dentro del contexto. La region de snackbar fuera del modal requiere prueba con lector de pantalla.
- Referencias: [W3C: diálogos modales](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [mensajes de estado](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Para tacto, usar 44 px como objetivo de comodidad; no confundirlo con el mínimo AA de 24 px o sus excepciones de espaciado. [W3C: tamaño del objetivo](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

### H12. P2: el resumen y la navegación no acompañan la tarea

- **C/R.** Próximos hitos filtra por estado/categoría, no por proximidad respecto de hoy; puede incluir pasado y puede quedar vacío aunque existan actividades (`TripWorkspace.tsx:793`). El caso de panel vacío se observó en las capturas.
- **C.** La pestaña vive solo en estado React. Recargar o volver no conserva un enlace estable al día, filtro o sección. Itinerario exige ir a Presupuesto para crear una actividad.
- Corrección: resumen con siguiente actividad y pendientes reales; alta en el día seleccionado; URL para sección/día/filtro; restaurar scroll al cerrar editor. No trasladar al usuario el trabajo de conectar módulos manualmente.

## 2. Cobertura del resto de la app

| Area | Conservar | Simplificar o completar | Prioridad |
| --- | --- | --- | --- |
| Registro y login | Email/usuario, ver contraseña, redireccion interna validada | Asociar etiquetas, `catch/finally`, conservar destino al cambiar login/registro, resolver enlace vencido/confirmación pendiente sin callejón sin salida. Evaluar usuario opcional, no obligatorio en primer acceso | P1 errores, P2 fricción |
| Recuperación | Flujo de email y callback | Estado de enlace vencido y nuevo envío; controlar carga/doble envío al cambiar contraseña; confirmación de resultado antes de navegar | P2 |
| Perfil | Nombre y usuario editables | Estado borrador separado del nombre del encabezado; cancelar restaura valores; revisar resultado de actualizar metadata además de `profiles` (`AppBar.tsx:66`) | P2 |
| Tus viajes | Vista vacía, alta, múltiples viajes, reintento de carga | Buscar/archivar cuando haya volumen; editar viaje existente, no obligar a recrearlo para corregir una fecha | P2 |
| Datos del viaje | Viajeros separados de cuentas; validaciones del alta | Ajustes de nombre/destino/fechas; previsualizar actividades fuera de rango; archivar y salir con reglas para propietario | P2 |
| Integrantes | Owner/editor/viewer y valija propia del lector | Permisos vigentes visibles; acción de salir; transferencia de propiedad antes de que el único owner salga; no confundir integrantes con divisor del presupuesto | P1 permisos, P2 gestión |
| Invitaciones | Enlace y rol definido | Mostrar viaje/rol y confirmar ingreso; listado para revocar enlaces y definir vencimiento. Hoy generar/cerrar pierde su gestión en UI y no hay caducidad por defecto (`InviteModal.tsx:28`) | P2 |
| Reservas | Prioridad, vencimiento, orden manual estable | Selector de estado directo, filtros pendientes/vencidas, proveedor/código/enlace cuando corresponda, costo único vinculado | P2 núcleo |
| Lugares | Base explícita y enlaces externos sin API paga | Selector de lugares guardados desde actividad; texto libre como alternativa. Quitar base inferida por nombre: hoy otro hotel puede pasar a ser base sin elegirlo (`TripWorkspace.tsx:347`) | P2 |
| Valija | Privacidad, lista propia y progreso real | Agrupar por categoría, pendientes/listos, entrada rápida y cantidades si hacen falta; copiar lista propia después | P2/P3 |
| Categorías | Crear desde el formulario | Normalizar espacios y duplicados de mayúsculas; gestión/renombrado dentro del viaje y sección. No taxonomía central obligatoria | P2/P3 |
| Presupuesto | Base por persona/grupo, categoría, gastos sin fecha | Separar costo total de abonado/saldo; centavos cuando existen; moneda consistente; margen de imprevistos opcional, no 15% como regla fija | P2 |
| Historial | Registro breve de cambios; valija excluida | Actor y cambios significativos, no ruido por cada escritura interna; la falla del historial no debe invalidar silenciosamente un guardado ya hecho | P2/P3 |
| PWA | Manifest e iconos | No prometer offline: no hay service worker/estrategia de cache de consulta. Validar instalación real y expiración de sesión antes de anunciar disponibilidad | P3 |

Observaciones adicionales de integridad y operación:

- `lib/money.ts:1` redondea la presentación a cero decimales aunque se aceptan importes con centavos. No es pérdida del dato almacenado, pero puede parecer que no se guardó lo ingresado.
- Fechas/horas necesitan un criterio para actividades nocturnas: permitir terminar al día siguiente de forma explícita, no rechazar indiscriminadamente todo `fin < inicio`. Avisar solapamientos, sin bloquear planes intencionales o sin hora.
- La función de invitación comprueba vencimiento/uso antes de detectar un miembro existente (`schema.sql:259`). Reabrir un enlace antiguo puede fallar aun siendo miembro. Expulsar no invalida enlaces activos: un enlace reutilizable puede permitir otro ingreso. Definir y probar esa política.
- El ingreso automático desde `/join` y el código pendiente en `localStorage` deben revisarse en navegador compartido/cambio de cuenta. Mostrar quién acepta y qué viaje/rol acepta, en lugar de una incorporación inesperada.
- Las políticas restringen escritura por viaje, pero varios vínculos simples no garantizan declarativamente que ambos extremos pertenezcan al mismo viaje (`schema.sql:71`, `:98`, `:123`, `:676`). Para el nuevo vínculo usar integridad por viaje y RPC validada, no solo filtrar opciones en frontend. No se realizó una explotación ni una prueba de RLS en producción.
- `schema.sql` y las migraciones no tienen validaciones completamente equivalentes para `create_trip`. Verificar instalaciones nuevas y actualizadas; no seguir dependiendo de reejecutar un archivo mutable para cada entrega.
- `TripWorkspace` concentra datos, cálculos, permisos, acciones y vistas; los payloads `any` facilitan divergencias. Extraer cálculos puros, contratos tipados y acciones por dominio al intervenir cada flujo, no hacer una reescritura general antes de arreglarlo.
- README presenta v0.4 en desarrollo y `package.json` sigue en 0.3.0. Unificar versión y changelog al preparar una entrega real; esta auditoría no modifica dependencias ni versiones. Hay lockfile, pero rangos `latest` requieren actualizaciones deliberadas y verificadas.
- Falta una suite versionada de regresión. Los experimentos de esta auditoría no sustituyen tests de dominio, componentes y Supabase en CI.

## 3. Decisión: conectar Reservas con Presupuesto

**Sí, deben conectarse cuando representan la misma compra. No deben ser obligatorios uno para el otro.**

Cada pantalla responde una pregunta:

| Vista | Pregunta | Dato del que es responsable |
| --- | --- | --- |
| Itinerario | Qué hacemos y cuándo | Actividad, fecha, hora, lugar y paradas |
| Presupuesto | Cuánto cuesta el viaje | Concepto de gasto, importe, base, moneda y pago |
| Reservas | Qué falta gestionar o confirmar | Proveedor, confirmación, vencimiento, código/enlace y seguimiento |

La entrada puede hacerse desde cualquiera de las tres vistas. Tener un dato canónico no implica obligar a editarlo siempre desde Presupuesto.

### Alternativas evaluadas

| Alternativa | Consecuencia | Decisión |
| --- | --- | --- |
| Sumar gastos y reservas independientes | Doble conteo cuando se registra la misma compra en ambos lugares | Descartar |
| Copiar importe/estado y sincronizarlos en ambos sentidos | Dos valores editables; conflictos, bucles y divergencias al fallar una escritura | Descartar |
| Reserva con referencia opcional a gasto canónico | Un solo costo, gestión independiente, migración gradual | Recomendada |
| Reemplazar todo por un sistema genérico de tareas/compras/contabilidad | Mucho alcance y riesgo sin validar utilidad | Postergar |

### Primera integración acotada

1. Agregar un `expense_id` opcional a la reserva, validado dentro del mismo viaje. Primera versión: un seguimiento principal por gasto y una reserva vinculada a un gasto; no relaciones muchos-a-muchos aun.
2. Al crear reserva: elegir **vincular gasto existente**, **crear gasto** o **sin gasto asociado**. La tercera opción cubre una gestión gratuita o un importe todavía desconocido. No mostrar otro campo de precio independiente si ya está vinculada.
3. Si el gasto ya tiene reserva, abrir esa reserva en lugar de crear otra. Un mismo gasto programado varios días sigue sumando una sola vez según su regla de cobro.
4. Mostrar desde ambos lados el acceso al otro registro. La reserva puede mostrar importe, base y estado de pago obtenidos del gasto; una edición contextual escribe sobre ese mismo gasto.
5. Crear reserva y gasto en una transacción con protección de doble envío e idempotencia para reintentos. Un error no deja una reserva huerfana ni un gasto duplicado.
6. Las reservas existentes no se enlazan por similitud de nombre. Ofrecer revisión de candidatos, comparar importes y dejar al usuario elegir. Al vincular, el gasto conserva su valor salvo cambio explícitamente confirmado.

### Estados: reserva no equivale a pago

- Reserva: pendiente, confirmada, cancelada. La investigacion puede quedar como candidata, pero no necesita un ciclo circular de chips.
- Precio: estimado o confirmado. Un precio confirmado no implica que el proveedor haya confirmado la reserva.
- Pago: pendiente o pagado en la primera integración. **Pagado significa total abonado**, no seña. El dato debe tener un único origen en el gasto; Reservas solo lo muestra o ejecuta el mismo comando de pago.
- Separar esos ejes del estado de actividad: propuesta, programada, realizada/cancelada. No seguir propagando una única cadena `idea -> reservado -> pagado -> hecho`.
- Las señas son la siguiente ampliacion pequeña del mismo modelo: total, abonado del grupo y saldo derivado, sin un tercer importe editable en Reservas. No anunciar soporte de pago parcial mientras solo exista un booleano/estado de pago total. Un cambio de viajeros no debe reinterpretar el dinero ya abonado.
- Cancelar una reserva no significa reembolso ni gasto cero. Conservar lo pagado y registrar/revisar el ajuste por separado. No inventar estados de cobro a partir del estado de la agenda.

### Borrado y desvinculación

| Acción | Resultado esperado |
| --- | --- |
| Borrar seguimiento de reserva | Confirmar; mantener gasto y agenda |
| Desvincular reserva de gasto | Mantener ambos, quitar solo la relación |
| Quitar una fecha de agenda | Mantener el gasto; si es precio por repetición, anticipar el nuevo total |
| Quitar parada incluida en paquete | No modificar el precio fijo |
| Quitar un componente de desglose | Mostrar el cambio de total antes de confirmar el guardado |
| Quitar solo el costo de una actividad | Mantener actividad; gestionar/desvincular reserva explícitamente |
| Eliminar actividad y su gasto | Acción distinta, con lista de efectos; no eliminar silenciosamente una reserva pagada |
| Cancelar compra/reserva con dinero abonado | Conservar trazabilidad; no tratar como borrado ni reembolso automático |

Esto corrige la recomendación anterior de eliminar automáticamente el gasto junto con la reserva. **No reutilizar la cascada actual de gasto a actividades para esta nueva relación.** El borrado de gasto debe quedar protegido hasta definir su desvinculación explícita; por ejemplo, relación restrictiva y RPC transaccional. Cambiar estas reglas requiere una migración, no solo un diálogo con otro texto.

## 4. Simplificación de Presupuesto e Itinerario

### Modelo de uso

- Una actividad puede ser gratuita o tener precio por definir; no se obliga a crear un gasto ficticio para verla en agenda.
- Un gasto puede no tener actividad: seguro, compra general, conectividad o imprevistos.
- Una fecha no obliga a incluir un costo en el total. Un pago no borra la actividad ni reduce el costo total del viaje; solo reduce el saldo pendiente.
- Una propuesta puede conservar fecha tentativa sin pertenecer al plan activo. Aparece identificada en la vista de propuestas, no desaparece sin explicación.
- La opción **Agregar al viaje** debe dejar el elemento visible y, si tiene costo, incluido en el presupuesto, en un solo guardado. **Guardar como idea** lo deja fuera del plan activo. Esto es una propuesta nueva a probar, no una migración automática de los checks históricos.

### Formularios progresivos

| Desde dónde | Campos iniciales | Opciones que se abren solo al necesitarlas |
| --- | --- | --- |
| Presupuesto: nuevo gasto | Nombre, importe/por definir, por persona o grupo, categoría | Programar en agenda, reserva, notas, repetir |
| Itinerario: agregar actividad | Nombre, día ya seleccionado, hora opcional | Lugar, costo, paradas, repetir, reserva |
| Reservas: nueva reserva | Nombre, estado de gestión, gasto existente/nuevo/ninguno | Vencimiento, proveedor, código, enlace y notas |

Compartir componentes y reglas de guardado; variar el punto de entrada y los campos iniciales. Volver siempre a la sección/día que el usuario estaba usando. No obligar a pasar por dos pestañas para una actividad sencilla.

### Bloques y subactividades

Terminología propuesta: **actividad** y **paradas**. La fecha agrupa el día; "Día 1" no debe nombrar la primera ocurrencia de un gasto si sucede en el quinto día del viaje. No crear un tercer nivel de anidación.

- Actividad simple: título, fecha y hora; sin un bloque artificial ni lista de paradas vacías.
- Recorrido con paradas: cada fila muestra nombre y hora; lugar/detalle/costo son opcionales, se editan al expandir. Reordenar con botones accesibles, no solo arrastrando.
- Paquete: un precio fijo cubre sus paradas; agregar instrucciones o una parada gratuita no cambia ese precio.
- Desglose: se elige de forma explícita. El agregado es calculado, nunca un segundo cargo. Mostrar qué conceptos entran en el total y cómo afecta cambiar cantidad, repetición o selección.
- Primera entrega: un desglose de un mismo gasto comparte base y pago. No admitir silenciosamente una mezcla de importes de grupo y por persona bajo la misma base.
- Si las paradas se pagan/reservan por separado, deben ser gastos independientes, aunque se agrupen visualmente en un recorrido. La evolución correcta es referencia a esos gastos desde las paradas; no convertir `activity_steps.amount` en una segunda contabilidad con estados propios.
- Separar esa evolución de la primera integración de Reservas. No es necesario construir un motor genérico de árboles de gastos para relacionar un hotel con su reserva.

### Repeticiones y cálculos

Un gasto de 40.000 por todo el servicio con cuatro horarios suma 40.000. Un gasto de 10.000 por cada repetición con cuatro horarios suma 40.000 y con tres, 30.000. Mostrar el multiplicador y el resultado antes de guardar; usar fechas/horarios reales en vez de llamar "días" a todas las ocurrencias.

Para la primera versión, conservar una moneda por viaje y dos bases claras. El total por persona es un promedio, **no un balance de quien debe a quien**. Una visita de costo desconocido no debe verse como gratuita. Una alternativa sin elegir no se debe sumar junto con la elegida.

### Casos de aceptación del modelo

| Caso | Resultado verificable |
| --- | --- |
| Seguro sin fecha | Aparece en presupuesto, no crea actividad |
| Paseo gratis | Aparece en agenda sin obligar a inventar un gasto |
| Visita con precio desconocido | Figura por definir, no como costo cero confirmado |
| Hotel de 120.000 para dos viajeros | Total de grupo 120.000, promedio 60.000; ver reserva no duplica costo |
| Hotel con cuatro noches/horarios | Si el precio es total, sigue en 120.000 |
| Entrada pagada sin reserva | Suma una vez; puede programarse; no necesita seguimiento de reserva |
| Excursion paquete de 100 con parada incluida | Sigue en 100 después de agregar o quitar esa parada |
| Recorrido con transporte grupal y entrada individual | Cálculos por concepto; no multiplicar el transporte por viajeros ni sumar dos veces el agregado |
| Seña de hotel | No marcar todo como pagado; saldo solo cuando se implemente el registro parcial |
| Dos alternativas excluyentes | Suma solo la elegida; las otras permanecen disponibles como propuestas |

## 5. UX visual y cambios recientes

Mantener lo que ya aporta: confirmaciones para operaciones destructivas, fondo semántico del snackbar, botones de guardado con estado, protección de doble envío, pie accesible del formulario, edición de reservas/lugares, cantidad de viajeros independiente y valija privada para lectores. Son mejoras presentes en #18-#20; los hallazgos no implican descartarlas.

La última prueba de guardado fallido con el editor real preservó el borrador y bloqueo el segundo envío. Esa protección existe; falta completar los casos de cierre durante envío y actualización remota.

Cambios visuales recomendados, después de corregir confiabilidad:

1. Encabezado compacto con nombre/destino y acciones. Resumen completo solo en Resumen; no repetir cuatro indicadores grandes encima de cada lista.
2. Lista de gastos con nombre, estado, importe y base fáciles de escanear; filtros cerca de la lista y total compacto arriba en móvil. Detalle bajo demanda.
3. Agenda por día, acceso a Hoy durante el viaje, días vacíos visibles, alta en contexto y actividades sin hora en un grupo claro.
4. No corregir densidad achicando todo: texto legible, controles táctiles cómodos, ancho estable para importes, `min-width:0`/quiebre de texto en filas flex/grid y prueba de cadenas sin espacios.
5. Quitar instrucciones repetitivas de las superficies de trabajo. Etiquetas concretas y estados precisos deben explicar la acción; conservar ayuda contextual solo donde evita un error real.
6. Iconos conocidos con nombre accesible; selector para estados, checkbox para inclusión/listo, comandos con verbos. No confirmaciones para cada marca de valija o cambio reversible; si se incorpora Deshacer, debe restaurar realmente el dato.
7. Reducir sombras, marcos y cajas dentro de cajas. Mantener el acento de marca y colores de estado, reservando el contraste fuerte para contenido y acciones importantes.

No rehacer login como landing, no agregar un panel de bienvenida obligatorio y no usar un onboarding largo para compensar un formulario confuso.

## 6. Ruta revisada

El orden importa más que el número de versión. Estas tandas son incrementales; no implican seis reescrituras. La primera integración de Reservas se adelantó a `v0.4.3` después de estabilizar el precio fijo y las reglas de borrado; no debe ampliarse hasta superar la validación conectada.

| Tanda | Objetivo y alcance | Dependencia | Criterio de cierre |
| --- | --- | --- | --- |
| 1. Confiabilidad, corrección v0.4.x | H01/H02/H03/H05/H06/H07: borradores, conflictos, precio explícito, modales, validaciones y errores; suite mínima | Ninguna | Realtime no pisa edición, descarte no miente, fallo conserva formulario, guardado de importe no elimina paradas, agregar parada no cambia precio fijo |
| 2. Flujo simple, iniciada en v0.4.4-v0.4.5 | Actividad/gasto independientes, alta desde agenda, plan vs propuesta, formularios progresivos, vocabulario único y repeticiones claras | Tanda 1 | Paseo gratis, gasto general, paquete y repetición se resuelven sin doble carga ni segundo paso de inclusión |
| 3. Reservas vinculadas, iniciada en v0.4.3 | Gasto existente/nuevo/ninguno; precio canónico, estados separados, enlaces cruzados, borrado seguro y revisión de históricos | Reglas estables de precio y borrado | Hotel visible desde ambas vistas, un solo costo; cancelar/borrar seguimiento no borra gasto/agenda; creación atómica y permisos probados |
| 4. Uso diario, v0.5.x | Cabecera compacta, errores/labels/contraste, URL de pestaña/día, resumen útil, editar/archivar viaje, base explícita, valija y gestión de invitaciones | Tandas anteriores; accesibilidad básica empieza en 1 | Tareas habituales en móvil/teclado sin callejones, texto largo sin desbordamiento, permisos/invitaciones actualizados |
| 5. Validación de entrega | Dos cuentas y roles, red lenta/fallida, base nueva y migrada, navegador móvil real, pruebas con viajeros | 1-4 | Sin P1 abiertos; resultados y limitaciones documentados; usuarios completan tareas sin explicación del modelo |
| 6. Evolución optativa | Señas/saldos si se necesitan, plantilla genérica opcional, copia de valija, exportar/imprimir; después consulta offline | Entrega estable y necesidad observada | Cada función reduce una tarea comprobada; no obligatoria y sin publicar datos personales |

### Próxima tanda concreta

Abrir primero tickets separados para:

1. Borrador estable + control de concurrencia y guardado estrecho de importe.
2. Pila de modales + cancelar eliminación sin perder editor + bloqueo coherente durante envío.
3. Validaciones iguales en crear/editar y errores de carga/permiso recuperables.
4. Precio fijo/desglose explícito con pruebas de totales y conservación de datos anteriores.

Hacer commits por cambio verificable, no un gran commit mezclando modelo, rediseño y migración de Reservas. El commit #20 ya existe; esta auditoría puede guardarse como un commit de documentación separado. No se hizo commit automáticamente.

### Plantillas y funciones a postergar

- Empezar de cero sigue siendo una opción completa y visible; una plantilla genérica es optativa, no precarga obligatoria.
- Plantillas publicadas por separado, con vista previa y secciones elegibles. Importar crea una copia independiente; nunca comparte IDs vivos con otro viaje.
- Presupuesto/agenda compartidos respetan permisos del viaje. La valija se copia a la cuenta que la elige; no rellenar ni exponer valijas ajenas.
- La antigua plantilla de Córdoba no debe regresar. El viaje privado ya asociado al usuario permanece intacto. En el código revisado, `lib/demo-data.ts` está vacío y no hay acción de importar ese viaje en el dashboard.
- Postergar chat, IA, clima, mapas embebidos, conversión automática multi-moneda, votaciones, notificaciones por cada cambio y reparto de deudas. También postergar edición offline completa: primero exportación y consulta con última actualización, cache por cuenta y limpieza al salir.
- Notas o adjuntos privados solo después de observar que el campo de notas/enlace no alcanza. No abrir nuevas secciones vacías por anticipación.

## 7. Entrega segura y medición

### Datos y migraciones

1. Inventariar en un entorno autorizado reservas con importe, gastos con vínculo legacy, ocurrencias, paradas, monedas y estados; exportar respaldo y ensayar restauración.
2. Crear migraciones nuevas numeradas y mantener `schema.sql` equivalente para instalaciones nuevas. No pedir reejecutar indiscriminadamente SQL mutable como estrategia permanente.
3. Agregar campos/vínculos primero, conservar anteriores durante compatibilidad y retirar lecturas/escrituras legacy solo tras verificar migración. No duplicar fuentes de costo durante la transición.
4. Validar mismo viaje en relaciones, rol en servidor, restricciones y transacciones. Probar owner/editor/viewer/no miembro y cambio de rol con formulario abierto.
5. Mostrar conflictos de importes y candidatos de vínculo a revisión humana. No fusionar por título, no dividir por viajeros otra vez y no borrar actividades históricas por quedar sin relación.
6. Comparar IDs, cantidades y totales antes/después; probar clientes con versión anterior. Activar la nueva UI después del backend compatible. Tener una estrategia de vuelta atrás que no dependa de borrar datos nuevos.

### Pruebas que deben quedar versionadas

- Unitarias: costo grupal/individual, decimales, cero vs desconocido, multiplicador total/repetición, desglose y alternativas; reglas de pago y cancelación.
- Componentes: crear/editar validan igual, conservar borrador, confirmación/cancelación, doble envío, error y reintento, cierre durante guardado, foco/scroll anidado y snackbar repetido.
- Integración con Supabase de pruebas: transacción completa o ninguna, idempotencia, conflicto entre dos editores, relaciones del mismo viaje y permisos RLS incluidas valijas/historial.
- End-to-end: alta de viaje, ingreso por enlace, paseo gratis, hotel ya presupuestado con reserva, edición desde agenda, cambio de viajeros, eliminación/desvinculación y recarga conservando contexto.
- Responsive/accesibilidad: 320/390/1440 px, zoom, teclado real/virtual, lector de pantalla, cadenas largas, importes grandes, muchos registros, sesión vencida, red lenta y sin conexión. Sin clicks forzados para ocultar controles inaccesibles.

### Validación con personas

Probar con 3-5 personas que no conozcan el código: organizador, integrante editor y lector. Pedir tareas sin explicar previamente las relaciones internas: crear un viaje vacío, agregar paseo gratis, presupuestar/reservar hotel existente, cambiar una hora, registrar un paquete con parada incluida y completar la valija.

Metas propuestas, no resultados ya obtenidos: ninguna pérdida/duplicación de datos; al menos 4 de 5 completan cada tarea central sin ayuda; comprenden total vs pago y pueden corregir un error. Medir tiempo y retrocesos como línea base antes de imponer objetivos arbitrarios. Registrar dónde dudan y corregir ese paso antes de agregar tutoriales.

## 8. Verificación realizada y límites

- `npm run typecheck`: pasó.
- `npm run build`: pasó. Se requirió permitir procesos de compilación fuera de la restricción de lanzamiento del entorno; no se cambiaron dependencias.
- Revisión estática de rutas, formularios, workspace, cálculos/mapeos, autenticación, permisos declarados, migraciones, estilos, manifest y documentación reciente.
- Chromium/Playwright contra copia local del código, Supabase deshabilitado y conexiones externas bloqueadas. Datos ficticios de un viaje de dos personas; no se copiaron variables secretas ni se escribio en la base real.
- Se revisaron las siete secciones a tres anchos, capturas de Resumen/Presupuesto/editor y escenarios de creación, inclusión, desglose, cancelación, labels, notificación repetida, nombre largo y guardados demorados/fallidos. Se repitieron las reproducciones principales después de corregir una interferencia del indicador de desarrollo de Next en la captura móvil.
- El reset de borrador se comprobó sustituyendo las props del editor real; la demora/falla de guardado se inyecto mediante su callback. Esto demuestra comportamiento de componentes, no concurrencia real de Supabase.
- Repetición posterior a las correcciones: un gasto de 100 conservó ese importe al agregar una parada de 0; excluirlo mantuvo una actividad en agenda; las tres altas vacías conservaron el formulario sin crear filas; cancelar borrado conservó el borrador; descartar restauró el scroll; un segundo éxito reinició la duración del snackbar.
- Verificaciones positivas: Escape durante un guardado no ofreció descartar y la persistencia terminó una vez; un guardado fallido preservó texto y el doble envío produjo una sola llamada; el foco quedó dentro del modal; login expuso una etiqueta asociada por input; no hubo desborde horizontal a 1440, 390 ni 320 px, incluso con una palabra larga.
- Artefactos de trabajo locales: `.cache/audit-current-ux.cjs` y `.cache/audit-current-results/`. Están ignorados por Git; este documento registra escenarios y resultados sin depender de publicar esas capturas. No son una suite de CI.
- Pendiente: validar `v0.4.5`, conflictos y permisos con dos sesiones autorizadas; también faltan datos históricos de producción, envío de emails, RLS efectiva, dispositivos reales y entrevistas. No se asegura que el SQL seleccionado en el IDE sea el que está aplicado en Supabase.
- Las correcciones previas fueron versionadas en los commits #21 y #22. En esta tanda se agregaron `supabase/v0.4.2.sql` y `supabase/v0.4.3.sql`; no se ejecutaron migraciones ni se borraron/importaron viajes.

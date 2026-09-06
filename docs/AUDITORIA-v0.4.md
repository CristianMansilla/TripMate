# Auditoría de TripMate y propuesta para v0.4

Fecha: 6 de septiembre de 2026. Base revisada: v0.3.0.

## Dictamen

La idea de cargar los datos una sola vez y reflejarlos en Presupuesto e Itinerario es adecuada. La implementación todavía mantiene dos copias de parte de esos datos y las actualiza por separado; por eso puede mostrar inconsistencias. Conviene estabilizar este núcleo antes de agregar más módulos.

La interfaz tiene una identidad reconocible, separadores por día útiles y acciones de edición bastante consistentes. Los mayores problemas actuales son de confiabilidad, privacidad, navegación móvil y recuperación ante errores. No hace falta rediseñar toda la aplicación para resolverlos.

## Avance de implementación

Primera tanda aplicada el 6 de septiembre de 2026:

- Iconos PWA unificados con la brújula visible en TripMate.
- Login por usuario resuelto en servidor; el RPC de email queda restringido a `service_role`.
- Redirecciones de autenticación limitadas a rutas internas.
- Valija personal disponible para cualquier integrante y excluida del historial compartido.
- Gasto e itinerario guardados y eliminados mediante una transacción por RPC, sin asociación difusa por título.
- Gastos generales incluidos en el total y soporte explícito para importes por persona o por grupo.
- Validación de importes negativos y títulos vacíos en interfaz y base.
- Gasto nuevo desmarcado de forma predeterminada; sólo aparece en itinerario al incluirse y tener día.
- Orden inicial y movimiento atómico de reservas.
- Categorías personalizadas sin interrumpir la escritura.
- Barra móvil reducida a cinco opciones y menú Más; comprobada sin desborde a 320 px.
- Diálogos principales con semántica, Escape, bloqueo del fondo, labels vinculadas y errores dentro del formulario.
- Indicador de sincronización basado en carga y estado del canal Realtime.

Segunda tanda aplicada: edición y eliminación completa de reservas y lugares, con confirmaciones, validación y conservación del orden manual. Pendiente para las siguientes tandas de v0.4: formulario compacto, repetición en varios días, foco contenido/restaurado, pruebas con dos cuentas reales y revisión de importación/datos históricos.

## Alcance y evidencia

- Revisión de las pantallas, componentes, autenticación, cálculos, importación, tipos, CSS y SQL versionado.
- Seis reproducciones automatizadas ejecutando funciones extraídas del código actual: primera fecha con inclusión, quitar fecha, orden de reservas, asociaciones por título, orden de actividades y edición en demo.
- Navegador Chromium con datos ficticios en una copia local sin configuración de Supabase. Vistas de 1440, 390 y 320 px, edición de importes, filtros, categorías, modal, navegación y callback de autenticación.
- Verificación de los PNG, tamaños, transparencia y zona segura del icono, y de las respuestas HTTP de los recursos del manifest.
- No se consultaron los datos de producción ni se ejecutaron migraciones. Los hallazgos de permisos describen el SQL del repositorio; queda comprobar que esas políticas sean las desplegadas.
- No se probó una instalación física en Android/iPhone, Safari, entrega real de correos ni edición concurrente entre dos cuentas reales. Una auditoría no garantiza encontrar todos los errores posibles.

La herramienta integrada de navegador falló al inicializarse; las comprobaciones se completaron con Playwright local y un navegador de prueba independiente. Las capturas usan datos ficticios. El indicador de desarrollo de Next.js que aparece en ellas no es un elemento del producto.

## Hallazgos prioritarios

P1: corregir antes de ampliar el uso compartido. P2: resolver en v0.4. P3: mejora posterior o mantenimiento. No se detectó mediante estas pruebas un incidente real en producción.

### 1. P1: la valija personal expone información en el historial compartido

Marcar, crear, editar o borrar un ítem escribe su nombre en `change_log`. La política de lectura de ese historial permite acceder a cualquier integrante del viaje; el organizador además lo ve en Resumen. La RLS de `packing_items` no protege esas copias del texto.

Ejemplo: un ítem personal como una medicación puede quedar identificado en el historial del grupo aunque la lista de valija sea privada.

Corregir: dejar de enviar eventos personales al historial compartido o almacenar un historial privado con permisos propios. Revisar las entradas anteriores mediante un procedimiento explícito, sin borrar silenciosamente información.

Evidencia: [eventos de valija](../components/TripWorkspace.tsx#L455), [logChange](../lib/change-log.ts#L3), [política del historial](../supabase/schema.sql#L300). Comprobado por código y SQL, pendiente de prueba con dos usuarios en la base desplegada.

### 2. P1: se puede obtener el email de un usuario sin iniciar sesión

`resolve_login_identifier` devuelve el email de Auth al recibir un nombre de usuario y tiene permiso de ejecución para `anon`. Es necesario para el login implementado, pero publica un dato que la pantalla de integrantes no necesita mostrar.

Corregir: resolver y autenticar del lado servidor, devolver respuestas genéricas y aplicar límites de intentos; también limitar quién puede ejecutar el RPC actual. No basta con ocultar el email en React. Mantener el login por usuario si resulta útil.

Evidencia: [función y permisos](../supabase/schema.sql#L206), [migración v0.2](../supabase/v0.2.sql#L18), [login](../app/(auth)/login/page.tsx#L29). Verificado en SQL; no se enumeraron usuarios reales.

### 3. P1: el callback acepta redirecciones a sitios externos

Reproducción local: `/auth/callback?next=https%3A%2F%2Fexample.com` respondió `307` con destino `https://example.com/`, sin exigir un código válido. Un enlace con el dominio de TripMate puede terminar enviando al usuario a otro sitio.

Corregir: validar rutas internas en callback, login y registro; rechazar destinos externos, `//host` y esquemas no permitidos. Si falla el intercambio de código, mostrar una recuperación clara en lugar de continuar igualmente.

Evidencia: [callback](../app/auth/callback/route.ts#L7), [destino del login](../app/(auth)/login/page.tsx#L18). Redirección externa reproducida; no se intentó ejecutar contenido malicioso.

### 4. P1: el guardado de gasto y actividad puede quedar a medias

Crear o editar hace escrituras independientes. En creación, si se guarda la actividad y falla el gasto, queda una actividad sin gasto. En edición, una de las pantallas puede recibir los datos nuevos y la otra conservar los anteriores. Reintentar puede generar registros adicionales.

También hay riesgos al eliminar: se borra el gasto y luego la actividad vinculada, sin comprobar el error de esa segunda operación ni si otros gastos comparten esa actividad. El SQL permite varias referencias a una misma actividad.

Corregir: guardar y eliminar cada operación lógica en una transacción, con una relación explícita, comprobación de pertenencia al mismo viaje y comportamiento definido para referencias compartidas. Una función de base de datos invocada por RPC permite encapsular estas operaciones; sus permisos deben respetar al usuario. [Funciones de Supabase](https://supabase.com/docs/guides/database/functions).

Evidencia: [edición](../components/TripWorkspace.tsx#L379), [creación](../components/TripWorkspace.tsx#L527), [eliminación](../components/TripWorkspace.tsx#L428), [relación actual](../supabase/schema.sql#L70). Rutas de fallo comprobadas por código; no se provocaron fallos en producción.

### 5. P1: se asocian gastos por parecido del nombre

Al cargar el viaje se infiere `activityId` usando la primera coincidencia parcial del título. Esa asociación no se guarda necesariamente en la base, pero luego puede usarse para actualizar o eliminar una actividad.

Reproducción con la función real: un gasto `Viandas martes` eligió la primera actividad `Viandas`, correspondiente al lunes. Los títulos repetidos o parecidos no son identificadores confiables.

Corregir: usar IDs persistidos. Las coincidencias antiguas deben mostrarse como sugerencias para revisar, sin permitir borrados o actualizaciones basados sólo en una inferencia.

Evidencia: [inferActivityId](../components/TripWorkspace.tsx#L109), [uso al cargar](../components/TripWorkspace.tsx#L214).

### 6. P2: agregar o quitar la fecha no conserva la intención del usuario

- Gasto sin actividad: cargar fecha y marcar `Incluir` en la misma edición crea la actividad, pero guarda `included: false`. Reproducido ejecutando `saveExpense`.
- Gasto vinculado: vaciar fecha conserva el ID y la fecha de la actividad anterior. Reproducido.
- Lugar, notas y opcional de un gasto sin fecha no se persisten como datos propios del gasto. Se escriben sólo dentro de la actividad; por ello pueden perderse aunque el formulario los solicite.

Corregir: preservar la selección de inclusión después de crear el vínculo; separar quitar una fecha de borrar un gasto; almacenar sus detalles aunque todavía no esté programado.

Evidencia: [saveExpense](../components/TripWorkspace.tsx#L380), [campos condicionados a fecha](../components/TripWorkspace.tsx#L386), [alta](../components/TripWorkspace.tsx#L531).

### 7. P2: el total descarta gastos incluidos que no tienen actividad

El cálculo exige `included` y una actividad vinculada. Un supermercado general, viandas compradas para varios días o contingencia pueden figurar como incluidos en la base y, aun así, aportar cero al total. El check aparece deshabilitado.

Prueba visual: tres gastos programados sumaban $60.000 y un supermercado sin actividad tenía $50.000 e `included: true`; el total mostrado fue $60.000.

Esto proviene de la regla anterior de conectar el check al itinerario. No es un fallo aritmético: es una restricción de producto que conviene revisar para admitir gastos generales. No hay que eliminar esos registros.

Evidencia: [filtro del total](../components/TripWorkspace.tsx#L278), [check deshabilitado](../components/TripWorkspace.tsx#L775).

### 8. P2: todos los importes se multiplican por todos los integrantes

Aunque existe `scope`, el cálculo siempre trata los importes como individuales. Un traslado de $20.000 por vehículo se transforma en $40.000 para dos personas. Además, invitar a alguien que sólo ayuda a organizar aumenta el número de viajeros y el total.

Corregir: distinguir `Por persona` y `Por servicio/grupo`, con la primera opción como predeterminada. Separar viajeros efectivos de cuentas con acceso. No hace falta implementar todavía quién le debe dinero a quién.

Ejemplo esperado: comida $30.000 por persona + traslado $20.000 por servicio, dos viajeros: total grupo $80.000; promedio por persona $40.000.

Evidencia: [cálculo](../components/TripWorkspace.tsx#L280), [scope guardado](../components/TripWorkspace.tsx#L531). No implica que deban dividirse nuevamente los importes históricos: esa conversión ya pudo haberse hecho manualmente.

### 9. P2: la edición admite precios negativos y nombres vacíos

`ExpenseModal` usa un `div`, no un formulario con validación al enviar; `required` y `min="0"` no bloquean el botón de guardar. La edición rápida tampoco valida el importe. El SQL exige un número pero no que sea no negativo, y `NOT NULL` no impide un nombre vacío.

Reproducción en navegador: `-10` quedó guardado en el gasto. En producción la restricción SQL versionada tampoco lo rechazaría.

Corregir: validación en formulario y base de datos; distinguir campo vacío, cero y valor inválido; aceptar decimales de forma consistente. No convertir un importe borrado transitoriamente en un cero confirmado sin feedback.

Evidencia: [modal](../components/ExpenseModal.tsx#L23), [guardado directo](../components/ExpenseModal.tsx#L58), [importe rápido](../components/TripWorkspace.tsx#L775), [SQL](../supabase/schema.sql#L73).

### 10. P2: errores de carga y guardado pueden parecer éxito

`loadConnectedData` comprueba el viaje, pero ignora errores de las consultas de gastos, reservas, lugares, valija e integrantes. Puede sustituir una sección por una lista vacía ante un error. En Dashboard, un error deja los viajes demo iniciales y sólo se registra en consola.

`QuickAddModal` tiene `finally` pero no muestra un error si `onSave` falla. Otros editores cierran antes de terminar el guardado, perdiendo el contexto del formulario. No hay una protección uniforme contra doble envío.

Corregir: estados separados de carga, vacío, error, guardando y guardado; conservar borradores; mostrar el error junto al formulario y ofrecer reintento. Cerrar sólo tras éxito. No sustituir datos reales por demo cuando falla una consulta.

Evidencia: [carga del viaje](../components/TripWorkspace.tsx#L195), [alta rápida](../components/QuickAddModal.tsx#L22), [carga del dashboard](../components/DashboardClient.tsx#L51), [cierre del editor](../components/TripWorkspace.tsx#L381).

### 11. P2: “Sincronizado” no indica sincronización real

`connected` se activa al obtener usuario; la suscripción no procesa sus estados ni hay indicador de escrituras pendientes. En celular se oculta incluso esa etiqueta. Las actualizaciones recargan varias tablas y pueden pisar un borrador; el modal también reinicia su estado al cambiar la actividad recibida.

No se escuchan cambios de integrantes, perfiles o viaje. Un cambio de rol o de cantidad de viajeros puede tardar en verse hasta recargar. La RLS sigue siendo la protección del servidor, aunque los botones queden desactualizados.

Corregir: mostrar `Guardando`, `Guardado`, `Sin conexión` o `Error al guardar` según el estado real; conservar ediciones locales; reconectar y refrescar permisos; detectar conflictos antes de sobrescribir. Probar dos clientes antes de cerrar v0.4.

Evidencia: [connected](../components/TripWorkspace.tsx#L183), [suscripción](../components/TripWorkspace.tsx#L261), [reinicio del borrador](../components/ExpenseModal.tsx#L19), [etiqueta](../components/TripWorkspace.tsx#L708).

### 12. P2: el orden de reservas sigue teniendo un caso defectuoso

La migración inicia todas las posiciones en cero. Al mover una reserva se calculan posiciones para toda la lista, pero se guardan sólo las dos intercambiadas. Los demás ceros se mantienen. Las reservas nuevas también nacen sin una posición al final.

Reproducción: `[Alpha, Beta, Gamma]` con posiciones cero; bajar Alpha un lugar produce `[Beta, Gamma, Alpha]`.

Corregir: inicializar todas las posiciones de forma estable, agregar al final y persistir el reordenamiento de forma atómica. Cambiar el estado ya no es la causa del movimiento: ésa es una mejora que sí existe.

Evidencia: [reordenamiento](../components/TripWorkspace.tsx#L500), [alta](../components/TripWorkspace.tsx#L559), [migración](../supabase/v0.3.sql#L12).

### 13. P2: las alternativas y el orden del itinerario necesitan reglas explícitas

Las alternativas sólo se buscan entre actividades ya incluidas, por lo que las opciones guardadas sin check no aparecen. Si dos alternativas están incluidas, ambas suman al presupuesto. Sólo se muestran tres y sus etiquetas no permiten reemplazar la principal.

La hora no es siempre el criterio de orden: `position` antiguo tiene prioridad. Una actividad de las 12:00 puede anteceder a una de las 08:00. Los intervalos que pasan de medianoche se tratan como una ventana mínima del mismo día, y sin duración se suponen 90 minutos. La UI dice que hace falta horario, pero el código sólo exige un vínculo con actividad.

Corregir: ordenar cronológicamente por defecto; definir actividades sin hora y cruces de día; permitir grupos de alternativas con una elección activa y candidatas no sumadas. No presentar coincidencia de horario como garantía de que un paseo sea factible por distancia o duración.

Evidencia: [intervalos y orden](../components/TripWorkspace.tsx#L80), [alternativas](../components/TripWorkspace.tsx#L292), [límite de tres](../components/TripWorkspace.tsx#L758).

### 14. P2: crear una categoría puede interrumpir la escritura

El selector sale del modo de escritura en cuanto el texto coincide con una categoría existente. Para crear `Ropa deportiva`, al llegar a `Ropa` desaparece el input. Reproducido en navegador. Afecta a todos los formularios que comparten `CategoryPicker`.

Corregir: mantener el modo de creación hasta confirmar o cancelar; normalizar y reutilizar categorías al guardar, no mientras se teclea. Conservar categorías por sección; valija por usuario. Es razonable que cualquier editor pueda crear categorías compartidas, y cada persona las de su valija. No requiere un administrador del sistema.

Agregar renombrar/fusionar dentro de la misma sección; para eliminar una categoría usada, elegir otra para sus ítems, sin borrar los ítems.

Evidencia: [cambio automático de modo](../components/CategoryPicker.tsx#L39), [opciones por sección](../components/TripWorkspace.tsx#L301).

### 15. P2: navegación y diálogos en celular

En 390 px no hubo desbordamiento de la barra inferior. En 320 px medí un contenido de 385 px: `Integrantes` queda fuera de vista. Siete destinos son demasiados para ese ancho. El encabezado del viaje ocupa gran parte de la primera pantalla aun estando en Valija o Presupuesto.

Los diálogos no tienen semántica de diálogo ni gestión de foco. Escape no cerró el editor y encontré seis inputs sin etiqueta asociada. El formulario largo obliga a desplazarse mucho para guardar; el fondo tampoco se bloquea explícitamente. No se observó desbordamiento horizontal del modal a 390 px: no debe reportarse como un fallo confirmado.

Corregir: cinco destinos móviles como máximo (`Resumen`, `Itinerario`, `Presupuesto`, `Valija`, `Más`), con Reservas/Lugares/Integrantes accesibles desde Más. Encabezado compacto fuera de Resumen. Diálogo accesible, foco contenido y restaurado, Escape, labels vinculadas y pie de acciones visible con teclado móvil. Preferir áreas táctiles de unos 44 px aunque el icono sea menor. El patrón de W3C especifica el comportamiento de foco y teclado de un modal. [WAI Dialog Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Evidencia: [barra móvil](../components/TripWorkspace.tsx#L856), [estilos](../app/globals.css), [modal](../components/ExpenseModal.tsx#L22).

### 16. P2: Reservas y Lugares no permiten corregir los datos principales

Reservas permite crear, cambiar estado y mover; no editar título, importe, notas o fecha, ni eliminar. Lugares permite crear y marcar base, pero no editar/eliminar ni cambiar su estado desde la UI.

En Reservas, cada toque cicla el estado, incluyendo `Pagado -> Esperando`; no resulta previsible. Tras generar una invitación, cambiar el selector de rol tampoco cambia el enlace ya generado, aunque el selector lo sugiera.

Corregir: completar edición/eliminación con confirmación; usar selección explícita de estado; reutilizar lugar y reserva vinculados al plan sin volver a cargar importes. Bloquear el rol de una invitación generada o regenerar el enlace de forma explícita.

Evidencia: [reservas y lugares](../components/TripWorkspace.tsx#L785), [ciclo de estado](../components/TripWorkspace.tsx#L489), [invitación](../components/InviteModal.tsx#L42).

### 17. P2: una persona con rol lector no puede usar su propia valija

Los botones dependen de `canEdit` del viaje y las políticas de escritura de valija exigen `can_edit_trip`. Ser lector del plan compartido termina bloqueando una lista que debería ser personal.

Corregir: permitir a cualquier integrante gestionar sólo su valija, incluyendo lectores; mantener el aislamiento por `assigned_to` en cada operación.

Evidencia: [UI de valija](../components/TripWorkspace.tsx#L822), [políticas](../supabase/schema.sql#L292).

### 18. P2: demo e importación no siguen completamente el flujo actual

Las semillas no incluyen `activityId`. La inferencia sólo se hace al cargar Supabase, de modo que el demo puede mostrar itinerario vacío y total cero. Crear o editar gastos en demo no crea/actualiza la actividad. En navegador, cambiar un gasto de $30.000 a -$10 mantuvo $30.000 en Itinerario.

El dashboard no reconstruye los nuevos viajes demo desde almacenamiento al volver a entrar. La importación de Córdoba conserva importes y listas del modelo anterior, no guarda las asociaciones y puede quedar parcial si una tabla falla.

Corregir: usar la misma lógica de dominio en demo y conectado, fixtures coherentes y una importación con vínculos explícitos. Esto no autoriza a volver a dividir los valores ya corregidos en tu base.

Evidencia: [semillas](../lib/demo-data.ts#L54), [salida temprana en demo](../components/TripWorkspace.tsx#L383), [alta demo](../components/TripWorkspace.tsx#L532), [importación](../lib/import-cordoba.ts#L21).

### 19. P2/P3: hay datos y controles que aparentan más de lo que hacen

- El progreso de cada viaje está fijo en 66% salvo si está completado. Conviene quitarlo o reemplazarlo por un indicador calculado y nombrado.
- Prioridad de reserva se solicita pero no se ve ni se usa en la lista. Mostrarla donde ayude o retirar ese input hasta implementarla.
- Nombre, fechas y destino de un viaje no tienen edición desde la UI. Agregar edición del viaje y archivado antes de añadir más módulos.
- Cancelar Perfil conserva el nombre escrito porque el formulario usa el mismo estado que la cabecera. Separar borrador de perfil guardado.
- El estado financiero pisa el de actividad: estimado se transforma en planificado y confirmado en reservado. No permite mantener claramente idea/hecho junto a pagado/pendiente. Separar conceptos.

Evidencia: [progreso fijo](../components/DashboardClient.tsx#L113), [perfil](../components/AppBar.tsx#L80), [conversión de estados](../components/TripWorkspace.tsx#L129), [nuevo viaje](../components/NewTripModal.tsx).

### 20. P2/P3: endurecer esquema, permisos y mantenimiento

- El índice que impide dos bases del viaje existe en `v0.3.sql`, pero falta en `schema.sql`: una instalación nueva puede comportarse distinto de una migrada. El cambio de base además se hace en dos peticiones.
- Las claves foráneas de gasto/reserva no exigen que la actividad pertenezca al mismo viaje. Agregar la restricción o validación transaccional y pruebas entre viajes.
- Los permisos de miembros permiten que un dueño altere roles desde la API más allá de lo que muestra el formulario. Definir y proteger la regla del último dueño para evitar viajes sin organizador.
- Invitaciones sin vencimiento por defecto y sin pantalla para revocar. Tras expulsar a alguien, un enlace aún válido podría permitir que vuelva a unirse. Agregar revocación y una política de reingreso explícita.
- Falta una suite versionada de pruebas de permisos, cálculos y flujos. Typecheck/build no prueban estas reglas.
- El componente principal concentra carga, permisos, cálculo, persistencia y todas las vistas. Extraer esas responsabilidades al corregir el núcleo, sin una reescritura total.
- Hay dependencias declaradas como `latest`. El lockfile fija esta instalación, pero conviene controlar las actualizaciones. Node quedó fijado en la versión 22 y la compilación fue verificada con ese runtime.

Evidencia: [migración](../supabase/v0.3.sql#L7), [esquema](../supabase/schema.sql#L104), [miembros](../supabase/schema.sql#L281), [invitaciones](../supabase/schema.sql#L147), [cambio de base](../components/TripWorkspace.tsx#L586), [dependencias](../package.json).

## Qué ya funciona y conviene mantener

- Resumen y Presupuesto usan el mismo total derivado. No reproduje en esta versión la diferencia de totales de las capturas anteriores; sí la exclusión de gastos sin vínculo.
- La creación conectada de gastos empieza con `included: false`, como pediste.
- El presupuesto está agrupado por fecha y ordenado por hora dentro del día.
- Tocar una categoría del resumen ya filtra los gastos y permite volver a ver todos. Es un filtro, no un resaltado de todas las filas manteniendo las demás visibles.
- Las categorías se obtienen separadas por sección. No se mezclan las listas de presupuesto, lugares y valija.
- Los colores de badges de idea, opcional, planificado y reservas ya están diferenciados.
- En móvil se ocultan las pestañas superiores; el problema pendiente es la cantidad de opciones de la barra inferior.
- Existen confirmaciones para borrar gastos e ítems de valija y para expulsar integrantes.
- Los enlaces externos de Maps aportan utilidad con poca complejidad. Mantenerlos como enlaces; no se necesita volver al mapa embebido.

## Corrección del icono realizada

Se corrigió el SVG con la misma geometría de `Compass` usada por la web: sin punto central y sin el segundo recuadro. Se generaron PNG de 192 y 512 px, una variante Android `maskable` opaca de 512 px y un `apple-touch-icon` de 180 px. Manifest y metadata apuntan a esos archivos.

La variante adaptable conserva toda la brújula dentro de la zona segura central, con radio del 40% del ancho, y permite que Android recorte el fondo según el launcher. El sistema puede seguir cambiando la forma exterior: eso es normal y distinto de cambiar el dibujo del logo. [Iconos adaptables](https://web.dev/articles/maskable-icon).

Archivos: [SVG](../app/icon.svg), [manifest](../app/manifest.ts), [metadata](../app/layout.tsx), [PNG 192](../public/icons/tripmate-192.png), [PNG 512](../public/icons/tripmate-512.png), [Android](../public/icons/tripmate-maskable-512.png), [iPhone](../public/icons/apple-touch-icon.png).

Verificado: tamaños, MIME HTTP, fondo opaco del maskable, ningún píxel blanco fuera de la zona segura y centro sin punto blanco. Pendiente: despliegue e instalación física. Un acceso instalado puede conservar el icono anterior hasta que el sistema lo actualice; después del despliegue se puede recrear el acceso si fuera necesario. No borrar datos locales para cambiar un icono.

Los demás hallazgos están documentados como pendientes. Esta auditoría no modificó las tablas, importes ni actividades de Supabase.

## Modelo recomendado para Presupuesto e Itinerario

Mantener una única pantalla de creación/edición. Itinerario puede ofrecer `Editar en Presupuesto` y abrir ese mismo editor; eso facilita corregir algo al verlo, sin crear otro registro ni mantener otro formulario independiente. El botón `Nueva actividad` no necesita volver al itinerario.

Cada plan/gasto tiene título, detalles, categoría, importe y base del precio; puede tener cero, uno o varios horarios. Los horarios contienen fecha, inicio y fin, y referencian al mismo registro. El estado de pago y la elección de una alternativa son conceptos separados.

| Caso | Presupuesto | Itinerario |
| --- | --- | --- |
| Gasto nuevo, sin check | Guardado como candidato, no suma | No aparece como actividad elegida |
| Comida incluida, con día y hora | Suma según su importe | Aparece en ese horario |
| Supermercado general incluido, sin día | Suma; sección Gastos generales | No se inventa un horario |
| Visita gratuita elegida | Importe cero | Aparece normalmente |
| Entrada ya pagada | Identificada como pagada; distinguir costo total de saldo pendiente | Sigue visible, aunque ya no haya dinero pendiente de pagar |
| Alternativa no elegida | No suma al plan activo | Puede aparecer como candidata del mismo horario |
| Mismo gasto con varios horarios | Se calcula según la regla de repetición | Aparece en cada horario asociado |

Esto ajusta la regla anterior del check: sirve para elegir lo que integra el viaje, pero no obliga a fingir una actividad para todo gasto general. La agenda se deriva de lo elegido y programado. Conviene decidir esta regla antes de la migración de v0.4.

### Repeticiones sin duplicar el presupuesto

Hay dos casos diferentes que deben quedar claros en el formulario:

- **Importe total ya calculado:** viandas $40.000 para cuatro días. Se cargan una vez; cuatro apariciones en la agenda; el total sigue siendo $40.000.
- **Importe por repetición:** viandas $10.000 por día durante cuatro días. Una definición y cuatro ocurrencias; total $40.000. Si se quita un día, pasa a $30.000.

La frecuencia no debe multiplicar de nuevo un importe que el usuario ya cargó como total. Para v0.4 alcanza seleccionar varios días y una hora común, con excepciones simples; no hace falta un generador complejo de recurrencias.

Técnicamente conviene conservar las tablas útiles y migrar hacia una fuente canónica más ocurrencias referenciadas. Puede adaptarse `activities` para representar esas ocurrencias, o crearse una tabla de horarios; elegir después de revisar los datos reales. No hace falta borrar tablas para cambiar la interfaz. Antes de retirar columnas duplicadas, verificar todos los vínculos y el comportamiento de versiones anteriores.

## Skeletons, mensajes y confirmaciones

**Sí conviene agregar skeletons**, especialmente para Tus viajes y la primera carga de un viaje. Deben parecerse a la estructura final, reservar espacio y estar marcados como carga para tecnologías de asistencia. Una base CSS simple alcanza; no hace falta añadir una dependencia. Evitar parpadeo en cargas muy cortas y respetar movimiento reducido.

No reemplazar toda la pantalla por skeletons en cada actualización colaborativa. Conservar la información visible mientras se actualiza y mostrar un indicador discreto cuando haga falta. Un skeleton nunca debe quedarse indefinidamente ante un error: debe aparecer una opción de reintentar.

| Acción | Feedback recomendado |
| --- | --- |
| Guardar un gasto | Botón Guardando, bloqueo de doble envío; cerrar al confirmar éxito |
| Cambiar importe en línea | Estado Guardando/Guardado junto al valor; error con reintento y valor preservado |
| Marcar un ítem de valija | Cambio inmediato; restaurar estado y avisar si falla; sin diálogo de confirmación |
| Incluir/excluir un gasto | Actualizar check, total y agenda juntos; sin confirmación rutinaria |
| Cambiar una categoría o estado | Selector explícito; feedback breve; sin confirmación rutinaria |
| Borrar gasto | Confirmación que explique también qué ocurrirá con sus horarios |
| Borrar ítem de valija | Mantener confirmación actual; un futuro Deshacer sólo si realmente restaura el dato |
| Expulsar integrante | Confirmación con nombre y alcance del cambio |
| Cerrar formulario modificado | Confirmar descarte; al cerrar sin cambios, no preguntar |
| Error de red o sesión | Mensaje accionable en español; conservar formulario; ofrecer reintento o ingreso |

Los mensajes de éxito deben ser breves y no bloquear. Los errores importantes deben persistir hasta resolverse o descartarse, ser visibles dentro del contexto afectado y anunciarse de forma accesible. No mostrar SQL, nombres internos de tablas ni errores crudos de Supabase al usuario final.

## Mejoras de UX que aportan

1. **Acceso directo desde agenda al gasto:** abrir su mismo editor y volver al día/posición anterior al guardar.
2. **Revisión de precios:** al tocar Comidas, permitir resaltar las filas sin ocultar las demás; ofrecer `Sólo esta categoría` como filtro explícito. Mostrar cantidad de coincidencias y desplazarse a la primera, especialmente en celular. Distinguir total del viaje y subtotal seleccionado.
3. **Resumen accesible en móvil:** hoy queda después de toda la lista. Mostrar el total compacto arriba y un selector de categorías cerca de los gastos, sin obligar a bajar y volver a subir.
4. **Agenda con fechas navegables:** acceso a Hoy durante el viaje, selector de día y sección Sin horario. Mostrar un día vacío si forma parte del viaje; no inventar actividades para llenarlo.
5. **Formularios progresivos:** nombre, importe y categoría primero; programación y detalles desplegables según necesidad. Mantener Desde/Hasta juntos cuando el ancho lo permita.
6. **Valija práctica:** cantidades separadas del nombre, filtro Pendientes/Listos y agrupación por categoría. Copiar la propia lista de otro viaje puede esperar a v0.5.
7. **Viaje editable:** cambiar nombre, destino y fechas; archivar viajes terminados. Avisar si un cambio de fechas deja actividades fuera del rango.
8. **Navegación persistente:** reflejar la pestaña en la URL y conservar día/filtro al volver. Actualmente recargar devuelve a Resumen.
9. **Interfaz más compacta:** reducir la cabecera y las sombras/bordes repetidos de pantallas de trabajo; mantener el contraste de días y la brújula. Probar nombres largos, muchos integrantes y zoom antes de ajustar tamaños globales.

## Orden propuesto de versiones

| Entrega | Prioridad y alcance | Criterio de cierre |
| --- | --- | --- |
| Corrección inmediata o v0.3.1 | Icono (ya corregido localmente), privacidad de valija, exposición de emails y validación de redirecciones | Recursos del icono desplegados; prueba de permisos con dos usuarios; ninguna redirección externa aceptada |
| v0.4, primera etapa | Guardados transaccionales, relaciones por ID, fechas, importes válidos, gastos generales y base del precio | Un guardado completo o ninguno; mismos datos tras recargar; total verificable con casos de servicio e individuales |
| v0.4, segunda etapa | Edición/eliminación de reservas y lugares, orden estable, categorías, valija para lectores, errores y estados de guardado | Los flujos completos pueden corregirse desde la app; no hay pérdidas silenciosas ni doble envío |
| v0.4, tercera etapa | Navegación móvil, diálogos accesibles, skeletons, revisión de precios y repeticiones básicas | 320/390 px y teclado móvil utilizables; cuatro fechas de viandas sin cobro duplicado |
| v0.5 | Grupos de alternativas elegibles, exportación JSON/CSV e impresión, consulta offline de agenda, copiar valija, notas compartidas, reservas vinculadas | Utilidad probada durante el viaje; exportación/restauración ensayada y caché privado por usuario |
| v0.6 o posterior | Adjuntos privados, avisos agrupados con preferencias, votaciones para grupos, reparto de gastos si existe necesidad | Demanda real y costos/límites evaluados antes de implementarlos |

Las etapas son un orden de trabajo, no tres reescrituras. Para una v0.4 manejable, completar privacidad e integridad primero. Si las repeticiones hacen crecer demasiado el alcance, entregarlas en v0.4.1 después de estabilizar la relación canónica; no reemplazar pruebas y recuperación de errores por nuevas funciones.

### Qué mantendría, quitaría o postergaría

| Funcionalidad | Decisión |
| --- | --- |
| Presupuesto conectado con itinerario | Mantener y corregir el modelo; es el núcleo de la app |
| Edición independiente de actividad | Retirar el código sin uso después de migrar; conservar acceso al mismo editor desde la agenda |
| Lugares + enlaces externos a Maps | Mantener; aportan direcciones y navegación sin integrar un proveedor pago |
| Mapa embebido propio | Seguir sin él; no resuelve una necesidad que justifique complejidad ahora |
| Progreso fijo del 66% | Quitar; sustituir sólo si hay una medida real y comprensible |
| Chip de reserva que cambia al tocar repetidamente | Sustituir por un selector explícito |
| Categorías exclusivas del administrador del sistema | No conviene; autogestión dentro del alcance de cada usuario/sección |
| Reserva con otro importe independiente del mismo gasto | Evitar duplicación; referenciar el gasto cuando representan la misma compra |
| Chat interno, IA de viajes, clima integrado, cotizaciones automáticas | Postergar; priorizar confiabilidad y enlaces simples |
| Notificaciones de cada pequeña modificación | No agregarlas; estudiar resumen agrupado y optativo más adelante |
| Offline con edición completa y resolución de conflictos | Postergar; empezar por consulta offline con fecha de última actualización |

La descarga de una PWA no implica que funcione sin internet: hoy no hay un service worker ni una estrategia de consulta offline en el repositorio. Implementar caché con borrado al salir y separación por cuenta antes de prometerlo. Exportar/imprimir y los enlaces externos no requieren nuevas APIs pagas. Un mapa con datos abiertos también exige revisar las condiciones y capacidad del proveedor de mapas; “datos abiertos” no garantiza alojamiento ilimitado gratuito.

## Tratamiento de los datos históricos

- Conservar gastos incluidos sin fecha; pueden representar gastos generales válidos.
- No volver a dividir importes por dos automáticamente. La corrección que ejecutaste en Supabase debe verificarse con los valores actuales y el SQL aplicado antes de cualquier conversión.
- Listar primero actividades sin gasto, con ID, título, fecha, horario e importe. No eliminar ninguna en esta auditoría.
- Antes de fusionar o retirar registros, exportar una copia y entregar una lista revisable de los afectados. Toda actividad retirada debe quedar identificada para recuperarla como gasto/plan si corresponde.
- Diferenciar candidatos duplicados de repeticiones intencionales. Dos comidas con el mismo nombre en fechas distintas no son necesariamente duplicados.

## Pruebas de aceptación para cerrar v0.4

1. Crear sin check; incluir y excluir; verificar total y agenda antes/después de recargar.
2. Agregar primera fecha e incluir en un único guardado; quitar fecha sin perder detalles ni dejar una aparición antigua.
3. Editar cero, negativo, vacío, decimal, título vacío, texto largo y fechas fuera del viaje; obtener resultados o errores explícitos.
4. Simular fallo antes/después de cada escritura y doble toque en Guardar; no crear registros parciales o duplicados.
5. Verificar gastos generales, individuales, por servicio, gratuitos, pagados y alternativas excluidas.
6. Repetir viandas con total fijo y con precio por día; seleccionar/quitar ocurrencias y comprobar los totales.
7. Reordenar listas recién migradas y reservas nuevas; cambiar estados; recargar y mantener el orden.
8. Crear Ropa deportiva, corregir una categoría y fusionarla dentro de la misma sección; no modificar categorías de otras secciones.
9. Probar dueño/editor/lector/no integrante; cada persona ve sólo su valija y ningún historial ajeno de valija; lector gestiona la propia.
10. Dos sesiones editando, desconexión, reconexión y cambio de rol; feedback y resolución de conflictos verificables.
11. Invitación inválida, vencida, agotada, revocada y de usuario ya miembro; registro/login recuperan el destino correcto.
12. Teclado, Escape, lector de pantalla, zoom, 320/390 px, teclado virtual y barra de gestos; todas las acciones siguen accesibles.
13. Instalar desde Android/iPhone, abrir con sesión vencida y verificar el icono; no anunciar disponibilidad offline hasta implementarla.

## Verificación de esta entrega

`npm run typecheck` pasó. La compilación de producción pasó; el primer intento dentro del entorno restringido encontró `spawn EPERM`, y se completó al permitir la ejecución del proceso de compilación. Después de la primera tanda se ejecutaron 12 pruebas de interfaz con datos ficticios: total mixto, filtro de categorías, validación negativa, sincronización gasto-itinerario, alta desmarcada, navegación a 320 px, categorías personalizadas, orden de reservas, callback e iconos. Todas pasaron.

No se añadió una API paga, no se cambió la versión del paquete, no se ejecutó la migración contra producción y no se aplicó limpieza de datos. Antes de probar conectado hay que ejecutar `supabase/v0.4.sql` y configurar `SUPABASE_SERVICE_ROLE_KEY` sólo en el servidor.

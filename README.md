# TripMate · v0.4 en desarrollo

TripMate es una aplicación web colaborativa y mobile-first para planificar **cualquier viaje**: Córdoba, Brasil, Europa, escapadas con amigos, etc. Cada usuario puede crear múltiples viajes, invitar acompañantes y compartir itinerario, presupuesto, reservas y lugares. La valija es personal para cada usuario logueado.

## Qué trae esta versión

- Next.js + TypeScript.
- Supabase Auth preparado: registro, login, recuperación y cambio de contraseña.
- Login con email o nombre de usuario.
- Perfil editable con nombre visible y nombre de usuario.
- Dashboard multi-viaje.
- Creación real de viajes con Supabase.
- Roles `owner`, `editor`, `viewer`.
- Gestión de integrantes con cambio de rol y expulsión.
- Invitaciones por enlace/código.
- Itinerario armado desde los gastos incluidos que tienen día y horario.
- Alta rápida de gastos, reservas, lugares y valija personal.
- Cantidad de viajeros independiente de las cuentas invitadas, para calcular correctamente el presupuesto del grupo.
- Gastos editables/eliminables con datos de itinerario, categoría, estado, opción de incluir y marca opcional.
- Lugares editables y eliminables, con base del viaje y rutas externas en Google Maps, sin API paga.
- Presupuesto editable por persona, con total de grupo calculado automáticamente y filtro interactivo por categoría.
- Reservas editables, eliminables y ordenables manualmente sin que cambien de lugar al modificar su estado.
- Valija personal por usuario, con ítems editables/eliminables.
- Categorías por sección, con opción de crear una nueva categoría desde el formulario.
- Sincronización Realtime de actividades, gastos, reservas, lugares y valija.
- Historial de cambios básico.
- PWA instalable con manifest e icono de app.
- RLS por viaje.
- Modo demo sin Supabase, con persistencia en `localStorage`.
- Ropa fuera del presupuesto del viaje.

## Arranque local

Requiere Node.js 22. El proyecto incluye `.nvmrc` y `.node-version` para seleccionar esa versión automáticamente con un gestor compatible.

```bash
npm install
npm run dev
```

Sin variables de entorno funciona en modo demo.

## Conectar Supabase

1. Crear proyecto.
2. Ejecutar `supabase/schema.sql` en SQL Editor.
3. Copiar `.env.example` a `.env.local`.
4. Completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_solo_del_servidor
```

Si tu proyecto todavía muestra la clave legacy `anon`, también se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

5. En Supabase Auth habilitar Email/Password.
6. Configurar Site URL y Redirect URLs para localhost y Vercel.
7. Ejecutar la app y crear cuenta.

Si venís desde una base `v0.1`, ejecutar `supabase/v0.2.sql` una sola vez antes de usar nombres de usuario.
Si ya estabas en `v0.2`, ejecutar `supabase/v0.3.sql` para habilitar lugares con base, orden manual de reservas y valija personal por usuario.
Después de `v0.3`, ejecutar `supabase/v0.4.sql` para activar el guardado transaccional de gastos, apariciones y paradas del itinerario, los importes por persona/grupo y los permisos corregidos.
Si `v0.4.sql` ya fue ejecutado, aplicar después `supabase/v0.4.1.sql`. Ese parche conserva el importe principal al agregar paradas, evita que una edición rápida reenvíe una agenda desactualizada y bloquea nombres vacíos en Reservas, Lugares y Valija.

`SUPABASE_SERVICE_ROLE_KEY` sólo se usa en el servidor para resolver el login por nombre de usuario. Debe configurarse también en Vercel y nunca llevar el prefijo `NEXT_PUBLIC_`.

## Primer uso recomendado

1. Crear tu cuenta.
2. Abrir o crear un viaje.
3. Generar una invitación.
4. La otra persona entra con el link, crea/inicia sesión y se une.
5. Probar desde dos dispositivos cambiando un gasto, una reserva o un lugar.

## Deploy

Ver `SETUP.md` para GitHub + Supabase + Vercel.

## Seguridad

- La publishable/anon key puede estar en el frontend.
- **Nunca** exponer `service_role`.
- RLS limita acceso a integrantes de cada viaje.
- Los perfiles sólo son visibles para personas que comparten al menos un viaje.
- Los archivos futuros de tickets/comprobantes deben ir a un bucket privado.

## Modelo de datos

- `profiles`
- `trips`
- `trip_members`
- `activities`
- `expenses`
- `reservations`
- `places`
- `packing_items`
- `trip_notes`
- `trip_invites`
- `change_log`

## Próximas mejoras

La ruta vigente está en [PRODUCT.md](PRODUCT.md), respaldada por la [auditoría de UX y flujos del 8 de septiembre de 2026](docs/AUDITORIA-UX-2026-09-08.md).

1. Corregir pérdida de borradores, cancelaciones, validaciones, concurrencia y cambios involuntarios de precio.
2. Simplificar Presupuesto e Itinerario, con altas en contexto y separación entre programación y costo.
3. Vincular Reservas a un gasto único, sin duplicar importes ni confundir reserva con pago.
4. Completar navegación, accesibilidad y gestión cotidiana; validar con dos cuentas y usuarios reales.
5. Incorporar plantillas genéricas opcionales, copia de valija y exportación después de estabilizar el núcleo. Empezar de cero siempre sigue disponible.

Estas son propuestas pendientes, no funciones ya implementadas. No se debe reimportar ni publicar el viaje personal de Córdoba como plantilla.

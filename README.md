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
- Gastos editables/eliminables con datos de itinerario, categoría, estado, opción de incluir y marca opcional.
- Lugares guardados con base del viaje y rutas externas en Google Maps, sin API paga.
- Presupuesto editable por persona, con total de grupo calculado automáticamente y filtro interactivo por categoría.
- Reservas ordenables manualmente sin que cambien de lugar al modificar su estado.
- Valija personal por usuario, con ítems editables/eliminables.
- Categorías por sección, con opción de crear una nueva categoría desde el formulario.
- Sincronización Realtime de actividades, gastos, reservas, lugares y valija.
- Historial de cambios básico.
- PWA instalable con manifest e icono de app.
- RLS por viaje.
- Modo demo sin Supabase, con persistencia en `localStorage`.
- Ropa fuera del presupuesto del viaje.

## Arranque local

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
Después de `v0.3`, ejecutar `supabase/v0.4.sql` para activar el guardado transaccional de gastos e itinerario, los importes por persona/grupo y los permisos corregidos.

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

- Notificaciones por viaje con resumen agrupado para evitar avisos repetidos cuando alguien carga muchos cambios seguidos.
- Gastos repetibles con múltiples apariciones en itinerario, por ejemplo viandas o comidas que se repiten varios días.
- Auditoría de datos para detectar gastos incluidos sin día, actividades viejas sin gasto asociado, categorías duplicadas y montos sospechosos, sin borrar nada automáticamente.
- Adjuntos privados en Supabase Storage.
- Notas compartidas por viaje.
- Votación de lugares/actividades.
- Mejoras gratuitas de rutas con enlaces externos; evitar mapas embebidos o servicios pagos hasta que realmente sumen.
- Conversión multi-moneda.
- PWA/offline avanzado.
- Exportación PDF/JSON.
- Chat por viaje para coordinar decisiones sin salir de TripMate.
- Mejor historial con nombre/avatar del editor.
- Fotos de portada y galería del viaje.

# TripMate · v0.2

TripMate es una aplicación web colaborativa y mobile-first para planificar **cualquier viaje**: Córdoba, Brasil, Europa, escapadas con amigos, etc. Cada usuario puede crear múltiples viajes, invitar acompañantes y compartir itinerario, presupuesto, reservas y valija.

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
- Itinerario editable.
- Alta rápida de gastos, reservas y valija.
- Presupuesto editable con moneda base por viaje.
- Sincronización Realtime de actividades, gastos, reservas y valija.
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
```

Si tu proyecto todavía muestra la clave legacy `anon`, también se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

5. En Supabase Auth habilitar Email/Password.
6. Configurar Site URL y Redirect URLs para localhost y Vercel.
7. Ejecutar la app y crear cuenta.

Si venís desde una base `v0.1`, ejecutar `supabase/v0.2.sql` una sola vez antes de usar nombres de usuario.

## Primer uso recomendado

1. Crear tu cuenta.
2. Abrir o crear un viaje.
3. Generar una invitación.
4. La otra persona entra con el link, crea/inicia sesión y se une.
5. Probar desde dos dispositivos cambiando un costo o una actividad.

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

- Mapa y lugares guardados.
- Adjuntos privados en Supabase Storage.
- Votación de lugares/actividades.
- Conversión multi-moneda.
- PWA/offline.
- Exportación PDF/JSON.
- Chat por viaje para coordinar decisiones sin salir de TripMate.
- Mejor historial con nombre/avatar del editor.
- Fotos de portada y galería del viaje.

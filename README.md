# TripMate · v0.9

TripMate es una aplicación web colaborativa y mobile-first para planificar viajes. Cada usuario puede crear varios viajes, invitar acompañantes y compartir itinerario, presupuesto, reservas y lugares. La valija es personal para cada cuenta.

## Funciones principales

- Next.js, TypeScript y Supabase Auth.
- Login con email o nombre de usuario y perfiles editables.
- Viajes colaborativos con roles `owner`, `editor` y `viewer`.
- Una ficha única por elemento del viaje, con itinerario, costo y reserva opcionales.
- Altas contextuales desde Itinerario, Presupuesto y Reservas usando el mismo editor y la misma identidad.
- Actividades repetidas sin duplicar el costo cuando el importe se define como total.
- Transporte nocturno y estancias con fecha de finalización explícita.
- Presupuesto por persona y grupo, con categorías normalizadas y filtros.
- Reservas con estado y fecha límite independientes del estado de pago.
- Estados separados por responsabilidad: agenda, reserva y costo.
- Pruebas automatizadas para categorías, estados, costos repetidos y Lugares.
- Paradas opcionales; sus importes son referencias y no se suman al presupuesto.
- Lugares guardados, base del viaje, enlaces a Google Maps y autocompletado opcional mediante Geoapify.
- Guardado del plan compartido como PDF, sin exponer la valija personal ni los accesos de integrantes.
- Valija personal, invitaciones, historial básico, Realtime, PWA y RLS por viaje.
- Modo demo sin Supabase, persistido en `localStorage`.

## Arranque local

Requiere Node.js 22.

```bash
npm install
npm run dev
```

Sin variables de entorno funciona en modo demo.

Antes de confirmar cambios:

```bash
npm test
npm run typecheck
npm run build
```

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_solo_del_servidor
GEOAPIFY_API_KEY=tu_clave_opcional
```

`SUPABASE_SERVICE_ROLE_KEY` sólo se usa en el servidor para resolver el login por nombre de usuario. Nunca debe llevar el prefijo `NEXT_PUBLIC_` ni versionarse.

`GEOAPIFY_API_KEY` es opcional y sólo se lee desde la ruta del servidor. Sin esa clave, el lugar se puede escribir manualmente y se mantienen las sugerencias guardadas en el viaje. El uso está sujeto al plan y los límites de Geoapify; TripMate no contrata ni activa planes pagos.

## Base de datos

Para una base nueva, ejecutar en orden los archivos de `supabase/migrations/`. El primero reconstruye el esquema v0.8 y los siguientes aplican ajustes posteriores.

Para una base existente, aplicar en orden sólo las versiones posteriores a la instalada:

1. `supabase/v0.2.sql`
2. `supabase/v0.3.sql`
3. `supabase/v0.4.sql`
4. `supabase/v0.4.1.sql`
5. `supabase/v0.4.2.sql`
6. `supabase/v0.4.3.sql`
7. `supabase/v0.4.4.sql`
8. `supabase/v0.4.5.sql`
9. `supabase/v0.5.sql`
10. `supabase/v0.6.sql`
11. `supabase/v0.6.1.sql`
12. `supabase/v0.7.sql`
13. `supabase/v0.7.1.sql`
14. `supabase/v0.8.sql`
15. `supabase/migrations/20260911010000_v0_8_1_retire_legacy_item_rpcs.sql`

Las migraciones `v0.5` y `v0.6` introducen la identidad compartida `trip_items` y el guardado transaccional de la ficha única. `v0.6.1` impide reservas duplicadas por elemento y valida su fecha límite también en la base. `v0.7` establece `trip_items` como fuente canónica de nombre, tipo, lugar, notas y condición opcional. `v0.7.1` permite vincular una ficha con un Lugar guardado sin impedir el texto libre. `v0.8` agrega la fecha de finalización de cada aparición sin modificar el significado de los horarios históricos. `v0.8.1` deja `save_trip_item_v3` como única RPC de guardado de fichas disponible para clientes autenticados.

## Seguridad

- La publishable/anon key puede estar en el frontend.
- `service_role` y `GEOAPIFY_API_KEY` son secretos de servidor.
- RLS limita los datos a integrantes del viaje.
- Los perfiles sólo son visibles para personas que comparten un viaje.
- El login limita intentos repetidos por dirección e identificador y devuelve errores de credenciales genéricos.
- Los futuros comprobantes deben almacenarse en un bucket privado.

## Modelo principal

- `profiles`, `trips`, `trip_members`
- `trip_items` como identidad estable
- `activities`, `activity_steps`, `expenses`, `reservations` como facetas
- `places`, `packing_items`, `trip_invites`, `change_log`

La dirección vigente y los próximos pasos están en [PRODUCT.md](PRODUCT.md). La instalación y el despliegue están detallados en [SETUP.md](SETUP.md).

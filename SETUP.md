# TripMate · guía de configuración

## 1. Repositorio

No versionar `.env.local`. Sí versionar `.env.example`, las migraciones y la documentación técnica.

## 2. Supabase

Para un proyecto nuevo, ejecutar en orden todos los archivos de `supabase/migrations/`. El primero contiene el esquema v0.8 completo.

Para actualizar una base existente, ejecutar en orden sólo los archivos posteriores a la versión ya aplicada:

```text
v0.2 → v0.3 → v0.4 → v0.4.1 → v0.4.2 → v0.4.3
→ v0.4.4 → v0.4.5 → v0.5 → v0.6 → v0.6.1 → v0.7 → v0.7.1
→ v0.8 → migrations/20260911010000_v0_8_1_retire_legacy_item_rpcs.sql
```

Cada script termina con una consulta de comprobación. No continuar si arroja una excepción o un indicador esperado devuelve `false`.

## 3. Variables locales

Crear `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_SECRETA_DE_SERVIDOR
GEOAPIFY_API_KEY=TU_CLAVE_OPCIONAL
```

- `SUPABASE_SERVICE_ROLE_KEY` permite el login por nombre de usuario.
- `GEOAPIFY_API_KEY` habilita autocompletado de lugares desde una ruta protegida del servidor.
- Ninguna de las dos claves secretas debe usar `NEXT_PUBLIC_`, enviarse al navegador ni subirse a Git.
- Geoapify es opcional: sin clave, los lugares siguen admitiendo escritura manual y registros guardados.

## 4. Auth

En Supabase:

- Habilitar Authentication → Providers → Email.
- Configurar Site URL `http://localhost:3000` durante desarrollo.
- Agregar `http://localhost:3000/**` a Redirect URLs.
- Después del despliegue, agregar también la URL definitiva.

## 5. Probar local

Requiere Node.js 22. Los archivos `.nvmrc` y `.node-version` documentan esa versión.

```bash
npm install
npm run dev
```

Crear una cuenta, confirmar el email y entrar. Los correos de Supabase pueden llegar a spam; para producción conviene SMTP propio.

### Base aislada para pruebas

La configuración local aplica en orden `supabase/migrations/20260911000000_v0_8_schema.sql` y cada migración posterior. No aplica nuevamente los archivos históricos `v0.x`, que se conservan para actualizar instalaciones existentes.

Requiere un motor compatible con Docker en ejecución. No enlazar este entorno con el proyecto remoto.

```bash
npm run db:start
npm run db:reset
npm run test:db
npm run db:stop
```

`npm run test:db` ejecuta pgTAP dentro de la base local. Sus datos de prueba usan identificadores reservados, se crean en una transacción y terminan con `rollback`.

La auditoría del 11 de septiembre de 2026 ejecutó 31 pruebas pgTAP correctamente y `supabase db lint` no encontró errores. `npm run db:stop` detiene los contenedores cuando no se necesitan y conserva las imágenes descargadas para próximos usos.

## 6. Vercel

1. Importar el repositorio como proyecto Next.js.
2. Configurar las tres variables de Supabase.
3. Agregar `GEOAPIFY_API_KEY` sólo si se usará el autocompletado.
4. Desplegar.
5. Volver a Supabase y agregar `https://TU_APP.vercel.app/**` a Redirect URLs.

## 7. Prueba colaborativa

1. Usuario A crea un viaje e invita a B como editor.
2. B entra mediante el enlace.
3. B crea o edita una ficha con itinerario, costo y reserva.
4. A debe recibir el cambio por Realtime sin duplicados.
5. Verificar que un `viewer` no pueda editar datos compartidos y sí gestione su propia valija.

## 8. Antes de publicar

- Ejecutar `npm test`, `npm run typecheck` y `npm run build`.
- Probar creación, edición y eliminación en escritorio y móvil.
- Probar owner, editor, viewer y usuario no integrante.
- Revisar límites gratuitos de los servicios externos.
- Configurar monitoreo, backups, política de privacidad y SMTP.

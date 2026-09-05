# TripMate · guía de configuración

## 1. GitHub

```bash
git init
git add .
git commit -m "TripMate v0.1"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/tripmate.git
git push -u origin main
```

No versionar `.env.local`.

## 2. Supabase

Crear un proyecto gratuito y ejecutar completo:

`supabase/schema.sql`

Después verificar que existan las tablas del proyecto.

## 3. Variables locales

Crear `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICA
```

## 4. Auth

En Supabase:

- Authentication → Providers → Email habilitado.
- Authentication → URL Configuration.

Durante desarrollo:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/**`

Luego de desplegar, agregar también la URL de Vercel.

## 5. Probar local

```bash
npm install
npm run dev
```

Crear cuenta en `/signup`, confirmar email y entrar.

Durante pruebas, los emails enviados por Supabase Auth pueden llegar a correo no deseado. Para producción conviene configurar SMTP propio en Supabase Auth y autenticar el dominio del remitente.

## 6. Vercel

- Add New → Project.
- Importar el repo de GitHub.
- Framework: Next.js.
- Agregar Environment Variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Deploy.

## 7. Volver a Supabase

Cambiar Site URL por la URL final de Vercel y agregar:

`https://TU_APP.vercel.app/**`

a Redirect URLs.

## 8. Prueba colaborativa

1. Usuario A abre un viaje.
2. Invitar → rol Editor.
3. Copiar enlace.
4. Usuario B abre el enlace, crea/inicia sesión.
5. B cambia una actividad o un costo.
6. A debe ver el cambio por Realtime.

## 9. Antes de hacerla pública

- Agregar rate limiting a invitaciones si escala.
- Bucket privado para comprobantes/tickets.
- Política de privacidad si se abre a terceros.
- Dominio propio opcional.
- Backups/exportación.
- Monitoreo de errores.
- SMTP propio para mejorar la entrega de emails de registro y recuperación.

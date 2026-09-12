# Auditoría breve de TripMate v0.8.1

Fecha: 11 de septiembre de 2026.

## Dictamen

No quedan hallazgos críticos o altos abiertos dentro del alcance revisado. La ficha única conserva una identidad compartida entre itinerario, costo y reserva, y la aplicación actual escribe esa ficha por una sola RPC pública.

## Correcciones aplicadas

- El login limita intentos fallidos por dirección e identificador, rechaza cuerpos excesivos, no almacena valores crudos y mantiene respuestas de credenciales genéricas.
- `save_trip_item_v3` puede delegar de forma controlada en sus implementaciones internas; las RPC heredadas de actividad, gasto, reserva y ficha ya no son ejecutables por clientes autenticados.
- La resolución de un nombre de usuario continúa restringida a `service_role`.

## Evidencia

- `npm test`: 6 archivos y 26 pruebas aprobadas.
- `npm run typecheck`: aprobado.
- `npm run build`: compilación de producción aprobada con Next.js 16.3.3.
- `npm run test:db`: 2 archivos y 31 pruebas pgTAP aprobadas.
- `supabase db lint --local`: sin errores de esquema.
- `npm audit`: 0 vulnerabilidades conocidas en dependencias de producción y desarrollo.
- Base local reconstruida desde cero aplicando v0.8 y v0.8.1.
- Humo visual conectado en escritorio: el viaje, sus secciones y las acciones contextuales cargaron sin error. No hubo cambios de interfaz en esta tanda; se conserva la auditoría móvil aprobada de v0.8.

## Riesgos residuales

- El límite adicional de login vive en memoria por instancia y se reinicia al reiniciar el servidor. Es adecuado como defensa complementaria para la escala actual; una exposición pública mayor requerirá un contador compartido o CAPTCHA.
- La base remota todavía debe recibir `supabase/migrations/20260911010000_v0_8_1_retire_legacy_item_rpcs.sql` y devolver sus tres indicadores en `true`.
- No se repitió una prueba física en iPhone/Android ni una edición concurrente automatizada. La prueba colaborativa manual informada por el usuario sí pasó.

## Próxima auditoría

Repetir una auditoría amplia cuando cambie el modelo de datos, autenticación, permisos, cálculo de presupuesto o navegación principal. Para cambios visuales relevantes, repetir el control focalizado en escritorio y móvil.

# Autocompletado de lugares · medición local

Fecha: 11 de septiembre de 2026.

## Alcance

La medición se realizó en el editor unificado de una actividad, sobre `next dev`, desde un navegador autenticado. El tiempo observado incluye los 300 ms de espera del campo y termina cuando la lista ya es visible. No se guardaron fichas ni lugares durante la prueba.

## Resultados

| Consulta | Tiempo visible | Primer resultado | Evaluación |
| --- | ---: | --- | --- |
| `Terminal de Ómnibus Córdoba` | 2,34 s | Terminal de Ómnibus Córdoba, Bulevar Perón | Correcto |
| `Colón 100 Goya` | 2,60 s | Colón 100, Goya, Corrientes | Exacto, sin marca `Aprox.` |
| `Museo Emilio Caraffa Córdoba` | <= 3,25 s | Museo Emilio Caraffa, Av. Poeta L. Lugones 411 | Correcto |

`Patio Olmos Córdoba` también devolvió Patio Olmos, Avenida Vélez Sarsfield 361, como único resultado principal. Esa primera ejecución sirvió para validar calidad, pero no se usó como medición porque el navegador de prueba agotó su espera de inspección.

## Controles aplicados

- Una sola llamada a Geoapify por consulta final; se eliminó la segunda llamada de respaldo que podía duplicar la espera.
- Sesgo por país del viaje mediante `bias=countrycode`, sin impedir búsquedas fuera de la ciudad de destino.
- Cancelación de solicitudes reemplazadas y limpieza inmediata de sugerencias anteriores.
- Caché privada en memoria durante cinco minutos y límite por usuario.
- `Server-Timing` y `X-TripMate-Places-Cache` para diagnosticar respuestas sin registrar consultas ni direcciones.
- Escritura manual disponible cuando el proveedor no responde o no conoce un lugar.

## Criterio actual

La calidad de los casos representativos es adecuada y el tiempo visible local quedó por debajo de 3,3 segundos, frente a esperas observadas previamente cercanas a seis segundos. La latencia de Geoapify puede variar por red y región; una demora o ausencia de resultados no bloquea el formulario.

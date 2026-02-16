# P1 Bug - Like en Reporte se aplica, se deshace y vuelve

## Estado
- Prioridad: **P1**
- Tipo: **Consistencia UI/Cache/Reconciliacion SSE**
- Estado actual: **Documentado (sin fix aplicado)**

## Reproducibilidad

### Pasos exactos
1. Ingresar con usuario autenticado.
2. Ir a `/reportes`.
3. Hacer click en "like" sobre un reporte visible en la lista.
4. Observar el estado visual del boton/count durante 1-3 segundos.

### Resultado esperado
- El like queda aplicado de forma estable (sin rebote visual).
- `is_liked` y `upvotes_count` permanecen consistentes tras optimistic update + reconciliacion.

### Resultado observado
- El like se aplica.
- Luego se deshace visualmente (rebote).
- Luego vuelve a aparecer sin error HTTP visible.

### Frecuencia
- Reportado como: **intermitente/alta** (a confirmar con instrumentacion).

### Superficie afectada
- Confirmado por reporte de usuario en: **lista `/reportes`**.
- Pendiente confirmar: **detalle `/reporte/:id`**.

### Relacion con SSE
- Sospecha alta de carrera entre:
  - optimistic patch local,
  - reconciliacion por respuesta backend,
  - evento SSE incompleto (count sin estado personal) o aplicacion parcial de cache.

## Hipotesis tecnica inicial (sin fix aun)
1. Optimistic patch toca `report detail` pero la card/lista se rehidrata con estado no consolidado.
2. Evento realtime de like actualiza `upvotes_count` pero no incluye `is_liked` per-user.
3. Reconciliacion pisa temporalmente el estado optimista con payload parcial.

## Plan de fix (corto, no implementado)
1. Instrumentar logs frontend en el flujo de like:
   - `onMutate`, `onSuccess`, `onError`, `onSettled`.
   - Query keys afectadas y snapshot de `is_liked/upvotes_count` antes/despues.
2. Confirmar payload SSE real de `report-update`/`like-update`:
   - si trae solo count/global o tambien estado personal por usuario.
3. Decidir estrategia unica:
   - O SSE incluye estado personal (`is_liked`) cuando corresponda.
   - O frontend evita pisar optimistic con evento incompleto (aplicar merge defensivo).

## Criterio de cierre futuro
- No hay rebote visual del like en 20 interacciones consecutivas.
- Estado en lista y detalle consistente.
- Sin regresiones en `toggleLike` ni en feed realtime.


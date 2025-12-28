# Análisis de Optimización & UX

## 1️⃣ Performance Frontend

### ✅ ~~Imágenes sin Optimizar en Feed~~ (RESUELTO)
*   **Implementado**: Componente `<OptimizedImage />` en `src/components/OptimizedImage.tsx`
*   **Mejoras aplicadas**:
    - `loading="lazy"` + `decoding="async"`
    - `srcset` con 400w, 800w, 1200w
    - Skeleton shimmer placeholder
    - Fallback visual en error
    - `aspect-ratio` para eliminar CLS
    - `fetchpriority="high"` para imágenes `priority`
*   **Integrado en**: `Reportes.tsx`

### ✅ ~~Bundle Splitting Genérico~~ (RESUELTO)
*   **Implementado**: `vite.config.ts` con `manualChunks` estratégico
*   **Chunks generados** (verificado en build):

| Chunk | Tamaño | gzip | Carga |
|-------|--------|------|-------|
| `react-core` | 150kb | 48kb | Siempre |
| `router` | 21kb | 8kb | Siempre |
| `icons` | 23kb | 5kb | Siempre |
| `tiptap` | 324kb | 98kb | Solo al editar |
| `forms` | 87kb | 26kb | Solo formularios |
| `markdown` | 119kb | 34kb | Solo detalle |
| `vendor` | 91kb | 35kb | Siempre |

*   **Beneficio**: ~160kb gzipped menos en Home (tiptap + markdown lazy)

### 🟢 Re-renders en Filtros
*   **Problema**: Cambiar un filtro en [Reportes.tsx](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/src/pages/Reportes.tsx) dispara múltiples efectos. Aunque existe `useCallback`, la dependencia de estados individuales puede causar "parpadeos" de UI.
*   **Recomendación**: Unificar el estado de filtros en un solo objeto `useReducer` o `useState({ category, zone, ... })` para disparar un único efecto de carga.

---

## 2️⃣ UX / UI (Flujos Reales)

### ✅ ~~Selector de Ubicación en Mobile~~ (RESUELTO)
*   **Implementado**: Backend geocoding proxy en `/api/geocode/search` y `/api/geocode/reverse`
*   **Cambios**:
    - Eliminadas llamadas directas a Nominatim desde frontend
    - `useLocationSearch.ts` ahora usa `/api/geocode/search`
    - `LocationSelector.tsx` usa `/api/geocode/reverse` para GPS
    - Rate limiting: 1 req/seg por IP
    - User-Agent válido en backend: `SafeSpot/1.0 (contact@safespot.app)`
*   **Beneficio**: Elimina CORS y 403 en mobile browsers

### 🟡 Feedback de "Zona" Impreciso
*   **Problema**: En [CrearReporte.tsx](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/src/pages/CrearReporte.tsx), si no se detecta la zona, se asigna "Centro" por defecto con un Toast de advertencia.
*   **Impacto**: El usuario puede ignorar el Toast y guardar un reporte con zona incorrecta, ensuciando la data.
*   **Recomendación**: Si falla la detección automática, obligar al usuario a seleccionar la zona manualmente en un campo que se vuelve visible/resaltado.

### ✅ ~~Scroll Restoration~~ (RESUELTO)
*   **Implementado**: Hook `useScrollRestoration` integrado en `Layout.tsx`
*   **Comportamiento**:
    - `PUSH/REPLACE`: scroll a top (0, 0)
    - `POP` (back): restaura posición exacta
    - Usa `location.key` + `sessionStorage`
    - `requestAnimationFrame` para timing correcto
*   **Beneficio**: Comportamiento determinístico en todos los browsers

---

## 3️⃣ Performance Backend

### 🔴 Query N+1 en Hilos (Threads Count)
*   **Problema**: En `GET /api/reports`, se ejecuta una subquery [(SELECT COUNT(*) ...)](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/src/App.tsx#17-42) por cada fila del resultado para obtener `threads_count`.
*   **Impacto**: Degeneración exponencial del tiempo de respuesta proporcional a la cantidad de reportes listados (50 reportes = 50 subqueries extra).
*   **Recomendación**: Desnormalizar `threads_count` en la tabla `reports` (actualizado vía triggers) o usar `JOIN/GROUP BY` optimizado.

### 🟡 Conteo Total Innecesario (Slow Count)
*   **Problema**: Se ejecuta `SELECT COUNT(*) FROM reports` en cada request de paginación para soporte legacy.
*   **Impacto**: `COUNT(*)` en PostgreSQL es lento en tablas grandes (Full Table Scan o Index Scan costoso).
*   **Recomendación**: Eliminar el conteo total si se usa infinite scroll, o cachearlo por 5-10 minutos.

---

## 4️⃣ Sincronización Frontend ↔ Backend

### 🟡 Race Condition Potencial en Favoritos
*   **Problema**: Aunque hay lógica optimista en [Reportes.tsx](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/src/pages/Reportes.tsx), si un usuario hace click muy rápido múltiples veces (spam click), se podrían enviar múltiples requests [toggleFavorite](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/src/lib/api.ts#304-317) superpuestos.
*   **Impacto**: Estado desincronizado (UI dice "guardado", server dice "no guardado").
*   **Recomendación**: Implementar `debounce` en la función de click del botón favorito o deshabilitar el botón durante la transacción (ya implementado parcialmente, reforzar con `AbortController` si es necesario).

### 🟢 Inconsistencia de Geocoding
*   **Problema**: Es posible que el texto en el input de dirección difiera de las coordenadas si el usuario edita el texto *después* de seleccionar y la lógica de invalidación falla (aunque se vio lógica de invalidación, es un punto frágil).
*   **Recomendación**: Mostrar visualmente (ej. un check verde) solo cuando coordenadas y texto están sincronizados. Si el usuario toca el texto, quitar el check hasta que vuelva a seleccionar.

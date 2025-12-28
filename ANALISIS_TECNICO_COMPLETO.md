# Análisis Técnico - SafeSpot (PENDIENTES)
**Fecha**: Diciembre 2024  
**Este documento solo contiene ítems PENDIENTES. Los resueltos fueron removidos.**

---

## 📋 Resumen de Pendientes

### 🟠 Importantes / Media Prioridad

1. **Detección offline / Retry logic**
   - No hay detección de conexión offline
   - Si falla la red, el usuario ve error genérico
   - `api.ts` no tiene retry logic
   - **Tipo**: Frontend
   - **Impacto**: MEDIO

### 🟡 Nice to Have / Baja Prioridad

4. **Mapa interactivo (Leaflet/Mapbox)**
   - Selector de ubicación existe
   - Determinación de zona funciona
   - **Falta**: Visualización de mapa real, clustering de reportes, búsqueda por proximidad
   - **Tipo**: Frontend
   - **Impacto**: ALTO visual

5. **Notificaciones en tiempo real (WebSockets)**
   - No hay sistema de notificaciones push para otros usuarios
   - **Tipo**: Full-stack
   - **Impacto**: ALTO para engagement

7. **Límite de tamaño total de uploads**
    - 5 imágenes x 10MB = 50MB por reporte
    - Sin límite total de request body
    - **Tipo**: Backend


## ✅ Completado Recientemente

- **Notificaciones visuales para badges** ✅ (Dic 2024)
  - `triggerBadgeCheck()` dispara verificación inmediata después de acciones
  - Toast + sonido cuando se obtiene badge nuevo
  - Deduplicación via localStorage
  - Polling cada 15s como fallback

- **Contadores de Hilos vs Comentarios** ✅ (Dic 2024)
  - Backend: `threads_count` y `replies_count` calculados correctamente
  - Frontend: Actualización en tiempo real con counters del backend

- **Sistema de Caché Frontend** ✅ (Dic 2024)
  - Utilidad genérica en `src/lib/cache.ts`
  - `apiRequestCached()` wrapper con TTL configurable
  - Invalidación automática en `triggerBadgeCheck()`
  - TTLs: Gamification 30s, Badges catalog 5min, Favorites 60s

- **Manejo de Race Conditions** ✅ (Dic 2024)
  - Votes, favorites y flags retornan 200 OK con `status: "already_exists"`
  - Frontend puede distinguir acción exitosa vs ya aplicada
  - No más errores falsos en double-clicks
  - Optimistic UI más confiable

- **Code Splitting por Ruta** ✅ (Dic 2024)
  - Implementado con `React.lazy` y `Suspense`
  - 8 chunks independientes para las páginas principales
  - Reducción del bundle inicial y carga bajo demanda
  - Fallback de loading con spinner consistente

- **Política de Retención de Storage** ✅ (Dic 2024)
  - Script programable en `server/src/scripts/cleanup-storage.js`
  - Detecta imágenes huérfanas cotejando DB vs Storage
  - Protege archivos nuevos (<24h) de borrado accidental
  - Modos `dry-run` (seguro) y `execute` (borrado real)

---

## ⚠️ Edge Cases No Contemplados

1. **Usuario elimina localStorage**
   - Pierde su `anonymous_id` y se crea uno nuevo
   - Es por diseño (anonimato), pero puede confundir
   - **Solución**: Documentar claramente este comportamiento

2. **Comentarios con contenido JSON vs texto plano**
   - Lógica para preservar JSON si es válido (para rich text)
   - Puede confundir si usuario pega JSON accidentalmente
   - **Solución**: Validar que solo sea JSON si viene del editor rich text

---

## 🔮 Problemas que Aparecerán con Escala

1. **Query COUNT lento con muchos comentarios**
   - Si hay 10,000 comentarios, la query COUNT es lenta
   - **Solución**: Límite máximo estricto o estimaciones

2. **Triggers pueden causar deadlocks**
   - Múltiples usuarios votando simultáneamente
   - **Solución**: Advisory locks o batch updates

---

## 📊 Estado General

**Listo para producción**: ✅ SÍ

La aplicación está en estado estable para lanzamiento. Los ítems pendientes son mejoras, no bloqueos críticos.

### Problemas Críticos: 0 ❌
### Mejoras Importantes: 2
### Nice to Have: 5

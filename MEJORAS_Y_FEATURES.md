# 🚀 SafeSpot: Propuestas de Mejoras y Nuevas Funcionalidades

**Objetivo**: Evolucionar la plataforma manteniéndola anónima, segura y escalable.

---

## ✅ Mejoras Completadas (Diciembre 2024)

### 🔒 Endurecimiento de Seguridad RLS
*   **Tipo**: Seguridad / Base de Datos
*   **Estado**: Implementado (Script SQL entregado)
*   **Descripción**: Se modificaron las políticas RLS (Row Level Security) para rechazar cualquier escritura (INSERT/UPDATE/DELETE) que no tenga un `anonymous_id` explícito en la sesión.
*   **Impacto**: Elimina la posibilidad de que una mala configuración del backend o un acceso directo a la DB permita modificar datos ajenos al aprovechar un ID nulo.

### 🛡️ Sistema de Moderación "Trust Score"
*   **Tipo**: Backend / Producto
*   **Estado**: Implementado (Fases 1, 2 y 3)
*   **Descripción**: Sistema de reputación oculto. Calcula score basado en actividad (votos pos/neg, reportes aceptados/borrados).
*   **Funcionalidad**:
    *   **Cálculo**: Fórmula en PL/PGSQL que se actualiza en tiempo real.
    *   **Enforcement**: Middleware que aplica **Shadow Ban** automático si el score es bajo (contenido invisible públicamente).
    *   **Caching**: Caché en memoria para evitar latencia en cada request.
*   **Impacto**: Permite la autoevaluación y limpieza automática de trolls sin intervención manual constante.

### ⚡ Paginación por Cursor (Cursor-based Pagination)
*   **Tipo**: Backend / Performance
*   **Estado**: Implementado (Endpoint `GET /api/reports`)
*   **Descripción**: Se reemplazó el ineficiente `OFFSET/LIMIT` por un sistema de cursor (`created_at` + `id`) codificado en Base64.
*   **Impacto**: Tiempo de respuesta constante ($O(1)$) independientemente del tamaño de la tabla (vs $O(N)$ anterior). Fundamental para feeds infinitos.

### 🔍 Full text Search con `pg_trgm`
*   **Tipo**: Base de Datos
*   **Estado**: Implementado (Extension `pg_trgm` + GIN Indexes)
*   **Descripción**: Se reemplazó el operador `ILIKE` por el operador de similitud `%` basado en trigramas.
*   **Funcionalidad**:
    *   **Fuzzy Search**: Tolera errores tipográficos (ej. encuentra "bicicleta" si buscas "biccleta").
    *   **Ranking**: Ordena resultados por relevancia (`similarity`) usando `GREATEST(similarity(title), similarity(description)...)` cuando hay un término de búsqueda.
    *   **Performance**: Utiliza índices `GIN (gin_trgm_ops)` en columnas clave (`title`, `description`, `address`, `zone`, `category`).
*   **Impacto**: Búsquedas instantáneas y mucho más "inteligentes" para el usuario final.

### � Feed "Cerca de Mí" (Geospatial Indexing)
*   **Tipo**: Full-stack (PostGIS + Backend)
*   **Estado**: Implementado (Extension PostGIS + GIST Index + Endpoint)
*   **Descripción**: Feed geográfico que ordena reportes por distancia al usuario usando PostGIS.
*   **Funcionalidad**:
    *   **PostGIS**: Columna `location GEOGRAPHY(POINT, 4326)` con índice GIST para queries espaciales eficientes.
    *   **Query Optimizada**: Usa `ST_DWithin` para filtrar por radio (aprovecha índice) + `ST_Distance` para ordenar por distancia ASC.
    *   **API**: `GET /api/reports?lat=X&lng=Y&radius=5000` (radio en metros, default 5km, máx 50km).
    *   **Cursor Pagination**: Compatible con paginación por cursor usando `(distance, created_at, id)`.
    *   **Fallback**: Si no se envían coordenadas, usa feed cronológico automáticamente.
*   **Impacto**: Hiper-relevancia. El usuario ve reportes cercanos, aumentando engagement y utilidad de la plataforma.

---


## ✨ Nuevas Funcionalidades (Features)

### 5. "Alertas de Zona" (Push Notifications sin Login)
*   **Tipo**: Full-stack / Producto
*   **Impacto**: MUY ALTO (Retención)
*   **Complejidad**: ALTA
*   **Propuesta**: Permitir al usuario suscribirse a una zona geográfica (geofence) vía Web Push API. "Avísame si hay un reporte nuevo en Palermo".
*   **Problema**: El usuario solo entra a la app cuando se acuerda. No hay re-engagement proactivo.
*   **Beneficio**: Transforma la app de "consulta pasiva" a "herramienta de monitoreo activa". Respeta anonimato (el token push no requiere email).

### 6. Sistema de "Verificación de Evidencia"
*   **Tipo**: Full-stack
*   **Impacto**: MEDIO (Credibilidad)
*   **Complejidad**: MEDIA
*   **Propuesta**: Permitir subir 1 foto adicional *privada* o metadata EXIF que solo los moderadores ven para validar el reporte, o permitir a otros usuarios subir fotos "testigo" en el mismo lugar.
*   **Problema**: Dudas sobre la veracidad de los reportes.
*   **Beneficio**: Aumenta la confianza en la plataforma. Un reporte "verificado" tiene mucho más valor para la comunidad.

### 7. "Mapa de Calor" de Inseguridad (Heatmaps)
*   **Tipo**: Frontend / Data
*   **Impacto**: ALTO (Valor percibido)
*   **Complejidad**: MEDIA
*   **Propuesta**: Visualización de zonas calientes basada en densidad de reportes del último mes.
*   **Problema**: La lista de reportes no da una visión macro de la situación.
*   **Beneficio**: Valor agregado único. Usuarios consultarán la app antes de mudarse o transitar por una zona. "Inteligencia colectiva" visualizada.

### 8. Observabilidad de Negocio (Dashboard Métricas)
*   **Tipo**: Backend / Infra
*   **Impacto**: ALTO (Gestión)
*   **Complejidad**: BAJA
*   **Propuesta**: endpoint `/api/metrics` protegido que exponga métricas Prometheus: `reports_created_total`, `active_users_5m`, `flags_rate`.
*   **Problema**: Actualmente "volamos a ciegas". No sabemos si un pico de tráfico es viralidad o ataque.
*   **Beneficio**: Reacción rápida ante incidentes y entendimiento real del crecimiento.

---

## 📊 Resumen de Prioridades

1.  **Inmediato (Scalability Fixes)**: Paginación por Cursor y Full Text Search. (Crítico para que la app no se sienta lenta al crecer).
2.  **Corto Plazo (Engagement)**: Feed "Cerca de Mí". (Para que el usuario encuentre valor rápido).
3.  **Largo Plazo (Retention)**: Alertas de Zona. (Para que el usuario vuelva).

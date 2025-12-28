# 🚀 SafeSpot: Propuestas de Mejoras y Nuevas Funcionalidades

**Objetivo**: Evolucionar la plataforma manteniéndola anónima, segura y escalable.

---

## ✅ Mejoras Completadas (Diciembre 2024)

### 🔒 Endurecimiento de Seguridad RLS
*   **Tipo**: Seguridad / Base de Datos
*   **Estado**: Implementado (Script SQL entregado)
*   **Descripción**: Se modificaron las políticas RLS (Row Level Security) para rechazar cualquier escritura (INSERT/UPDATE/DELETE) que no tenga un `anonymous_id` explícito en la sesión.
*   **Impacto**: Elimina la posibilidad de que una mala configuración del backend o un acceso directo a la DB permita modificar datos ajenos al aprovechar un ID nulo.

---

## 🛠️ Mejoras Incrementales (Optimizando lo existente)

### 1. Sistema de Moderación Comunitaria "Trust Score"
*   **Tipo**: Backend / Producto
*   **Impacto**: ALTO (Calidad de contenido)
*   **Complejidad**: MEDIA
*   **Propuesta**: Implementar un puntaje oculto de reputación para IDs anónimos basado en la calidad de sus aportes (votos recibidos vs. flags recibidos). No es público.
*   **Problema**: Actualmente, un troll puede crear reportes falsos infinitos hasta que se le banea manualmente.
*   **Beneficio**: Permite "Shadow Banning" o revisión prioritaria para usuarios con bajo *Trust Score*, depurando el feed sin fricción manual.

### ⚡ Paginación por Cursor (Cursor-based Pagination)
*   **Tipo**: Backend / Performance
*   **Estado**: Implementado (Endpoint `GET /api/reports`)
*   **Descripción**: Se reemplazó el ineficiente `OFFSET/LIMIT` por un sistema de cursor (`created_at` + `id`) codificado en Base64.
*   **Impacto**: Tiempo de respuesta constante ($O(1)$) independientemente del tamaño de la tabla (vs $O(N)$ anterior). Fundamental para feeds infinitos.

### 3. Full text Search con `pg_trgm`
*   **Tipo**: Base de Datos
*   **Impacto**: ALTO (Usabilidad)
*   **Complejidad**: BAJA
*   **Propuesta**: Reemplazar `ILIKE` por índices GIN trigram en PostgreSQL.
*   **Problema**: La búsqueda actual es lenta y no tolera errores tipográficos ("bicicleta" vs "biccleta").
*   **Beneficio**: Búsquedas instantáneas y "Fuzzy Search" (encontrar resultados aunque el usuario escriba mal). Indispensable para móviles.

### 4. Feed "Cerca de Mí" (Geospatial Indexing)
*   **Tipo**: Full-stack
*   **Impacto**: ALTO (Engagement)
*   **Complejidad**: MEDIA
*   **Propuesta**: Usar índices PostGIS para ordenar el feed por distancia (`ST_Distance`) en lugar de cronológicamente.
*   **Problema**: El usuario ve reportes de zonas que no le interesan.
*   **Beneficio**: Hiper-relevancia. El usuario ve lo que pasa a su alrededor, aumentando la probabilidad de que comente o vote.

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

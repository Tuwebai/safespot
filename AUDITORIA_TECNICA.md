# 🛡️ Auditoría Técnica SafeSpot - Diciembre 2024

**Fecha**: 28 de Diciembre, 2024
**Versión**: v1.0 (Pre-Producción)
**Alcance**: Frontend (React/Vite), Backend (Node/Express), Database (PostgreSQL/Supabase)

---

## 🧱 1. Estado General

*   **¿Lista para producción?**: ✅ **SÍ** (Con observaciones menores).
*   **Nivel de madurez técnica**: **MEDIO-ALTO**.
    *   La arquitectura es sólida y bien desacoplada.
    *   Se han implementado patrones avanzados de resiliencia (Retry logic, Offline detection) y UX (Optimistic UI).
    *   El código es limpio, tipado (TypeScript) y modular.

---

## 🔴 2. Problemas Críticos
*(Riesgos teóricos de seguridad o estabilidad)*

1.  **RLS "Permisivo" para usuarios anónimos**
    *   **Ubicación**: Políticas SQL ([server/src/utils/rls.js](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/server/src/utils/rls.js) y [database/schema.sql](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/database/schema.sql)).
    *   **Descripción**: Las políticas de actualización/delete a menudo permiten la operación si `current_anonymous_id()` es `NULL`.
    *   **Riesgo**: Aunque el backend actual protege esto vía middleware (`requireAnonymousId`), si a futuro se expone la DB directamente o se olvida el middleware, se podrían vulnerar datos.
    *   **Recomendación**: Endurecer las políticas DB para exigir siempre un ID no nulo en operaciones de escritura.

---

## 🟠 3. Problemas Importantes
*(Impacto en performance o mantenimiento)*

1.  **Búsquedas Lentas (ILIKE) sin Índices**
    *   **Ubicación**: [server/src/routes/reports.js](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/server/src/routes/reports.js) (Filtro de búsqueda).
    *   **Descripción**: La query usa `ILIKE '%termino%'`. Esto impide el uso de índices B-Tree estándar, forzando un "Full Table Scan".
    *   **Impacto**: Con pocos datos no se nota, pero con miles de reportes la búsqueda será lenta (< 1s).
    *   **Solución**: Implementar índices GIN o GiST con la extensión `pg_trgm` de PostgreSQL.

2.  **Consulta N+1 (potencial) en `threads_count`**
    *   **Ubicación**: Listado de reportes (`GET /api/reports`).
    *   **Descripción**: Se ejecuta una subquery [(SELECT COUNT(*) ...)](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/src/App.tsx#17-42) por cada fila de reporte para contar hilos.
    *   **Impacto**: Aumenta la carga de la DB linealmente con la cantidad de reportes mostrados.
    *   **Solución**: Desnormalizar este dato en la columna `reports.threads_count` usando triggers, similar a `comments_count`.

---

## 🟡 4. Mejoras Recomendadas
*(Nice to have)*

1.  **Estandarización de `image_urls`**
    *   **Descripción**: El backend contiene lógica defensiva excesiva (`try/catch JSON.parse`) para leer `image_urls`. Esto sugiere que algunos datos históricos podrían estar "sucios" (strings planos vs arrays JSON).
    *   **Acción**: Correr una migración de limpieza y simplificar el código de lectura.

2.  **Validación de Integridad de Sesión**
    *   **Descripción**: El `anonymous_id` reside en localStorage y se envía como header.
    *   **Mejora**: A futuro, firmar este ID (JWT) para evitar que un usuario "avanzado" modifique su storage para suplantar identidades, aunque el impacto es bajo por ser un sistema anónimo.

---

## 🟢 5. Decisiones Correctas (Aciertos)

1.  **Resiliencia de Red**: La implementación reciente de [api.ts](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/src/lib/api.ts) con **Retry Logic** y Backoff Exponencial pone a la app muy por encima del estándar promedio. Protege contra inestabilidad móvil real.
2.  **Optimistic UI & Idempotencia**: Manejar los votos y favoritos como operaciones idempotentes (`200 OK` si ya existe) permite una UI fluida que "no falla" ante doble clicks.
3.  **Arquitectura de Backend**: El uso de [queryWithRLS](file:///c:/Users/Usuario/Documents/Proyectos%20Web/Safespot/server/src/utils/rls.js#3-103) centraliza la lógica de seguridad, evitando que cada endpoint tenga que gestionar manualmente la conexión de "sesión de base de datos".
4.  **Code Splitting**: La carga diferida de rutas (`React.lazy`) asegura que el bundle inicial sea ligero, crucial para móviles.

---

## 🔮 6. Problemas con Escala (Futuro)

1.  **Paginación OFFSET/LIMIT**:
    *   La paginación actual usa `OFFSET`. En bases de datos grandes, saltar a la página 1000 es lento porque la DB debe leer y descartar las filas previas.
    *   *Futuro*: Migrar a "Cursor-based pagination" (usar el ID o fecha del último elemento visto).

2.  **Bloqueos en Contadores "Hot"**:
    *   La tabla `anonymous_users` se actualiza (contadores) con cada acción. Si un usuario spamea acciones o si hay miles de usuarios concurrentes, esa tabla sufrirá de "Row Locking".
    *   *Futuro*: Mover contadores a un sistema diferido (Redis o Background Workers).

---

## 📝 Conclusión

El sistema está **técnicamente sano**. La deuda técnica es baja y aceptable para esta etapa. Los riesgos identificados son mayormente de escala futura, no impedimentos presentes.

**Acción recomendada**: Proceder al lanzamiento. Planificar la optimización de búsqueda (`pg_trgm`) para el primer patch post-lanzamiento.

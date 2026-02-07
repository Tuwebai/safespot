# 🔍 AUDITORÍA DE REGRESIÓN - PATCH Contract Fix

**Fecha:** 2026-02-06  
**Scope:** Cambio de `r.*` a proyección explícita en PATCH `/api/reports/:id`  
**Estado:** ⚠️ RISKS DETECTED - Requieren atención

---

## 🎯 RESUMEN EJECUTIVO

| Aspecto | Estado | Notas |
|---------|--------|-------|
| **Cambio Principal** | ✅ SAFE | `r.*` → Proyección explícita |
| ** likes_count** | ✅ NO EXISTE | No hay columna legacy en DB |
| **upvotes_count** | ✅ FUNCIONA | Incluido en proyección |
| **Campos Faltantes** | ⚠️ RISK | `deleted_at` no incluido |
| **Consistencia DTO** | ⚠️ RISK | Diferentes proyecciones entre endpoints |
| **Transformadores** | ✅ SAFE | No dependen de campos omitidos |

---

## 1️⃣ BASE DE DATOS AUDIT

### Schema de `reports` (database/schema.sql:38-56)
```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY,
    anonymous_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    zone VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status report_status_enum DEFAULT 'pendiente',
    upvotes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    incident_date TIMESTAMP WITH TIME ZONE
);
```

### Columnas Agregadas por Migraciones

| Columna | Migración | Estado en Proyección PATCH |
|---------|-----------|---------------------------|
| `image_urls` | migration_add_image_urls.sql | ✅ INCLUIDO |
| `is_hidden` | migration_polymorphic_v3_final.sql | ✅ INCLUIDO |
| `deleted_at` | migration_polymorphic_v3_final.sql | ⚠️ **FALTA** |
| `last_edited_at` | migration_v3_6_sync_governance_enum.sql | ✅ INCLUIDO |
| `threads_count` | migration_v3_6_sync_governance_enum.sql | ✅ INCLUIDO |
| `province` | migration_v3_6_sync_governance_enum.sql | ✅ INCLUIDO |
| `locality` | migration_v3_6_sync_governance_enum.sql | ✅ INCLUIDO |
| `department` | migration_v3_6_sync_governance_enum.sql | ✅ INCLUIDO |

### likes_count - Verificación Completa

| Ubicación | Resultado |
|-----------|-----------|
| `database/schema.sql` | ❌ No existe |
| `database/migrations/*.sql` | ❌ No existe |
| `server/src/routes/*.js` | ❌ No usa (solo guards de contrato) |
| Triggers SQL | ❌ No referencia |
| Índices | ❌ No usa |

**✅ CONCLUSIÓN:** No hay columna `likes_count` en la base de datos.

---

## 2️⃣ BACKEND AUDIT

### Proyección PATCH (FIX APLICADO)

**Archivo:** `server/src/routes/reports.js:1143-1146`

```javascript
const CANONICAL_REPORT_FIELDS = `
  r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address,
  r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count,
  r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls,
  r.province, r.locality, r.department, r.threads_count, r.is_hidden
`;
```

**⚠️ FALTA:** `r.deleted_at`

---

### Comparación de Proyecciones por Endpoint

| Campo | GET /reports | GET /reports/:id | POST /reports | PATCH /reports/:id |
|-------|-------------|------------------|---------------|-------------------|
| `id` | ✅ | ✅ | ✅ | ✅ |
| `anonymous_id` | ✅ | ✅ | ✅ | ✅ |
| `title` | ✅ | ✅ | ✅ | ✅ |
| `description` | ✅ | ✅ | ✅ | ✅ |
| `category` | ✅ | ✅ | ✅ | ✅ |
| `zone` | ✅ | ✅ | ✅ | ✅ |
| `address` | ✅ | ✅ | ✅ | ✅ |
| `latitude` | ✅ | ✅ | ✅ | ✅ |
| `longitude` | ✅ | ✅ | ✅ | ✅ |
| `status` | ✅ | ✅ | ✅ | ✅ |
| `upvotes_count` | ✅ | ✅ | ❌ | ✅ |
| `comments_count` | ✅ | ✅ | ❌ | ✅ |
| `created_at` | ✅ | ✅ | ✅ | ✅ |
| `updated_at` | ✅ | ✅ | ❌ | ✅ |
| `last_edited_at` | ✅ | ✅ | ❌ | ✅ |
| `incident_date` | ✅ | ✅ | ✅ | ✅ |
| `image_urls` | ✅ | ✅ | ❌ | ✅ |
| `is_hidden` | ✅ | ✅ | ✅ | ✅ |
| `deleted_at` | ✅ | ✅ | ❌ | ⚠️ **FALTA** |
| `threads_count` | ✅ | ❌ | ❌ | ✅ |
| `province` | ✅ | ❌ | ✅ | ✅ |
| `locality` | ✅ | ❌ | ✅ | ✅ |
| `department` | ✅ | ❌ | ✅ | ✅ |

**⚠️ INCONSISTENCIAS DETECTADAS:**
1. `deleted_at` falta en PATCH pero está en schema de frontend
2. POST no retorna contadores (`upvotes_count`, `comments_count`)
3. GET /reports/:id no retorna `threads_count`

---

## 3️⃣ FRONTEND AUDIT

### Schema (src/lib/schemas.ts)

```typescript
export const reportSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    status: z.enum([...]),
    upvotes_count: z.number().int().default(0),
    comments_count: z.number().int(),
    created_at: z.string(),
    updated_at: z.string(),
    deleted_at: z.string().nullable().optional(),  // ← ⚠️ Espera este campo
    is_hidden: z.boolean().optional(),
    // ...
});
```

### RawReport Interface (src/lib/adapters.ts:48-82)

```typescript
export interface RawReport {
    // Core fields - todos presentes en PATCH
    id: string;
    anonymous_id: string;
    title: string;
    description: string;
    category: string;
    status: 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado';
    zone: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    upvotes_count: number;
    comments_count: number;
    created_at: string;
    updated_at: string;
    last_edited_at: string | null;
    incident_date: string | null;
    
    // Optional - algunos faltan en PATCH
    threads_count?: number;  // ✅ Incluido
    is_hidden?: boolean;     // ✅ Incluido
    deleted_at?: string;     // ⚠️ FALTA en PATCH
    province?: string;       // ✅ Incluido
    locality?: string;       // ✅ Incluido
    department?: string;     // ✅ Incluido
}
```

### transformReport (src/lib/adapters.ts:144-191)

```typescript
export function transformReport(raw: RawReport): Report {
    // Guard de contrato
    if ('likes_count' in raw) {
        throw new Error('CRITICAL CONTRACT VIOLATION');
    }
    
    return {
        id: raw.id,
        title: raw.title,
        description: raw.description,
        // ...
        upvotes_count: raw.upvotes_count,  // ✅ Usa upvotes_count
        comments_count: raw.comments_count,
        // ...
        // deleted_at NO se transforma explícitamente
    };
}
```

**✅ CONCLUSIÓN:** `transformReport` no usa `deleted_at`, por lo que no hay error crítico.

---

## 4️⃣ SSE AUDIT

### emitReportUpdate (server/src/utils/eventEmitter.js:405-414)

```javascript
async emitReportUpdate(report, originClientId) {
    await this.broadcast(`report-update:${report.id}`, {
        report,  // ← Envia objeto completo recibido del router
        originClientId
    }, ...);
}
```

**Impacto:** El payload SSE depende de lo que el router le pase. Como PATCH ahora usa proyección explícita, el SSE enviará solo esos campos.

**⚠️ NOTA:** Si `deleted_at` es necesario para la lógica de "report eliminado" en tiempo real, faltará.

---

## 5️⃣ SISTEMA DE LIKES/UPVOTES AUDIT

### Mutations (src/hooks/queries/useReportsQuery.ts:304-344)

```typescript
export function useToggleReportLikeMutation() {
    return useMutation({
        mutationFn: async ({ reportId, liked }) => {
            return reportsApi.toggleLike(reportId, liked);  // Usa endpoint /:id/like
        },
        onMutate: async ({ reportId, liked }) => {
            const previousDetail = queryClient.getQueryData<Report>(...)
            if (previousDetail) {
                reportsCache.patch(queryClient, reportId, {
                    is_liked: liked,
                    upvotes_count: liked 
                        ? (previousDetail.upvotes_count || 0) + 1 
                        : Math.max(0, (previousDetail.upvotes_count || 0) - 1)
                });
            }
            return { previousDetail, reportId };
        },
        onSuccess: (result, { reportId }) => {
            // Reconciliación con servidor
            if (result && typeof result.upvotes_count === 'number') {
                reportsCache.patch(queryClient, reportId, {
                    upvotes_count: result.upvotes_count
                });
            }
        }
    });
}
```

**✅ CONCLUSIÓN:** El sistema de likes usa `upvotes_count` correctamente. No hay regresión.

---

## 6️⃣ RIESGOS IDENTIFICADOS

### 🔴 RIESGO 1: Campo `deleted_at` Faltante

| Aspecto | Detalle |
|---------|---------|
| **Archivo** | `server/src/routes/reports.js:1143-1146` |
| **Impacto** | El frontend recibe `deleted_at: undefined` después de PATCH |
| **Severidad** | 🟡 MEDIO |
| **Escenario** | Si la UI muestra estado de "eliminado" o usa `deleted_at` para lógica de moderación |

**Recomendación:** Agregar `r.deleted_at` a `CANONICAL_REPORT_FIELDS`.

---

### 🟡 RIESGO 2: Inconsistencia DTO Entre Endpoints

| Aspecto | Detalle |
|---------|---------|
| **Archivo** | Múltiples: `reports.js` |
| **Impacto** | Diferentes endpoints retornan diferentes subsets de campos |
| **Severidad** | 🟡 MEDIO |
| **Escenario** | Cache de React Query puede tener datos incompletos según origen |

**Recomendación:** Definir un `REPORT_DTO_FIELDS` constante compartida y usarla en todos los endpoints.

---

### 🟡 RIESGO 3: POST No Retorna Contadores

| Aspecto | Detalle |
|---------|---------|
| **Archivo** | `server/src/routes/reports.js:864-873` |
| **Impacto** | Después de crear report, `upvotes_count` y `comments_count` son undefined |
| **Severidad** | 🟡 MEDIO |
| **Escenario** | UI muestra contadores vacíos o 0 hasta próximo refetch |

**Recomendación:** Agregar contadores a proyección POST.

---

## 7️⃣ VALIDACIÓN DE GUARDS DE CONTRATO

### Backend Guard (server/src/index.js:98-106)

```javascript
if (jsonStr.includes('"likes_count"') || jsonStr.includes('likesCount')) {
    console.error('BACKEND CONTRACT VIOLATION');
    throw new Error('BACKEND CONTRACT VIOLATION');
}
```

**✅ Estado:** Activo en non-production. No se activará con el cambio actual.

### Frontend Guard (src/lib/adapters.ts:146-150)

```typescript
if (process.env.NODE_ENV === 'development') {
    if ('likes_count' in raw) {
        throw new Error('CRITICAL CONTRACT VIOLATION');
    }
}
```

**✅ Estado:** Activo en development. No se activará con el cambio actual.

---

## 8️⃣ CONCLUSIONES

### ✅ SAFE (Sin Riesgo)

1. **Cambio de `r.*` a proyección explícita** - No rompe funcionalidad existente
2. **Sistema de likes/upvotes** - Usa `upvotes_count` correctamente
3. **Sistema de comentarios** - No afectado
4. **Transformadores** - No dependen de campos omitidos
5. **SSE report-update** - Funciona con nuevo payload
6. **Cache React Query** - No hay problema de integridad

### ⚠️ RISKS DETECTED

1. **`deleted_at` faltante en PATCH** - Corrección recomendada
2. **Inconsistencia DTO entre endpoints** - Refactor recomendado
3. **POST no retorna contadores** - Mejora recomendada

### ❌ NO HAY BREAKING CHANGES

El cambio es **backward compatible**. No se eliminan campos que estén en uso.

---

## 9️⃣ RECOMENDACIONES

### Inmediata (Antes de deploy)

```javascript
// Agregar a CANONICAL_REPORT_FIELDS en PATCH
const CANONICAL_REPORT_FIELDS = `
  r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address,
  r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count,
  r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls,
  r.province, r.locality, r.department, r.threads_count, r.is_hidden,
  r.deleted_at  // ← AGREGAR
`;
```

### Corto Plazo

1. Crear constante `REPORT_DTO_FIELDS` compartida
2. Refactorizar todos los endpoints para usar la misma proyección
3. Normalizar campos retornados por POST

### Mediano Plazo

1. Documentar contrato DTO en OpenAPI/Swagger
2. Agregar tests de contrato automatizados
3. Considerar eliminar `deleted_at` del schema si no se usa

---

**Fin del Reporte de Auditoría de Regresión**

# 🔧 PATCH Contract Fix - Report Update

**Fecha:** 2026-02-06  
**Problema:** CRITICAL CONTRACT VIOLATION - `likes_count` en respuesta PATCH  
**Fix Aplicado:** Proyección SQL explícita reemplazando `r.*`

---

## 🚨 Problema Identificado

El endpoint PATCH `/api/reports/:id` usaba `r.*` en la consulta SQL:

```javascript
// ANTES (server/src/routes/reports.js:1141-1153)
const updateResult = await queryWithRLS(anonymousId, `
  WITH updated_report AS (
    UPDATE reports SET ${updates.join(', ')}
    WHERE id = $1 AND anonymous_id = $2
    RETURNING *
  )
  SELECT 
    r.*,           // ← 🟥 Retorna TODAS las columnas
    u.alias,
    u.avatar_url
  FROM updated_report r
  LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
`, params);
```

**Impacto:**
- Si la tabla `reports` tiene columna legacy `likes_count`, se incluye en la respuesta
- Frontend `transformReport()` detecta `likes_count` y lanza CRITICAL CONTRACT VIOLATION
- La UI puede fallar en desarrollo o loggear errores en producción

---

## ✅ Fix Aplicado

```javascript
// DESPUÉS (server/src/routes/reports.js:1139-1165)
// ⚠️ CONTRACT ENFORCEMENT: Explicit projection to exclude legacy fields (likes_count)
const CANONICAL_REPORT_FIELDS = `
  r.id, r.anonymous_id, r.title, r.description, r.category, r.zone, r.address,
  r.latitude, r.longitude, r.status, r.upvotes_count, r.comments_count,
  r.created_at, r.updated_at, r.last_edited_at, r.incident_date, r.image_urls,
  r.province, r.locality, r.department, r.threads_count, r.is_hidden
`;

const updateResult = await queryWithRLS(anonymousId, `
  WITH updated_report AS (
    UPDATE reports SET ${updates.join(', ')}
    WHERE id = $1 AND anonymous_id = $2
    RETURNING *
  )
  SELECT 
    ${CANONICAL_REPORT_FIELDS},  // ← ✅ Solo campos canónicos
    u.alias,
    u.avatar_url
  FROM updated_report r
  LEFT JOIN anonymous_users u ON r.anonymous_id = u.anonymous_id
`, params);
```

---

## 📋 Campos Canónicos (DTO)

| Categoría | Campos |
|-----------|--------|
| **Core** | `id`, `anonymous_id` |
| **Content** | `title`, `description`, `category`, `status` |
| **Location** | `zone`, `address`, `latitude`, `longitude`, `province`, `locality`, `department` |
| **Engagement** | `upvotes_count` ✅, `comments_count`, `threads_count` |
| **Metadata** | `created_at`, `updated_at`, `last_edited_at`, `incident_date`, `image_urls`, `is_hidden` |
| **Enrichment** | `alias`, `avatar_url` (JOIN) |

**🚫 Excluidos intencionalmente:**
- `likes_count` (legacy naming)
- `like_count` (legacy naming)  
- `votes_count` (ambiguous)
- Cualquier campo agregado no listado

---

## 🔍 Verificación de Otros Endpoints

| Endpoint | Query Type | Status |
|----------|------------|--------|
| `GET /api/reports` | Explicit fields | ✅ OK |
| `GET /api/reports/:id` | Explicit fields | ✅ OK |
| `POST /api/reports` | Explicit fields | ✅ OK |
| `PATCH /api/reports/:id` | ~~`r.*`~~ → Explicit | ✅ **FIXED** |

---

## 🛡️ Guards de Contrato

### Backend (server/src/index.js:98-106)
```javascript
if (process.env.NODE_ENV !== 'production') {
  const jsonStr = JSON.stringify(body);
  if (jsonStr.includes('"likes_count"') || jsonStr.includes('likesCount')) {
    throw new Error('BACKEND CONTRACT VIOLATION: legacy field detected');
  }
}
```

### Frontend (src/lib/adapters.ts:146-150)
```typescript
if (process.env.NODE_ENV === 'development') {
  if ('likes_count' in raw) {
    throw new Error('❌ CRITICAL CONTRACT VIOLATION: likes_count detected');
  }
}
```

---

## 📁 Archivos Modificados/Creados

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `server/src/routes/reports.js` | ✅ Modificado | Fix de proyección SQL en PATCH |
| `server/src/routes/reports-contract.md` | ✅ Creado | Documentación del contrato |
| `AUDIT_PATCH_CONTRACT_FIX.md` | ✅ Creado | Este reporte |

---

## 🧪 Testing Recomendado

1. **Test de contrato:**
   ```bash
   # Editar un reporte
   curl -X PATCH /api/reports/:id \
     -H "Content-Type: application/json" \
     -d '{"title": "Test"}'
   
   # Verificar que la respuesta NO contiene likes_count
   ```

2. **Test de UI:**
   - Editar reporte en UI
   - Confirmar que no hay errores en consola
   - Verificar que no hay rollback

3. **Test de integridad:**
   - Confirmar que `upvotes_count` sigue funcionando
   - Verificar que los campos esperados están presentes

---

## 📝 Notas

- El fix es **backward compatible** - no cambia la estructura de respuesta, solo excluye campos legacy
- Los tests existentes deberían pasar sin modificaciones
- Se recomienda agregar una migración para eliminar `likes_count` de la DB si existe

---

**Fix aplicado por:** Auditoría Automática  
**Estado:** ✅ COMPLETADO

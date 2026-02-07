# Report API Contract Specification

## Canonical Report Fields (DTO)

Los siguientes campos SON permitidos en las respuestas de Report API:

### Core Identity
- `id` (uuid)
- `anonymous_id` (uuid) - Se transforma a `author` en frontend

### Content
- `title` (string)
- `description` (string)
- `category` (string)
- `status` (enum: 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado' | 'rechazado')

### Location
- `zone` (string|null)
- `address` (string|null)
- `latitude` (number|null)
- `longitude` (number|null)
- `province` (string|null)
- `locality` (string|null)
- `department` (string|null)

### Engagement (SSOT Counters)
- `upvotes_count` (integer) - ✅ Nombre canónico
- `comments_count` (integer)
- `threads_count` (integer)

### Metadata
- `created_at` (iso timestamp)
- `updated_at` (iso timestamp)
- `last_edited_at` (iso timestamp|null)
- `incident_date` (iso timestamp|null)
- `image_urls` (string[])
- `is_hidden` (boolean)

### Enrichment (JOIN con anonymous_users)
- `alias` (string|null)
- `avatar_url` (string|null)

### User Context (computed per request)
- `is_favorite` (boolean)
- `is_flagged` (boolean)
- `is_liked` (boolean)

## 🚫 CAMPOS PROHIBIDOS (Legacy)

Estos campos NUNCA deben ser retornados:

| Campo | Razón | Reemplazo |
|-------|-------|-----------|
| `likes_count` | Legacy naming | `upvotes_count` |
| `like_count` | Legacy naming | `upvotes_count` |
| `votes_count` | Ambiguous | `upvotes_count` |
| `report_count` | Wrong context | - |
| `total_likes` | Legacy naming | - |

## SQL Contract Enforcement

### ❌ INCORRECTO (Permite filtrar campos legacy)
```sql
SELECT r.*, u.alias, u.avatar_url FROM reports r ...
```

### ✅ CORRECTO (Proyección explícita)
```sql
SELECT 
  r.id, r.anonymous_id, r.title, r.description, r.category,
  r.zone, r.address, r.latitude, r.longitude, r.status,
  r.upvotes_count, r.comments_count, r.threads_count,
  r.created_at, r.updated_at, r.last_edited_at, r.incident_date,
  r.image_urls, r.province, r.locality, r.department, r.is_hidden,
  u.alias, u.avatar_url
FROM reports r ...
```

## Endpoints Verificados

| Endpoint | Status | Notas |
|----------|--------|-------|
| GET /api/reports | ✅ | Proyección explícita |
| GET /api/reports/:id | ✅ | Proyección explícita |
| POST /api/reports | ✅ | Proyección explícita |
| PATCH /api/reports/:id | ✅ FIX APPLIED | Era `r.*`, ahora proyección explícita |

## Guards de Contrato

### Backend (server/src/index.js:98-106)
```javascript
if (JSON.stringify(body).includes('"likes_count"')) {
  throw new Error('BACKEND CONTRACT VIOLATION: legacy field detected');
}
```

### Frontend (src/lib/adapters.ts:146-150)
```typescript
if ('likes_count' in raw) {
  throw new Error('CRITICAL CONTRACT VIOLATION: likes_count detected');
}
```

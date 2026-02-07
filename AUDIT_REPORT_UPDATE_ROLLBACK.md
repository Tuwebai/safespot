# 🔍 AUDITORÍA: Report Update Rollback (~1s después de éxito)

**Fecha:** 2026-02-06  
**Objetivo:** Identificar la línea exacta que provoca rollback en PATCH /api/reports/:id  
**Clasificación:** REALTIME OVERWRITE

---

## 📋 RESUMEN EJECUTIVO

**Problema identificado:** El evento SSE `report-update` enviado desde el backend **DESPUÉS** del PATCH exitoso contiene datos **DESNORMALIZADOS** que sobrescriben el estado actualizado del cache del frontend.

**Causa raíz:** El backend en `eventEmitter.js:405-414` envía el objeto `report` completo sin normalizar, pero el frontend espera un formato específico. Esto crea una "falsa actualización" que el frontend aplica al cache, causando rollback visual.

**Clasificación:** `REALTIME OVERWRITE` con `PAYLOAD MISMATCH`

---

## 🔎 EVIDENCIA TÉCNICA

### 1. BACKEND - Emisión del Evento (línea problemática)

**Archivo:** `server/src/utils/eventEmitter.js:405-414`

```javascript
async emitReportUpdate(report, originClientId) {
    await this.broadcast(`report-update:${report.id}`, {
        report,           // ← 🟥 PROBLEMA: Envía objeto completo
        originClientId
    }, {
        aggregateType: 'report',
        aggregateId: report.id
    });
    console.log(`[Realtime] Broadcasted report update for ${report.id}`);
}
```

**Archivo:** `server/src/routes/reports.js:1163-1171` (donde se emite)

```javascript
// REALTIME: Broadcast report update using local enriched data (CTE)
try {
    realtimeEvents.emitReportUpdate(updatedReport);  // ← Llama al método anterior
    // ...
}
```

**Payload que envía el backend:**
```json
{
  "report": {
    "id": "uuid",
    "title": "Nuevo título",
    "description": "Nueva descripción",
    "alias": "usuario",
    "avatar_url": "url",
    // ... campos de DB directos
  },
  "originClientId": "xxx",
  "eventId": "uuid",
  "serverTimestamp": 1234567890
}
```

---

### 2. FRONTEND - Cómo procesa el evento SSE

**Archivo:** `src/lib/realtime/RealtimeOrchestrator.ts:557-574`

```typescript
case 'report-update': {
    if (data.isLikeDelta || payload.isLikeDelta) {
        reportsCache.applyLikeDelta(queryClient, id, data.delta || payload.delta);
    } else if (data.isCommentDelta || payload.isCommentDelta) {
        reportsCache.applyCommentDelta(queryClient, id, data.delta || payload.delta);
    } else {
        const parsed = reportSchema.partial().safeParse(payload);  // ← 🟥 VALIDA payload
        if (parsed.success) {
            if (parsed.data.is_hidden === true) {
                reportsCache.remove(queryClient, id);
            } else {
                reportsCache.patch(queryClient, id, parsed.data);  // ← Aplica al cache
            }
        }
    }
    break;
}
```

**Archivo:** `src/lib/realtime/RealtimeOrchestrator.ts:458-463`

```typescript
case 'report-update': {
    if (id) {
        reportsCache.patch(queryClient, id, payload);  // ← 🟥 Procesa en social domain también
    }
    break;
}
```

---

### 3. FRONTEND - Mutación y su onSuccess

**Archivo:** `src/hooks/queries/useReportsQuery.ts:161-195`

```typescript
export function useUpdateReportMutation() {
    const queryClient = useQueryClient()
    const { checkAuth } = useAuthGuard()

    return useMutation({
        mutationFn: async ({ id, data }: { id: string; data: Partial<CreateReportData> }) => {
            if (!checkAuth()) throw new Error('AUTH_REQUIRED');
            return reportsApi.update(id, data);  // ← PATCH /api/reports/:id
        },
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.all })
            await queryClient.cancelQueries({ queryKey: queryKeys.reports.detail(id) })
            const previousDetail = queryClient.getQueryData<Report>(queryKeys.reports.detail(id))
            reportsCache.patch(queryClient, id, data as unknown as Partial<Report>)  // ← Optimistic
            return { previousDetail }
        },
        onError: (_err, { id }, context) => {
            if (context?.previousDetail) {
                queryClient.setQueryData(queryKeys.reports.detail(id), context.previousDetail)
            }
        },
        onSettled: () => {
            // ✅ ENTERPRISE RULE: Never invalidate stats manually on update. SSE handles it.
            // ← 🟥 NO HAY invalidación explícita, pero SSE llega automáticamente
        }
    })
}
```

**Nota crítica:** El `onSettled` NO invalida queries, pero el evento SSE llega de todas formas porque el backend lo emite inmediatamente.

---

### 4. SECUENCIA DE EVENTOS (Timeline)

```
T0:    Usuario hace click en "Guardar"
T1:    onMutate ejecuta → optimistic patch al cache
       UI refleja cambios inmediatamente ✓

T2:    PATCH /api/reports/:id enviado al servidor

T3:    Backend actualiza DB y responde 200 OK
       Response: { success: true, data: updatedReport }

T4:    Frontend recibe respuesta HTTP
       onSuccess NO actualiza cache (no está implementado)
       Cache mantiene optimistic data

T5:    Backend emite evento SSE `report-update:${id}` (DESDE eventEmitter.js)
       Esto ocurre DESPUÉS de enviar la respuesta HTTP

T6:    ~1 segundo después (delay de red + procesamiento SSE)
       Frontend recibe evento SSE report-update

T7:    RealtimeOrchestrator.processFeedDomainLogic() procesa el evento
       payload = data.partial || data.payload || data
       
       🟥 PROBLEMA: El payload contiene { report: {...} }, no el report directo
       
       Si reportSchema.partial().safeParse({ report: {...} }) falla o 
       procesa el objeto incorrecto → patch con datos incorrectos

T8:    Cache se actualiza con datos del SSE
       Si los datos del SSE no están normalizados o contienen estructura diferente,
       el patch sobrescribe los datos optimistas con versión antigua o malformada

T9:    UI hace rollback al estado del SSE
```

---

### 5. ANÁLISIS DEL PAYLOAD SSE

**Contrato esperado por RealtimeOrchestrator.ts (línea 544):**
```typescript
const payload = data.partial || data.payload || data;
```

**Lo que envía el backend (eventEmitter.js:406-409):**
```javascript
{
    report: { ... },  // ← El objeto real está anidado en "report"
    originClientId
}
```

**Resultado:** 
- `payload = data.partial` → undefined
- `payload = data.payload` → undefined  
- `payload = data` → `{ report: {...}, originClientId: "..." }`

El schema `reportSchema.partial().safeParse(payload)` valida contra `{ report: {...} }` en lugar del report mismo, lo que causa:
1. O bien el parse falla silenciosamente (zod safeParse)
2. O bien el Orchestrator procesa el objeto incorrecto

---

### 6. EVIDENCIA DEL BACKEND REALTIME ROUTE

**Archivo:** `server/src/routes/realtime.js:379-391`

```javascript
const handleReportUpdate = (data) => {
    // Payload from eventEmitter.emitVoteUpdate: { ...updates, originClientId, eventId, serverTimestamp }
    const { originClientId, eventId, serverTimestamp, sequence_id, ...updates } = data;

    stream.send('report-update', {
        id: reportId,
        partial: updates,      // ← 🟥 Enviado como partial
        originClientId,
        eventId,
        serverTimestamp,
        sequence_id
    });
};
```

**PERO** `emitReportUpdate` (usado en reports.js:1163) envía:
```javascript
{
    report: { ... },  // ← NO hay campo 'partial', está anidado en 'report'
    originClientId
}
```

---

## 🎯 LÍNEAS EXACTAS DEL PROBLEMA

| Archivo | Línea | Código Problemático |
|---------|-------|---------------------|
| `server/src/utils/eventEmitter.js` | 405-414 | `emitReportUpdate` envía `{ report, originClientId }` en lugar de `{ partial: report, ... }` |
| `server/src/routes/reports.js` | 1163-1171 | Llama a `emitReportUpdate(updatedReport)` que dispara el evento |
| `src/lib/realtime/RealtimeOrchestrator.ts` | 544, 557-574 | Espera `data.partial` o `data.payload` pero recibe `data.report` |

---

## 🔧 CONFIRMACIÓN DEL PROBLEMA

Para confirmar esta hipótesis, agregar estos logs:

### Backend (server/src/routes/reports.js:1163-1178)
```javascript
// REALTIME: Broadcast report update using local enriched data (CTE)
try {
    console.log('[PATCH REPORT] About to emit SSE:', {
        id: updatedReport.id,
        title: updatedReport.title,
        timestamp: Date.now()
    });
    realtimeEvents.emitReportUpdate(updatedReport);
    // ...
}
```

### Frontend (src/lib/realtime/RealtimeOrchestrator.ts:542-545)
```typescript
private async processFeedDomainLogic(type: string, data: any) {
    const payload = data.partial || data.payload || data;
    const id = data.id || payload.id;
    
    // LOG DEBUG
    if (type === 'report-update') {
        console.log('[REALTIME REPORT-UPDATE] Raw data:', data);
        console.log('[REALTIME REPORT-UPDATE] Extracted payload:', payload);
        console.log('[REALTIME REPORT-UPDATE] Extracted id:', id);
    }
    // ...
}
```

---

## 📊 CLASIFICACIÓN FINAL

| Categoría | Valor |
|-----------|-------|
| **Tipo de problema** | `REALTIME OVERWRITE` |
| **Subtipo** | `PAYLOAD MISMATCH` |
| **Causa** | Inconsistencia de contrato entre backend y frontend |
| **Severidad** | Media-Alta |
| **Impacto** | UX degradada - usuario ve rollback visual |

---

## ✅ POSIBLES SOLUCIONES

### Opción 1: Corregir el backend (Recomendada)
**Archivo:** `server/src/utils/eventEmitter.js:405-414`

```javascript
async emitReportUpdate(report, originClientId) {
    await this.broadcast(`report-update:${report.id}`, {
        partial: report,        // ← Cambiar de 'report' a 'partial'
        originClientId
    }, {
        aggregateType: 'report',
        aggregateId: report.id
    });
}
```

### Opción 2: Corregir el frontend
**Archivo:** `src/lib/realtime/RealtimeOrchestrator.ts:544`

```typescript
const payload = data.partial || data.payload || data.report || data;  // ← Agregar data.report
```

### Opción 3: Desactivar echo suppression para el originClientId
**Archivo:** `src/lib/realtime/RealtimeOrchestrator.ts:240`

Verificar si el evento viene del mismo cliente y descartarlo:
```typescript
if (originClientId === this.myClientId) {
    console.log('[Orchestrator] Ignoring self-echo event');
    return;
}
```

---

## 📝 NOTAS ADICIONALES

1. **Echo Suppression:** El `RealtimeOrchestrator` ya tiene lógica de supresión de ecos (`eventAuthorityLog.shouldProcess`), pero esto solo previene duplicados por eventId, no corrige payloads incorrectos.

2. **BroadcastChannel:** El evento también se propaga a través de BroadcastChannel a otras tabs (línea 365), lo que significa que el rollback podría ocurrir en tabs inactivas también.

3. **Leadership:** Solo el líder persiste eventos (línea 262), pero todos los followers procesan el evento a través del BroadcastChannel.

---

**Fin del Reporte de Auditoría**

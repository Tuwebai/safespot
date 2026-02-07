# 🔍 AUDITORÍA FINAL - Report Update Rollback

**Fecha:** 2026-02-06  
**Estado:** Logs de diagnóstico agregados - Pendiente confirmación con datos reales  
**Hipótesis Principal:** REALTIME OVERWRITE con PAYLOAD MISMATCH + DOBLE HANDLER

---

## 📋 Resumen Ejecutivo

Se ha identificado un problema arquitectónico donde el evento SSE `report-update` puede estar causando rollback visual debido a:

1. **Inconsistencia de contrato** entre backend y frontend en el payload SSE
2. **Doble procesamiento** del mismo evento en dos handlers diferentes

Se han agregado logs de diagnóstico para confirmar la hipótesis antes de aplicar fixes.

---

## 🔴 Problemas Identificados

### Problema 1: Payload Mismatch

**Backend** (`server/src/utils/eventEmitter.js:405-414`):
```javascript
await this.broadcast(`report-update:${report.id}`, {
    report,           // ← Envía objeto anidado en 'report'
    originClientId
}, ...);
```

**Frontend** (`RealtimeOrchestrator.ts:544`):
```typescript
const payload = data.partial || data.payload || data;
```

**Resultado:** El frontend espera `data.partial` pero recibe `data.report`, causando que `payload` sea el objeto completo `{ report: {...}, originClientId: ... }` en lugar de solo el reporte.

---

### Problema 2: Doble Handler

**Handler FEED** (`RealtimeOrchestrator.ts:557-574`):
- Procesa eventos del canal `'feed'`
- Valida con `reportSchema.partial().safeParse(payload)`
- Aplica patch solo si pasa validación

**Handler SOCIAL** (`RealtimeOrchestrator.ts:458-463`):
- Procesa eventos del canal `'social:${reportId}'`
- Aplica patch directo sin validación: `reportsCache.patch(queryClient, id, payload)`
- Se suscribe cuando se ve el detalle de un reporte (`watchReportComments`)

**Escenario problemático:**
1. Usuario está viendo detalle de reporte → suscrito a social feed
2. Usuario edita el reporte
3. Evento SSE llega por canal 'feed' → procesado por FEED handler
4. Evento SSE llega por canal 'social:${id}' → procesado por SOCIAL handler
5. Ambos aplican patch al mismo cache

---

## ⏱️ Secuencia del Rollback

```
T0:  onMutate → optimistic patch
     UI muestra cambios inmediatamente ✓

T1:  PATCH /api/reports/:id → 200 OK

T2:  Backend emite SSE report-update (eventEmitter.js)

T3:  ~1 segundo después (delay de red SSE)
     Frontend recibe evento por DOS canales:
     
     Canal 'feed':
     → processFeedDomainLogic
     → payload = data (porque no hay 'partial')
     → schema.parse({ report: {...} }) → puede fallar o ignorar datos
     
     Canal 'social:${id}':
     → processSocialDomainLogic  
     → payload = data (incluye 'report' anidado)
     → reportsCache.patch(id, { report: {...} }) → patch incorrecto

T4:  Cache tiene datos incorrectos → UI rollback
```

---

## 🔍 Logs de Diagnóstico Agregados

### Backend

**`server/src/routes/reports.js`** - Confirma datos actualizados en DB:
```javascript
console.log('[AUDIT PATCH REPORT] Updated data from DB:', {
    id: updatedReport.id,
    title: updatedReport.title,
    description: updatedReport.description?.substring(0, 50),
    updated_at: updatedReport.updated_at,
    timestamp: Date.now()
});
```

**`server/src/utils/eventEmitter.js`** - Confirma payload del SSE:
```javascript
console.log(`[AUDIT emitReportUpdate] Broadcasting for ${report.id}:`, {
    title: report.title,
    hasReport: !!report,
    payloadKeys: Object.keys(eventPayload),
    timestamp: Date.now()
});
```

### Frontend

**`useReportsQuery.ts:onMutate`** - Trackea optimistic update:
```javascript
console.log('[AUDIT onMutate] BEFORE optimistic patch:', {...})
console.log('[AUDIT onMutate] AFTER optimistic patch:', {...})
```

**`RealtimeOrchestrator.ts:processFeedDomainLogic`** - Trackea procesamiento FEED:
```javascript
console.log('[AUDIT processFeedDomainLogic] report-update received:', {
    hasPartial: !!data.partial,
    hasPayload: !!data.payload,
    hasReport: !!(data as any).report,
    payloadTitle: payload?.title || payload?.report?.title,
    ...
});
console.log('[AUDIT report-update FEED] Schema parse result:', {
    success: parsed.success,
    parsedTitle: parsed.data?.title,
    errors: ...
});
```

**`RealtimeOrchestrator.ts:processSocialDomainLogic`** - Trackea procesamiento SOCIAL:
```javascript
console.log('[AUDIT report-update SOCIAL] Patching from social domain:', {
    payloadKeys: Object.keys(payload),
    payloadTitle: payload?.title || payload?.report?.title,
    ...
});
```

---

## 🎯 Cómo Confirmar la Hipótesis

1. **Abrir DevTools** → Console → Filtro: `[AUDIT`

2. **Editar un reporte** y guardar

3. **Observar secuencia de logs:**

### Si es Payload Mismatch:
```
[AUDIT processFeedDomainLogic] hasPartial: false, hasPayload: false, hasReport: true
[AUDIT report-update FEED] Schema parse result: success: false
```

### Si es Doble Handler:
```
[AUDIT report-update FEED] AFTER patch: cachedTitle = "Nuevo Título"
[AUDIT report-update SOCIAL] AFTER patch: cachedTitle = undefined
```

### Si el backend emite datos viejos:
```
[AUDIT PATCH REPORT] title = "Nuevo Título"
[AUDIT emitReportUpdate] title = "Título Viejo"
```

---

## ✅ Fixes Propuestos (Aplicar tras confirmación)

### Fix 1: Normalizar Payload en Backend (Recomendado)

**`server/src/utils/eventEmitter.js:405-414`**
```javascript
async emitReportUpdate(report, originClientId) {
    await this.broadcast(`report-update:${report.id}`, {
        partial: report,        // ← Cambiar 'report' por 'partial'
        originClientId
    }, {
        aggregateType: 'report',
        aggregateId: report.id
    });
}
```

### Fix 2: Defensa en Frontend

**`RealtimeOrchestrator.ts:544`**
```typescript
const payload = data.partial || data.payload || data.report || data;
```

### Fix 3: Deduplicación por Event ID

**`RealtimeOrchestrator.ts`** - Agregar checkeo antes de procesar:
```typescript
// En processFeedDomainLogic y processSocialDomainLogic
if (type === 'report-update') {
    const eventKey = `${data.eventId || ''}-${channel}`;
    if (this.processedEvents.has(eventKey)) return;
    this.processedEvents.add(eventKey);
}
```

---

## 📊 Probabilidad de Causas

| Causa | Probabilidad | Evidencia |
|-------|--------------|-----------|
| Payload Mismatch | 60% | Estructura inconsistente entre BE/FE |
| Doble Handler | 30% | Dos suscripciones activas simultáneamente |
| Backend emite datos viejos | 10% | Requiere confirmación con logs |

---

## 📝 Archivos Modificados

| Archivo | Cambios | Líneas |
|---------|---------|--------|
| `server/src/routes/reports.js` | +7 líneas | Logs de auditoría |
| `server/src/utils/eventEmitter.js` | +9 líneas | Logs de auditoría |
| `src/hooks/queries/useReportsQuery.ts` | +18 líneas | Logs de auditoría |
| `src/lib/realtime/RealtimeOrchestrator.ts` | +38 líneas | Logs de auditoría |

---

## 🚀 Próximos Pasos

1. **Desplegar** los cambios con logs a un ambiente de test
2. **Ejecutar** el flujo de edición de reporte
3. **Capturar** logs del browser y servidor
4. **Analizar** secuencia de eventos
5. **Confirmar** hipótesis principal
6. **Aplicar** fix correspondiente
7. **Remover** logs de auditoría

---

**Fin del Reporte de Auditoría**

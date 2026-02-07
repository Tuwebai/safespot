# 📋 GUÍA DE INTERPRETACIÓN DE LOGS - Report Update Rollback

## 🔍 Logs Agregados

### 1. Backend Logs

#### `server/src/routes/reports.js:1163`
```
[AUDIT PATCH REPORT] Updated data from DB:
  - id: <uuid>
  - title: <nuevo título>
  - description: <nueva descripción>
  - updated_at: <timestamp>
  - timestamp: <Date.now()>
```
**Propósito:** Confirmar qué datos se actualizaron realmente en la DB.

#### `server/src/utils/eventEmitter.js:405`
```
[AUDIT emitReportUpdate] Broadcasting for <id>:
  - title: <título que se envía>
  - hasReport: true/false
  - payloadKeys: ['report', 'originClientId']
  - timestamp: <Date.now()>
```
**Propósito:** Verificar la estructura exacta del payload SSE.

---

### 2. Frontend Logs

#### `src/hooks/queries/useReportsQuery.ts:onMutate`
```
[AUDIT onMutate] BEFORE optimistic patch:
  - id: <uuid>
  - previousTitle: <título anterior>
  - newTitle: <nuevo título>
  - timestamp: <performance.now()>

[AUDIT onMutate] AFTER optimistic patch:
  - id: <uuid>
  - cachedTitle: <título en cache después del patch>
  - timestamp: <performance.now()>
```
**Propósito:** Confirmar que el optimistic update se aplica correctamente.

#### `src/lib/realtime/RealtimeOrchestrator.ts:processFeedDomainLogic`
```
[AUDIT processFeedDomainLogic] report-update received:
  - id: <uuid>
  - hasPartial: true/false
  - hasPayload: true/false
  - hasReport: true/false
  - payloadTitle: <título extraído del payload>
  - dataKeys: ['report', 'originClientId', ...]
  - timestamp: <performance.now()>

[AUDIT report-update FEED] Schema parse result:
  - success: true/false
  - id: <uuid>
  - parsedTitle: <título después de parsear>
  - errors: [...] (si hay errores de validación)
  - timestamp: <performance.now()>

[AUDIT report-update FEED] AFTER patch:
  - id: <uuid>
  - cachedTitle: <título en cache después del patch>
  - timestamp: <performance.now()>
```
**Propósito:** Ver qué datos llegan por SSE y cómo se procesan en el dominio FEED.

#### `src/lib/realtime/RealtimeOrchestrator.ts:processSocialDomainLogic`
```
[AUDIT report-update SOCIAL] Patching from social domain:
  - id: <uuid>
  - payloadKeys: ['report', ...]
  - payloadTitle: <título extraído>
  - timestamp: <performance.now()>

[AUDIT report-update SOCIAL] AFTER patch:
  - id: <uuid>
  - cachedTitle: <título en cache después del patch>
  - timestamp: <performance.now()>
```
**Propósito:** Verificar si también se procesa en el dominio SOCIAL (doble procesamiento).

---

## 🎯 Escenarios Esperados

### Escenario A: Payload Mismatch (Hipótesis Principal)

**Logs esperados:**
```
[AUDIT onMutate] AFTER optimistic patch: cachedTitle = "Nuevo Título"
[AUDIT processFeedDomainLogic] hasPartial: false, hasPayload: false, hasReport: true
[AUDIT report-update FEED] Schema parse result: success: false, errors: [...]
```
**Resultado:** El schema validation falla porque el payload tiene `report` en lugar de `partial`.

---

### Escenario B: Doble Patch (Social + Feed)

**Logs esperados:**
```
[AUDIT onMutate] AFTER optimistic patch: cachedTitle = "Nuevo Título"
[AUDIT report-update FEED] AFTER patch: cachedTitle = "Nuevo Título"
[AUDIT report-update SOCIAL] AFTER patch: cachedTitle = "Título Viejo"
```
**Resultado:** El handler SOCIAL pisa los datos con información incorrecta.

---

### Escenario C: Backend Emite Datos Viejos

**Logs esperados:**
```
[AUDIT PATCH REPORT] Updated data from DB: title = "Nuevo Título"
[AUDIT emitReportUpdate] title = "Título Viejo"
```
**Resultado:** El backend emite datos diferentes a los que actualizó en DB.

---

### Escenario D: Parse Incorrecto (Payload anidado)

**Logs esperados:**
```
[AUDIT processFeedDomainLogic] payloadTitle = undefined
[AUDIT report-update FEED] Schema parse result: success: true, parsedTitle = undefined
```
**Resultado:** El schema parsea exitosamente pero extrae `undefined` porque busca `title` en el nivel superior, no en `report.title`.

---

## ⏱️ Timeline de Logs Esperado

```
T0: [AUDIT onMutate] BEFORE optimistic patch
T1: [AUDIT onMutate] AFTER optimistic patch        ← UI muestra cambio
T2: [AUDIT PATCH REPORT] Updated data from DB
T3: [AUDIT emitReportUpdate] Broadcasting...
T4: [AUDIT processFeedDomainLogic] report-update received  ← ~1s después
T5: [AUDIT report-update FEED] Schema parse result
T6: [AUDIT report-update FEED] AFTER patch
T7: [AUDIT report-update SOCIAL] Patching... (si aplica)
T8: [AUDIT report-update SOCIAL] AFTER patch
```

---

## 🔧 Cómo Ejecutar el Test

1. Abrir DevTools → Console
2. Filtrar por `[AUDIT`
3. Editar un reporte
4. Guardar cambios
5. Observar la secuencia de logs

## 📊 Interpretación de Resultados

| Secuencia de Logs | Diagnóstico | Fix Sugerido |
|-------------------|-------------|--------------|
| FEED success:true pero título undefined | Payload anidado en `report` | Normalizar payload en backend |
| SOCIAL ejecuta después de FEED con datos diferentes | Doble procesamiento | Agregar deduplicación por eventId |
| emitReportUpdate muestra título viejo | Backend emite antes de commit | Mover emisión después del COMMIT |
| Schema parse success:false | Payload no cumple contrato | Corregir estructura del evento |

---

**Nota:** No hacer cambios de código hasta confirmar con logs reales.

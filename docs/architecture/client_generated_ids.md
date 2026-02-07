# Client-Generated IDs: Regla Arquitectónica Obligatoria

## 🎯 Principio

**TODOS los recursos creados por el cliente DEBEN usar client-generated UUIDs**.

---

## 📋 Regla

1. **Generar UUID en Intention Layer** (donde se llama `mutateAsync`)
2. **Pasar UUID a `mutateAsync`** como parámetro
3. **Backend DEBE respetar** client-generated ID si es válido
4. **Fallback a DB-generated** solo si ID no se envía o es inválido

---

## ✅ Patrón Validado

### Frontend

```typescript
// ❌ INCORRECTO: Generar en onMutate
onMutate: async (data) => {
    const id = crypto.randomUUID();  // ❌ NO
    // ...
}

// ✅ CORRECTO: Generar en intention layer
const handleCreate = async () => {
    const id = crypto.randomUUID();  // ✅ SÍ
    
    await createMutation.mutateAsync({
        id,  // ✅ PASAR ID
        // ... otros datos
    });
};
```

### Backend

```javascript
// ✅ CORRECTO: Respetar client-generated ID
const resourceId = (req.body.id && isValidUuid(req.body.id)) 
    ? req.body.id 
    : crypto.randomUUID();
```

---

## 🔍 Validación

**Test obligatorio**: Crear → Editar inmediatamente (sin refresh) → Debe funcionar.

---

## 📌 Módulos Aplicados

- ✅ Comments (implementado)
- ✅ Reports (implementado)
- [ ] Chats (pendiente auditoría)
- [ ] Notifications (pendiente auditoría)

---

## ⚠️ Por Qué Esta Regla es Crítica

### Problema: ID Drift

**Sin client-generated ID**:
1. Frontend genera UUID en `onMutate` para optimistic update
2. Frontend NO envía UUID al backend
3. Backend genera su propio UUID
4. **Resultado**: Dos UUIDs diferentes en cache vs DB
5. **Impacto**: 404 en PATCH si se edita antes de reconciliación

**Con client-generated ID**:
1. Frontend genera UUID en intention layer
2. Frontend envía UUID al backend
3. Backend respeta UUID del frontend
4. **Resultado**: MISMO UUID en cache y DB
5. **Impacto**: Edición inmediata funciona correctamente

---

## 🧠 Ejemplos Reales

### Ejemplo 1: Comments (Implementado)

**Archivo**: `src/hooks/useCommentsManager.ts:254-265`

```typescript
const submitComment = async (rich: string, plain: string) => {
    // ✅ ENTERPRISE FIX: Generate UUID BEFORE mutation
    const commentId = crypto.randomUUID()

    await createMutation.mutateAsync({
        id: commentId,  // ✅ IDENTITY INTEGRITY
        report_id: reportId,
        content: rich || plain,
    })
}
```

**Backend**: `server/src/routes/comments.js:378`

```javascript
const clientGeneratedId = isValidUuid(req.body.id) ? req.body.id : null;
```

---

### Ejemplo 2: Reports (Implementado)

**Archivo**: `src/hooks/useCreateReportForm.ts:210-218`

```typescript
const onSubmit = handleSubmit(async (data: CreateReportFormData) => {
    // ✅ ENTERPRISE FIX: Client-Generated ID (Identity Integrity)
    const reportId = crypto.randomUUID()

    const payload = {
        id: reportId,  // ✅ IDENTITY INTEGRITY
        title: data.title,
        // ...
    }

    createReport(payload)
})
```

**Backend**: `server/src/routes/reports.js:828`

```javascript
const reportId = (req.body.id && isValidUuid(req.body.id)) ? req.body.id : crypto.randomUUID();
```

---

## 🔄 Checklist de Implementación

Para cualquier nuevo módulo que requiera CREATE:

### Frontend

- [ ] Generar UUID con `crypto.randomUUID()` en intention layer
- [ ] Pasar UUID a `mutateAsync` como parámetro `id`
- [ ] Verificar que `onMutate` usa el ID recibido (no genera uno nuevo)
- [ ] Test: Crear → Editar inmediatamente (sin refresh)

### Backend

- [ ] Aceptar `req.body.id` en ruta POST
- [ ] Validar con `isValidUuid(req.body.id)`
- [ ] Usar client-generated ID si es válido
- [ ] Fallback a `crypto.randomUUID()` si no se envía o es inválido
- [ ] Usar `transactionWithRLS` para setear `app.anonymous_id`

---

## 🚨 Regresiones Comunes

### ❌ Generar UUID en `onMutate`

**Problema**: UUID se genera pero NO se envía al backend.

**Síntoma**: 404 en PATCH inmediato.

**Solución**: Mover generación a intention layer.

---

### ❌ No validar UUID en backend

**Problema**: Backend acepta cualquier string como ID.

**Síntoma**: IDs inválidos en DB.

**Solución**: Usar `isValidUuid()` antes de aceptar.

---

### ❌ No usar `transactionWithRLS`

**Problema**: `app.anonymous_id` no se setea en transacción.

**Síntoma**: RLS policies fallan silenciosamente.

**Solución**: Reemplazar `BEGIN/COMMIT` manual con `transactionWithRLS`.

---

## 📚 Referencias

- [ID Drift Fix Walkthrough](./id_drift_fix_walkthrough.md)
- [Reports Audit](./reports_audit.md)
- [Comments Implementation](../src/hooks/useCommentsManager.ts)
- [Reports Implementation](../src/hooks/useCreateReportForm.ts)

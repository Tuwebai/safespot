# ADR 001: Client-Generated IDs como Estándar Obligatorio

## Estado

**Aceptado** - 2026-02-06

---

## Contexto

SafeSpot implementa optimistic updates para mejorar la UX percibida (0ms latency). Sin embargo, se detectó un problema sistémico de **ID drift** donde:

1. Frontend genera UUID en `onMutate` para optimistic update
2. Frontend NO envía UUID al backend
3. Backend genera su propio UUID
4. **Resultado**: Dos UUIDs diferentes → 404 en PATCH inmediato

Este problema se manifestó inicialmente en **Comments** y **Reports**, causando:
- 404 al editar inmediatamente después de crear
- Dependencia de refresh para corregir estado
- UX degradada
- Arquitectura no determinística

---

## Decisión

**Establecer Client-Generated IDs como regla arquitectónica global obligatoria para todos los recursos mutables.**

### Reglas Técnicas

#### 🔒 Regla 1: POST Acepta `id` Opcional

Todos los POST de recursos mutables DEBEN aceptar `id` opcional.

```javascript
// ✅ CORRECTO
const { id, ...data } = req.body;
```

#### 🔒 Regla 2: Validar UUID y Usar Fallback

Si `id` es UUID válido → usarlo. Si no existe → generar UUID server-side.

```javascript
// ✅ CORRECTO
const resourceId = (req.body.id && isValidUuid(req.body.id)) 
    ? req.body.id 
    : crypto.randomUUID();
```

#### 🔒 Regla 3: ID en DB = ID en Cache

El ID usado en DB debe ser exactamente el mismo que el usado en optimistic cache.

```typescript
// ✅ CORRECTO (Frontend)
const id = crypto.randomUUID();
await createMutation.mutateAsync({ id, ...data });
```

#### 🔒 Regla 4: Prohibir Generación Múltiple

Prohibido generar UUID en múltiples capas para el mismo recurso.

```javascript
// ❌ INCORRECTO
onMutate: async (data) => {
    const id = crypto.randomUUID();  // ❌ NO
}

// ✅ CORRECTO
const handleCreate = async () => {
    const id = crypto.randomUUID();  // ✅ SÍ
    await createMutation.mutateAsync({ id, ...data });
};
```

#### 🔒 Regla 5: Optimistic Update Usa Mismo ID

Optimistic update debe usar el mismo ID que se envía al backend.

```typescript
// ✅ CORRECTO
onMutate: async (newData) => {
    // newData.id ya viene del intention layer
    queryClient.setQueryData(key, (old) => [...old, newData]);
}
```

---

## Patrón Unificado

### Frontend

```typescript
// ✅ ENTERPRISE PATTERN
const handleCreate = async () => {
    // 1. Generate UUID BEFORE mutation
    const id = crypto.randomUUID();
    
    // 2. Pass ID to mutation
    await createMutation.mutateAsync({
        id,  // ✅ IDENTITY INTEGRITY
        // ... otros datos
    });
};
```

### Backend

```javascript
// ✅ ENTERPRISE PATTERN
const clientId = (req.body.id && isValidUuid(req.body.id)) 
    ? req.body.id 
    : crypto.randomUUID();

// Usar clientId en INSERT
await transactionWithRLS(anonymousId, async (client, sse) => {
    await client.query(`
        INSERT INTO resources (id, ...) VALUES ($1, ...)
    `, [clientId, ...]);
    
    return resource;
});
```

---

## Consecuencias

### Positivas

- ✅ **Determinismo**: ID consistente entre frontend y backend
- ✅ **0ms Perceived Latency**: Edición inmediata sin refresh
- ✅ **Arquitectura Predecible**: Sin estados fantasmas
- ✅ **Sin ID Drift**: Eliminado riesgo sistémico
- ✅ **Idempotencia**: Reintentos seguros con mismo ID
- ✅ **Trazabilidad**: Logs con mismo UUID en POST y PATCH

### Negativas

- ⚠️ **Migración Requerida**: Recursos existentes deben adaptarse
- ⚠️ **Validación Extra**: Backend debe validar UUIDs
- ⚠️ **Complejidad Frontend**: Generación de ID en intention layer

### Riesgos Mitigados

- 🔴 **ID Drift** → 🟢 Eliminado
- 🔴 **404 en PATCH inmediato** → 🟢 Eliminado
- 🔴 **Dependencia de refresh** → 🟢 Eliminado
- 🔴 **Arquitectura no determinística** → 🟢 Eliminado

---

## Cumplimiento Actual

| Recurso | Cumple | Estado |
|---------|--------|--------|
| Comments | ✅ | Enterprise-Ready |
| Reports | ✅ | Enterprise-Ready |
| Chats | ✅ | Enterprise-Ready |
| Notifications | ❌ | Deuda Técnica Crítica |
| UserZones | ❌ | Deuda Técnica Media |
| Votes | ❌ | Deuda Técnica Media |

---

## Checklist para Nuevos Endpoints

- [ ] Acepta `id` opcional en POST
- [ ] Valida UUID con `isValidUuid()`
- [ ] Usa fallback a `crypto.randomUUID()`
- [ ] Usa `transactionWithRLS` para RLS
- [ ] Frontend genera UUID en intention layer
- [ ] Frontend pasa UUID a `mutateAsync`
- [ ] Optimistic update usa mismo UUID
- [ ] Test: Crear → Editar inmediatamente (sin refresh)

---

## Referencias

- [Auditoría Global](../../../.gemini/antigravity/brain/c87a0773-276d-4a84-b40d-44a8d10ea5b3/global_id_audit.md)
- [Guía de Implementación](./client_generated_ids.md)
- [Fix de Comments](../../../.gemini/antigravity/brain/c87a0773-276d-4a84-b40d-44a8d10ea5b3/id_drift_fix_walkthrough.md)
- [Fix de Reports](../../../.gemini/antigravity/brain/c87a0773-276d-4a84-b40d-44a8d10ea5b3/walkthrough.md)

---

## Notas

- Esta decisión se aplica SOLO a recursos mutables con optimistic updates
- Recursos de solo lectura o sin optimistic updates pueden usar DB-generated IDs
- La validación de UUID es obligatoria para prevenir inyección
- El fallback a `crypto.randomUUID()` es obligatorio para compatibilidad con clientes legacy

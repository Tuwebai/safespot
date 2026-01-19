# 🔒 Auth Guards - Guía Técnica Enterprise

**Versión**: 1.0  
**Última Actualización**: 2026-01-19  
**Mantenedor**: Principal Software Architect

---

## 📋 TL;DR

**REGLA DE ORO**:
> Toda mutation que escriba datos **DEBE** usar `useAuthGuard()` y llamar a `checkAuth()` ANTES de ejecutar la acción.

**Anonymous = Read Only**  
**Authenticated = Read + Write**

---

## 🎯 Arquitectura del Sistema

### Single Source of Truth (SSOT)

```
permissions.ts (Layer 1 - SSOT)
      ↓
useAuthGuard() (Layer 2 - Hook)
      ↓
Mutations (Layer 3 - Data Writers)
      ↓
UI Components (Layer 4 - Consumers)
```

### Componentes Clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/auth/permissions.ts` | SSOT - Determina si usuario está autenticado |
| `src/contexts/AuthGuardContext.tsx` | Estado global del modal de auth |
| `src/hooks/useAuthGuard.ts` | Hook stateless para verificar auth |
| `src/components/auth/AuthRequiredModal.tsx` | Modal global de autenticación |

---

## ❌ EJEMPLO INCORRECTO

### ⚠️ Mutation SIN Guard (PROHIBIDO)

```typescript
// ❌ MAL - Usuario anónimo puede escribir datos
export function useCreateCommentMutation() {
    const queryClient = useQueryClient();
    
    return useMutation({
        mutationFn: async (data) => {
            // ❌ No hay validación de auth
            return commentsApi.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['comments']);
        }
    });
}
```

**Problema**: Usuario anónimo puede crear comentarios → **SECURITY BREACH**

---

### ⚠️ Llamada Directa a API (PROHIBIDO)

```typescript
// ❌ MAL - Bypass completo del sistema de guards
function MyComponent() {
    const handleSubmit = async () => {
        // ❌ Llamada directa desde UI
        await reportsApi.create({ title: 'Test' });
    };
    
    return <button onClick={handleSubmit}>Crear</button>;
}
```

**Problema**: Saltea completamente los auth guards → **CRITICAL BYPASS**

---

## ✅ EJEMPLO CORRECTO

### ✅ Mutation CON Guard (REQUERIDO)

```typescript
// ✅ CORRECTO - Sistema enterprise con auth guard
import { useAuthGuard } from '@/hooks/useAuthGuard';

export function useCreateCommentMutation() {
    const queryClient = useQueryClient();
    const { checkAuth } = useAuthGuard(); // ← 1. Import del hook
    
    return useMutation({
        mutationFn: async (data) => {
            // ✅ 2. Verificar auth ANTES de escribir
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            
            // 3. Solo se ejecuta si autenticado
            return commentsApi.create(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['comments']);
        }
    });
}
```

**Beneficios**:
- ✅ Usuario anónimo ve modal de auth
- ✅ No se escriben datos sin permiso
- ✅ UX clara y predecible

---

### ✅ Uso Correcto en UI

```typescript
// ✅ CORRECTO - UI usa la mutation protegida
function MyComponent() {
    const createComment = useCreateCommentMutation();
    
    const handleSubmit = async () => {
        try {
            // ✅ La mutation ya tiene el guard interno
            await createComment.mutateAsync({ content: 'Test' });
        } catch (error) {
            if (error.message === 'AUTH_REQUIRED') {
                // Modal ya se mostró automáticamente
                console.log('User needs to login');
            }
        }
    };
    
    return <button onClick={handleSubmit}>Comentar</button>;
}
```

---

## 📐 Patrón Enterprise Completo

### Paso 1: Import del Hook

```typescript
import { useAuthGuard } from '@/hooks/useAuthGuard';
```

### Paso 2: Destructure checkAuth

```typescript
export function useMyCrudMutation() {
    const { checkAuth } = useAuthGuard();
    // ...
}
```

### Paso 3: Validar en mutationFn

```typescript
return useMutation({
    mutationFn: async (data) => {
        // ⚠️ CRITICAL: Verificar ANTES de cualquier lógica
        if (!checkAuth()) {
            throw new Error('AUTH_REQUIRED');
        }
        
        // Solo se ejecuta si autenticado
        return myApi.write(data);
    }
});
```

---

## 🚨 CASOS ESPECIALES

### Direct API Calls (UI Components)

```typescript
// ❌ PROHIBIDO en /components o /pages
import { reportsApi } from '@/lib/api'; 
await reportsApi.create(data);

// ✅ PERMITIDO SOLO en hooks /hooks/queries
import { reportsApi } from '@/lib/api';
// Dentro de useXXXMutation con guard
```

### Optimistic Updates

```typescript
// ✅ CORRECTO - Guard antes del optimistic update
onMutate: async (newData) => {
    // El guard ya se ejecutó en mutationFn
    // Es seguro hacer optimistic update aquí
    
    queryClient.setQueryData(['items'], (old) => [...old, newData]);
    return { previousData };
}
```

### Reads vs Writes

```typescript
// ✅ Queries (READ) - NO requieren guard
useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsApi.getAll()
});

// ⚠️ Mutations (WRITE) - REQUIEREN guard
useMutation({
    mutationFn: async (data) => {
        if (!checkAuth()) throw new Error('AUTH_REQUIRED');
        return reportsApi.create(data);
    }
});
```

---

## 🧪 Testing Checklist

Antes de mergear una PR con mutation nueva:

- [ ] ¿Importa `useAuthGuard`?
- [ ] ¿Llama `checkAuth()` en `mutationFn`?
- [ ] ¿Lanza error `'AUTH_REQUIRED'` si falla?
- [ ] ¿No hay llamadas directas a API desde UI?
- [ ] ¿Build pasa sin lint errors?

---

## 🔍 Cómo Auditar Mutation Existente

```bash
# 1. Buscar mutations en el proyecto
grep -r "useMutation" src/hooks/queries/

# 2. Para cada archivo, verificar:
# - Import de useAuthGuard
# - Llamada a checkAuth()
# - Error handling correcto

# 3. Ejecutar linter
npm run lint
```

---

## 📚 Referencias

- **permissions.ts**: `src/lib/auth/permissions.ts`
- **useAuthGuard**: `src/hooks/useAuthGuard.ts`
- **Contexto Global**: `src/contexts/AuthGuardContext.tsx`
- **Modal**: `src/components/auth/AuthRequiredModal.tsx`

---

## ⚠️ PROHIBICIONES ABSOLUTAS

### ❌ NO HACER

1. **NO** llamar API directamente desde componentes UI
2. **NO** crear mutations sin `checkAuth()`
3. **NO** usar `localStorage.getItem('token')` para auth
4. **NO** implementar guards locales (usar SSOT)
5. **NO** saltear el modal de auth

### ✅ SIEMPRE HACER

1. **SIEMPRE** usar `useAuthGuard()`
2. **SIEMPRE** verificar en `mutationFn`
3. **SIEMPRE** lanzar `'AUTH_REQUIRED'` si falla
4. **SIEMPRE** manejar el error en UI si aplica

---

## 🆘 Soporte

Si tenés dudas sobre cómo implementar un guard:

1. Revisar ejemplos en `src/hooks/queries/useReportsQuery.ts`
2. Consultar este documento
3. Ejecutar `npm run lint` para verificar

---

**Recordatorio**: El sistema de Auth Guards es la **primera línea de defensa** del frontend. Mantenerlo consistente es **crítico** para la seguridad de la plataforma.

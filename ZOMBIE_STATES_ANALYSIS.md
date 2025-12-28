# Análisis: Estados Zombis al Navegar en React SPA

> **Aplicación:** SafeSpot - React 18 + TypeScript  
> **Fecha:** Diciembre 2024  
> **Autor:** Frontend Architect Senior

---

## 📋 Resumen Ejecutivo

Se auditaron todos los `useRef`, `useEffect` y patrones de data fetching en busca de **estados zombis** que persisten al navegar entre páginas.

**Resultado:** La mayoría de los patrones están **correctamente implementados**, pero se identificaron **2 casos de mejora** y se documentan las **buenas prácticas** aplicadas.

---

## 1. Refs Auditados

| Archivo | Ref | ¿Se Resetea? | Estado |
|---------|-----|--------------|--------|
| `useReportDetail.ts` | `isDeletedRef` | ✅ Sí (línea 87) | OK |
| `useReportDetail.ts` | `prevReportIdRef` | ✅ Sí (línea 91) | OK |
| `useBadgeNotifications.ts` | `isCheckingRef` | ✅ Sí (línea 160) | OK |
| `useScrollRestoration.ts` | `isRestoringRef` | ✅ Sí (auto-reset) | OK |
| `usePointsAnimation.ts` | `isInitialMountRef` | N/A (animación) | OK |
| `useAudioUnlock.ts` | `enabledRef` | N/A (global) | OK |

---

## 2. Patrones Correctos Encontrados

### 2.1 `useReportDetail.ts` - Reset Explícito ✅

```typescript
// Effect: Reset state ONLY when reportId actually changes
useEffect(() => {
    if (reportId && reportId !== prevReportIdRef.current) {
        // ✅ CORRECTO: Reset de la ref al cambiar de ruta
        isDeletedRef.current = false
        setIsDeleted(false)
        setReport(null)
        setError(null)
        prevReportIdRef.current = reportId
    }
}, [reportId])
```

**Por qué está bien:** Cuando el usuario navega de `/reporte/123` a `/reporte/456`, el `reportId` cambia, triggereando el reset de `isDeletedRef` y limpiando el estado.

### 2.2 `useBadgeNotifications.ts` - Cleanup Correcto ✅

```typescript
useEffect(() => {
    globalBadgeCheckCallback = checkForNewBadges

    const initialTimeout = setTimeout(() => {
        checkForNewBadges()
    }, 3000)

    intervalRef.current = setInterval(() => {
        checkForNewBadges()
    }, CHECK_INTERVAL)

    // ✅ CORRECTO: Cleanup del interval
    return () => {
        globalBadgeCheckCallback = null
        clearTimeout(initialTimeout)
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
        }
    }
}, [checkForNewBadges])
```

### 2.3 `useCommentsManager.ts` - Dependencia de reportId ✅

```typescript
const loadComments = useCallback(async (cursor?: string) => {
    if (!reportId) return
    // ...
}, [reportId, toast]) // ✅ Depende de reportId
```

---

## 3. Anti-Patrones NO Encontrados (Bien)

### ❌ Anti-Patrón 1: Flag que Nunca se Resetea
```typescript
// ❌ NO EXISTE EN LA APP
const hasFetched = useRef(false)

useEffect(() => {
  if (hasFetched.current) return
  hasFetched.current = true
  loadData()
}, [])
```

### ❌ Anti-Patrón 2: Effect Sin Dependencia de Ruta
```typescript
// ❌ NO EXISTE EN LA APP (todos dependen del ID)
useEffect(() => {
  loadData()
}, []) // Sin depender de params
```

### ❌ Anti-Patrón 3: Guard que Bloquea Indefinidamente
```typescript
// ❌ CORREGIDO - antes existía
if (isDeletedRef.current) return // Sin reset
```

---

## 4. Mejoras Recomendadas

### 4.1 AbortController para Fetch en `useReportDetail`

**Estado actual:** No hay abort de requests en navegación.

**Problema potencial:** Si el usuario navega rápidamente entre reportes, los fetches anteriores pueden completarse y setear estado incorrecto.

**Solución:**

```typescript
const loadReport = useCallback(async (signal?: AbortSignal) => {
    try {
        const data = await reportsApi.getById(reportId, { signal })
        if (!signal?.aborted) {
            setReport(data)
        }
    } catch (err) {
        if (err.name === 'AbortError') return // Ignorar abort
        // manejar error
    }
}, [reportId, toast])

useEffect(() => {
    const controller = new AbortController()
    loadReport(controller.signal)
    
    return () => controller.abort()
}, [reportId, loadReport])
```

**Prioridad:** Media (mejora de robustez)

### 4.2 Reset de Estado en Páginas con `[]` deps

**Archivos afectados:**
- `Perfil.tsx` (línea 22): `useEffect(() => { loadProfile() }, [])`
- `MisFavoritos.tsx` (línea 30): `useEffect(() => { loadFavorites() }, [])`
- `Explorar.tsx` (línea 22): `useEffect(() => { loadReports() }, [])`

**Nota:** Estas páginas NO usan params dinámicos, por lo que `[]` es correcto. El componente se **desmonta** al navegar fuera, así que el estado se limpia naturalmente.

**Verificación:** ✅ No hay problema real aquí.

---

## 5. Checklist de Navegación Segura

### Para Nuevos Hooks/Componentes

| # | Check | Descripción |
|---|-------|-------------|
| ☐ | **Deps correctas** | `useEffect` debe depender de IDs/params que determinan qué cargar |
| ☐ | **Reset de refs** | Si usás refs como flags, resetealas cuando cambia el recurso |
| ☐ | **Cleanup** | Intervals, timeouts y subscriptions deben limpiarse |
| ☐ | **AbortController** | Considerar abort para fetches en componentes con navegación rápida |
| ☐ | **No guards zombis** | Los `if (...) return` dentro de effects deben manejar el estado |

### Preguntas de Diagnóstico Rápido

1. ¿El componente usa `useParams()`? → El effect debe depender de ese param
2. ¿Hay un `useRef(false)` que se setea a `true`? → ¿Cuándo vuelve a `false`?
3. ¿El effect tiene deps `[]`? → ¿El componente se desmonta al navegar?
4. ¿Hay `setInterval` o `setTimeout`? → ¿Hay cleanup?

---

## 6. Reglas para Navegación Futura

### Regla #1: Dependencias Explícitas
```typescript
// ✅ SIEMPRE incluir el ID del recurso
useEffect(() => {
    loadData()
}, [resourceId]) // No []
```

### Regla #2: Reset Explícito al Cambiar Recurso
```typescript
// ✅ Resetear estado cuando cambia el ID
useEffect(() => {
    setData(null)
    setError(null)
    setLoading(true)
    // luego cargar
}, [resourceId])
```

### Regla #3: Refs de Control Deben Resetearse
```typescript
// ✅ Si usás una ref como flag
useEffect(() => {
    myFlagRef.current = false // Reset primero
}, [resourceId])
```

### Regla #4: Cleanup Obligatorio para Async
```typescript
// ✅ AbortController para fetches
useEffect(() => {
    const controller = new AbortController()
    fetch(url, { signal: controller.signal })
    return () => controller.abort()
}, [url])
```

---

## 7. Conclusión

La aplicación SafeSpot tiene un **buen manejo de estados en navegación**. Los refs críticos (`isDeletedRef`, `prevReportIdRef`) se resetean correctamente.

**Sin cambios requeridos inmediatos.**

El único punto de mejora es implementar `AbortController` para mayor robustez, pero no es causa de bugs actuales.

---

## Checklist Final ✅

| Componente/Hook | Refs | Effects | Cleanup | Estado |
|-----------------|------|---------|---------|--------|
| useReportDetail | ✅ Reset | ✅ Deps correctas | ⚠️ Sin abort | Funcional |
| useBadgeNotifications | ✅ Auto-reset | ✅ | ✅ Interval/timeout | OK |
| useCommentsManager | N/A | ✅ Deps correctas | N/A | OK |
| Perfil/Favoritos/Explorar | N/A | ✅ Desmonta limpio | N/A | OK |

# 🛠️ Soluciones Técnicas para Hallazgos Críticos UX

> **Objetivo:** Estandarizar patrones de arquitectura frontend para eliminar inconsistencias visuales, errores de carga y layout shifts.

---

## 🚨 1. Flash of Invisible Content (FOIC)

### 🔴 Diagnóstico
El patrón actual inicializa estados de carga en `false` esperando que el `useEffect` dispare la carga inmediatamente.
*   **Problema:** React renderiza el componente *antes* de que `useEffect` se ejecute.
*   **Resultado:** `loading: false` + `data: null` → Renderiza `null` o contenedores vacíos. Milisegundos después, entra `loading: true` y aparece el Skeleton. El usuario percibe un "parpadeo".

### ✅ Solución: "Loading by Default"
El estado inicial debe asumir que los datos **aún no están listos** si el componente depende de ellos para ser útil.

#### Antip-patrón (Evitar) ❌
```typescript
const [data, setData] = useState(null)
const [loading, setLoading] = useState(false) // <--- CULPABLE

useEffect(() => {
  setLoading(true)
  fetchData().then(...)
}, [])
```

#### Patrón Correcto ✅
```typescript
// 1. Loading true por defecto
const [loading, setLoading] = useState(true)
const [data, setData] = useState<Data | null>(null)

useEffect(() => {
  // 2. Opcional: Resetear error si re-monta
  // loadData() maneja el finally { setLoading(false) }
  loadData()
}, [])
```

---

## 🧩 2. Fragmentación de Feedback (Consolidación)

### 🔴 Diagnóstico
Existen múltiples componentes (`Card` custom, `div` alertas, `Toast`) compitiendo por mostrar el mismo estado.

### ✅ Solución: Matriz de Feedback Unificada
Se utilizará exclusivamente `<FeedbackState />` para estados persistentes en el layout. `Toast` se reserva solo para acciones efímeras post-interacción.

| Escenario | Componente | Props Clave | Ejemplo |
| :--- | :--- | :--- | :--- |
| **Carga Inicial** | `<Skeleton />` (o `FeedbackState type="loading"` si no hay layout previo) | `className="h-full"` | Carga de perfil, lista reportes. |
| **Lista Vacía** | `<FeedbackState state="empty" />` | `action={<Button>Crear</Button>}` | "No hay reportes", "Sin comentarios". |
| **Error (Recuperable)** | `<FeedbackState state="error" />` | `action={<Button>Reintentar</Button>}` | Fallo de red al cargar feed. |
| **Error (Crítico)** | `<FeedbackState state="error" />` | `action={<Link>Volver</Link>}` | 404 Reporte no encontrado. |
| **Submit Error** | `Toast` (Toast) | `variant="destructive"` | Fallo al enviar comentario (no bloquea UI). |

---

## 🧟 3. Estados Zombis

### 🔴 Diagnóstico
Componentes que inician peticiones asíncronas pero son desmontados antes de que estas terminen. Al resolver, intentan actualizar el estado de un componente que ya no existe (`setState` on unmounted component), causando warnings o condiciones de carrera si se vuelve a montar rápido.

### ✅ Solución: Hook `useSafeAsync` (o AbortController Pattern)
Implementaremos un patrón de limpieza en todos los `useEffect` de data fetching.

#### Patrón "Active Flag" ✅
```typescript
useEffect(() => {
  let isActive = true
  setLoading(true)

  apiCall()
    .then(data => {
      if (isActive) {
        setData(data)
        setError(null)
      }
    })
    .catch(err => {
      if (isActive) setError(err.message)
    })
    .finally(() => {
      if (isActive) setLoading(false)
    })

  return () => {
    isActive = false // Cancela actualizaciones pendientes
  }
}, [])
```

---

## 📏 4. UI "Brincos" (Cumulative Layout Shift - CLS)

### 🔴 Diagnóstico
Los Skeletons actuales son barras genéricas (`h-6`, `w-full`) que no reflejan la altura real de las tarjetas de contenido. Al cargar la data, el contenido "empuja" el footer o elementos adyacentes.

### ✅ Solución: Sistema de Skeletons "Mirror"
Cada componente complejo debe tener su par `Skeleton` que replique exactamente su Box Model (padding, margin, height).

#### Reglas de Implementación
1.  **Misma Altura:** Si la `Card` mide `200px`, el `Skeleton` debe medir `200px`.
2.  **Mismo Layout:** Usar el mismo grid/flex que el componente real.
3.  **No Spinner:** Evitar spinners que colapsan el espacio.

#### Ejemplo
```tsx
// ReportCard.tsx
<Card className="h-[280px] p-4">...</Card>

// ReportCardSkeleton.tsx
<Card className="h-[280px] p-4">
  <Skeleton className="h-48 w-full mb-4" /> {/* Imagen mirror */}
  <Skeleton className="h-6 w-3/4" />       {/* Título mirror */}
</Card>
```

---

## 🚀 Plan de Implementación (Checklist)

### Paso 1: Core Patching (Alta Prioridad)
- [ ] **Fix FOIC:** Refactorizar `Gamificacion.tsx` para usar `useState(true)` en loading.
- [ ] **Fix FOIC:** Refactorizar `Perfil.tsx` para usar `useState(true)`.
- [ ] **Standard:** Crear/Actualizar componentes `Skeleton` para coincidir con `Gamificacion` y `Perfil`.

### Paso 2: Unificación de Feedback
- [ ] **Refactor:** Reemplazar `Alert` en `CrearReporte` por `Toast` (error submit).
- [ ] **Refactor:** Migrar Feedback de `Gamificacion` (Error/Empty) a `<FeedbackState />`.
- [ ] **Refactor:** Migrar Feedback de `Perfil` (Error/Empty) a `<FeedbackState />`.

### Paso 3: Hardening (Anti-Zombis)
- [ ] **Refactor:** Aplicar patrón `isActive` en `useCommentsManager`.
- [ ] **Refactor:** Aplicar patrón `isActive` en `useReportDetail`.

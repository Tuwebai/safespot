# Diseño Técnico: Refinamiento de Mapa Interactivo (UX/Performance)

> **Rol:** Staff Frontend Engineer + UX
> **Scope:** Interacción Avanzada, Sincronización Bidireccional y Modo Fullscreen

---

## 1. Arquitectura de Navegación (Fullscreen First)

Para lograr una experiencia inmersiva, el mapa no puede competir con el layout estándar.

### Estrategia: Layout Condicional
En lugar de embeber el mapa en el layout actual (`<Layout><Children/></Layout>`), la ruta `/explorar` debe controlar su propio layout.

#### Estructura de Componentes
```tsx
// src/layouts/MapLayout.tsx
export function MapLayout({ children }) {
  // Sin Header/Footer tradicionales.
  // Solo controles flotantes esenciales.
  return <div className="h-screen w-screen relative overflow-hidden">{children}</div>
}
```

#### Transición y Salida
*   **Entrada:** Navegación a `/explorar?mode=map`
*   **Salida:** Botón flotante "Cerrar Mapa" (X) en top-left -> redirige a modo lista o home.

---

## 2. Inmersión y Zoom (Natural UX)

La configuración por defecto de Leaflet a veces se siente "rígida".

### Configuración Óptima
```tsx
<MapContainer
  zoomSnap={0.5}          // Zoom suave, no salta de entero en entero
  zoomDelta={0.5}         // Incrementos más finos
  wheelDebounceTime={40}  // Performance en scroll rápido
  maxBounds={[[ -90, -180 ], [ 90, 180 ]]} // Evitar "mundo gris" infinito
  minZoom={3}
  maxZoom={18}
>
```

### Interacción Táctil/Mouse
*   **Desktop:** `scrollWheelZoom={true}` (Es fullscreen, no necesitamos capturar scroll de página).
*   **Mobile:** `dragging={true}`, `tap={false}` (Mejor respuesta en iOS).

---

## 3. Sincronización Bidireccional (Maps <-> List)

El desafío es comunicar dos mundos sin provocar "loops" de render.

### Estado Compartido (Zustand o Context)
```ts
interface MapState {
  selectedReportId: string | null;
  highlightedReportId: string | null; // Hover
  viewportBounds: Bounds | null;
  
  // Actions
  selectReport: (id: string, coords: LatLng) => void;
  highlightReport: (id: string | null) => void;
}
```

### Flujo: Lista -> Mapa
1.  **Click en Card:**
    *   `map.flyTo([lat, lng], 16, { animate: true, duration: 1.5 })`
    *   Leaflet Marker abre popup automáticamente (imperativo via `ref`).
2.  **Hover en Card:**
    *   Marker correspondiente cambia icono (escala 1.2x, z-index 1000).

### Flujo: Mapa -> Lista
1.  **Click en Marker:**
    *   Si hay "Split View" (Desktop): `document.getElementById(`report-${id}`).scrollIntoView({ behavior: 'smooth' })`.
    *   Si es Mobile: Abre "Bottom Sheet" parcial sobre el mapa.

---

## 4. Botón "Buscar en esta zona" (Server-Side Bounds)

Evitar fetching automático es clave para la DX y costos de API.

### Implementación Técnica
1.  **Detectar Movimiento:** `useMapEvents({ moveend: () => ... })`
2.  **Lógica de Botón:**
    *   Guardar `lastFetchedBounds`.
    *   En `moveend`: Si la distancia del centro > X metros O zoom cambió:
    *   Set `showSearchButton = true`.
3.  **Click en Botón:**
    *   `setIsLoading(true)`
    *   `GET /api/reports?bbox=${map.getBounds().toBBoxString()}`
    *   `hideSearchButton()`

### Snippet: SearchThisAreaControl
```tsx
export function SearchThisAreaControl({ onSearch, visible }) {
  if (!visible) return null;
  
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] animate-in fade-in slide-in-from-top-4">
      <Button 
        onClick={onSearch}
        className="bg-white text-dark-bg shadow-lg hover:scale-105 transition-transform rounded-full px-6 font-semibold"
      >
        Buscar en esta zona
      </Button>
    </div>
  )
}
```

---

## 5. UX de Estados (Zero Spinners)

El mapa es un canvas que persiste.

*   **Cargando (Refetch):** Barra de progreso delgada (2px) en el top del viewport (`nprogress` style). El mapa sigue interactivo.
*   **Sin Resultados:** Toast/Alert flotante en bottom-center: *"No encontramos reportes aquí."*
*   **Error:** Botón "Reintentar" dentro del mismo control de "Buscar en esta zona".

---

## 6. Checklist de Implementación (Orden Prioridad)

1.  [ ] **Layout Fullscreen:** Crear `MapLayout` y ajustar rutas.
2.  [ ] **Store de Sincronización:** Hook `useMapStore`.
3.  [ ] **Interacción Marker/List:** Conectar `flyTo` y `scrollIntoView`.
4.  [ ] **Control de Bounds:** Implementar lógica de "Buscar en esta zona".
5.  [ ] **Refinamiento Visual:** Animaciones de entrada/salida de controles.

---
**Resultado:** Un mapa que se siente como una aplicación nativa, respeta el ancho de banda del usuario y ofrece navegación fluida.

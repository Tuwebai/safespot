# Propuesta de Integración: Mapa Interactivo (SafeSpot)

> **Documento de Diseño Técnico y UX**
> **Objetivo:** Transformar la sección "Explorar" en una experiencia geoespacial inmersiva.

---

## 1. Visión General
Actualmente, la sección `Explorar` ofrece una vista de lista y un placeholder para el mapa. El objetivo es implementar un mapa interactivo completo que permita a los usuarios visualizar incidentes en su contexto geográfico real, filtrar por proximidad y entender patrones de seguridad en su zona.

## 2. Stack Tecnológico

### 2.1 Dependencias Actuales (Ya instaladas ✅)
*   **Leaflet (`leaflet`)**: Motor de mapa ligero y robusto.
*   **React Leaflet (`react-leaflet`)**: Bindings de React para Leaflet.
*   **Lucide React**: Iconos para marcadores personalizados.

### 2.2 Nuevas Dependencias Requeridas
*   **Marker Clustering (`react-leaflet-cluster` o similar)**: CRÍTICO para performance. Agrupa marcadores cercanos para evitar saturación visual y del DOM.
*   **GeoLocation API (Nativa)**: Para centrar el mapa en la ubicación del usuario.

---

## 3. Funcionalidades Core

### 3.1 Visualización de Datos
*   **Marcadores Personalizados:**
    *   **Color:** Basado en la **Categoría** del reporte (Ej: Rojo = Robo, Amarillo = Precaución).
    *   **Icono:** Glifo específico de `lucide-react` dentro de un pin (Ej: `Bike` para robo de bicicleta).
    *   **Estado:** Opacidad o borde diferenciado para reportes "Resueltos" vs "Pendientes".

### 3.2 Interacción
*   **Popups Informativos:** Al hacer click en un marcador, mostrar una "Nano Card":
    *   Título truncado
    *   Fecha relativa ("hace 2h")
    *   Botón "Ver Detalles" (Link a `/reporte/:id`)
*   **Clustering Inteligente:** Al hacer zoom out, los puntos se agrupan en círculos con el conteo (Ej: "15 reportes aquí"). Al hacer click, el mapa hace zoom in para dispersarlos.

### 3.3 Navegación y Filtros
*   **"Buscar en esta zona":** Botón flotante que aparece al mover el mapa. Evita recargas automáticas molestas.
*   **Geolocalización:** Botón "Centrar en mí" para ir rápidamente a la ubicación actual.
*   **Sincronización de Filtros:** Los filtros existentes (Categoría, Fecha) deben afectar tanto a la lista como al mapa.

---

## 4. Diseño de Interfaz (UI/UX)

### 4.1 Layout "Explorar"
Proponemos un layout híbrido o toggleable:

1.  **Modo Toggle (Móvil/Desktop simple):** Botones "Mapa | Lista" (como existe ahora, pero funcional). El mapa ocupa el 100% del contenedor disponible.
2.  **Modo Split (Desktop avanzado - Opcional):** Mapa a la izquierda (60%), Lista lateral a la derecha (40%) que se actualiza con los reportes visibles en el mapa.

### 4.2 Componentes del Mapa
```text
+-------------------------------------------------------+
|  [Filtros Globales (Categoría, Estado, Búsqueda)]     |
+-------------------------------------------------------+
|                                                       |
|  ( MAPA LEAFLET )                                     |
|                                                       |
|       [📌] [📌]           [CLUSTER (5)]               |
|                                                       |
|                     [ Botón: "Buscar en esta zona" ]  |
|                                                       |
|  +----------------+                                   |
|  |  Popup Reporte |             [ (O) Centrar ]       |
|  |  "Robo Bici"   |             [ (+) Zoom In ]       |
|  |  [Ver más >]   |             [ (-) Zoom Out]       |
|  +----------------+                                   |
|                                                       |
+-------------------------------------------------------+
```

---

## 5. Estrategia de Performance

### 5.1 Manejo de Datos (Client-Side inicialmente)
Dado que el volumen actual de reportes no es masivo (< 1000):
1.  Cargar **todos** los reportes ligeros (ID, Lat/Lng, Cat, Status) al inicio.
2.  Filtrado y Clustering realizados en el **cliente**.
3.  **Ventaja:** Respuesta instantánea al mover el mapa y filtrar.

### 5.2 Escalamiento Futuro (Server-Side)
Cuando los reportes superen los ~2000:
1.  Backend endpoint: `GET /reports?bounds=south,west,north,east`.
2.  Cargar solo lo visible en el viewport ("Lazy Loading geoespacial").

---

## 6. Plan de Implementación

### Fase 1: Mapa Base (MVP) - ⏱️ 4-6 Horas
1.  **Componente `MapContainer`**: Integrar `react-leaflet` en `Explorar.tsx`.
2.  **Renderizado de Puntos**: Mappear `reports` a `<Marker />`.
3.  **Popups Básicos**: Mostrar título y link.
4.  **Tiles**: Usar OpenStreetMap (gratis) o Mapbox (si hay key).

### Fase 2: UX y Clustering - ⏱️ 4 Horas
1.  **Clustering**: Integrar librería de clusters.
2.  **Iconos Custom**: Crear función helper `getIconByCategory(category)`.
3.  **Geolocalización**: Hook `useGeolocation` para centrar mapa.

### Fase 3: Refinamiento - ⏱️ 3 Horas
1.  **Sincronización**: Que al hacer click en un reporte de la lista, el mapa vuele a ese punto.
2.  **Filtros de Área**: Botón "Buscar aquí" (si se implementa carga por bounds).
3.  **Animaciones**: Transiciones suaves de zoom y flyTo.

# 🎨 Estándar de Feedback UX - Safespot

> **Objetivo:** Eliminar la incertidumbre del usuario mediante feedback claro, contextual y estandarizado.

## 1️⃣ Principios UX de Feedback

El feedback genérico ("Cargando...", "Error") genera ansiedad y desconfianza.
El **Feedback Contextual** informa al usuario exactamente qué está pasando, por qué espera y qué debe hacer si algo falla.

| Tipo | Propósito | Ejemplo |
|Data | | |
|---|---|---|
| **Loading** | Indicar proceso activo. | "Buscando tu ubicación exact..." |
| **Success** | Confirmar acción completada. | "Reporte guardado correctamente" |
| **Empty** | Guiar en ausencia de datos. | "No hay reportes aquí. ¡Sé el primero!" |
| **Error** | Explicar fallo y solución. | "No hay conexión. Reintentar." |

---

## 2️⃣ Estados UX Estándar

### ⏳ Loading (Carga)
Nunca usar "Cargando..." a secas.
*   ❌ **Malo:** Spinner solo o texto "Cargando..."
*   ✅ **Correcto:** "Cargando reportes cercanos..." o Skeleton UI similar al contenido final.

### ⏳ Partial Loading (Listas/Botones)
*   ❌ **Malo:** Bloquear toda la pantalla por una acción menor.
*   ✅ **Correcto:** Spinner pequeño dentro del botón o barra de progreso superior.

### ✅ Success (Temporal)
Mensajes efímeros para confirmar acciones sin interrumpir el flujo.
*   ❌ **Malo:** Alert modal "Guardado con éxito" (requiere clic).
*   ✅ **Correcto:** Icono check en botón o Toast discreto "Reporte enviado".

### ⚠️ Error Recuperable
Fallos de red o validación donde el usuario puede actuar.
*   ❌ **Malo:** "Error 500" o "Algo salió mal".
*   ✅ **Correcto:** "No pudimos cargar los comentarios. [ Botón Reintentar ]"

### ⛔ Error Crítico
Fallos bloqueantes (404, Sin permisos).
*   ❌ **Malo:** Pantalla en blanco.
*   ✅ **Correcto:** Ilustración amigable + Botón "Volver al inicio".

### 📭 Empty State (Estado Vacío)
Oportunidad para educar o incitar a la acción.
*   ❌ **Malo:** "Sin datos" o espacio en blanco.
*   ✅ **Correcto:** Icono + "No tienes favoritos aún" + Botón "Explorar reportes".

---

## 3️⃣ Skeleton Loaders

Usar **Skeleton** cuando se espera contenido que ocupa espacio (Tarjetas, Listas).
Usar **Spinner** para acciones puntuales (Envío de formulario, validación).

### Configuración Estándar (Componente Único)
```tsx
// ✅ Correcto: Configurable y semántico
<Skeleton variant="card" height={200} />
<Skeleton variant="text" lines={3} width="80%" />
```

**Reglas Visuales:**
1.  Misma altura y margen que el contenido real.
2.  Animación `pulse` suave (no parpadeo agresivo).
3.  Color base `muted/50` para consistencia en Dark Mode.

---

## 4️⃣ Feedback en Botones (`AsyncButton`)

Estandarizar el ciclo de vida de todo botón asíncrono.

1.  **Idle**: Estado normal (e.g., "Guardar").
2.  **Loading**:
    *   Deshabilitado (`disabled`).
    *   Spinner a la izquierda.
    *   Texto en gerundio: "Guardando...".
3.  **Success** (2 segundos):
    *   Color: Verde Neon u Outline Success.
    *   Icono: Check (`lucide-react`).
    *   Texto: "Guardado".
4.  **Error** (2 segundos):
    *   Color: Rojo Destructive.
    *   Icono: X.
    *   Texto: "Error".
    *   *Permite reintentar tras el reset automático.*

---

## 5️⃣ Feedback por Componente

| Componente | Estado | Feedback Actual (❌) | Feedback Propuesto (✅) |
|---|---|---|---|
| **Home / Mapa** | Loading | Spinner gigante | "Localizando incidentes en tu zona..." |
| **Reportes (Lista)** | Empty | "No hay reportes" | "Todo tranquilo por aquí. ¿Has visto algo?" |
| **Reportes (Lista)** | Error | Toast de error | Inline: "Error al cargar. [Reintentar]" |
| **DetalleReporte** | Loading | Skeleton desalineado | `<ReportSkeleton />` exacto a la card real. |
| **DetalleReporte** | Error | Pantalla rota / 404 | Card: "Este reporte no existe o fue eliminado." |
| **CrearReporte** | Submit | "Esperando..." | Botón: "Publicando..." → "¡Publicado!" |
| **Comentarios** | Empty | (Nada) | "Sé el primero en aportar datos sobre esto." |
| **Favoritos** | Empty | "Sin favoritos" | "Guarda reportes importantes para seguirlos." |

---

## 6️⃣ Retry UX (Reintento)

### Inline Retry (Prioridad 1)
Usar cuando falla una sección específica (ej: Comentarios) sin afectar al resto.
*   **UI**: Texto de error pequeño + Link/Botón "Reintentar".

### Toast Retry (Prioridad 2)
Usar para acciones en segundo plano (ej: Marcar favorito).
*   **UI**: Toast "No se pudo guardar. [Reintentar]".

---

## 7️⃣ Reglas Técnicas

1.  **NO Hardcodear Strings**: Usar constantes o archivos de internacionalización (si aplica) para mensajes recurrentes.
2.  **Centralizar Mensajes**: Mantener consistencia. Si decimos "Cargando..." en un lado, no usar "Espere..." en otro.
3.  **Cero Alert()**: Nunca usar `window.alert` o `window.confirm` nativos. Usar Dialogs o Toasts.
4.  **Logging**: Todo error visual debe tener un correlato en consola/log (`console.error` o servicio de monitoreo) con el detalle técnico, pero al usuario solo mostrarle la solución.

---

## 8️⃣ Checklist Final para PRs

- [ ] ¿Hay algún texto "Cargando..." o "Loading..." visible? (Debe ser específico).
- [ ] ¿Los botones async muestran estado de carga y éxito/error?
- [ ] ¿Si falla la API, el usuario ve un botón de "Reintentar"?
- [ ] ¿Los Skeleton coinciden en tamaño con el contenido final?
- [ ] ¿Los estados vacíos invitan a la acción?

# Auditoría Realtime End‑to‑End (Safe Spot) 🛡️

## 1. Executive Summary
SafeSpot ha alcanzado la excelencia técnica en la sincronización de **Reportes** y **Chats** gracias a la implementación de `Unified Passive Sync`. Sin embargo, el resto de la aplicación opera en un estado de **Fragmentación Realtime**. Existen múltiples "islas de lógica" (hooks paralelos) compitiendo por los mismos streams de SSE, lo que genera duplicación de conexiones, pérdida de eventos en micro-cortes (falta de Gap Recovery centralizado) e inconsistencias visuales en el feed de comentarios y badges.

---

## 2. Realtime Coverage Map

| Dominio | ¿Realtime esperado? | Estado Actual | Estado Objetivo |
| :--- | :---: | :--- | :--- |
| **Reportes** | ✅ Sí | Unified Passive Sync | ✅ Optimizado |
| **Comentarios** | ✅ Sí | ❌ No (Refetch on Focus) | Unified Passive Sync |
| **Likes/Votos** | ✅ Sí | ⚠️ Pseudo-Realtime (Focus) | Unified Passive Sync |
| **Notificaciones** | ✅ Sí | 🧱 Fragmentado (Hook Directo) | Orchestrator (User Stream) |
| **Badges / Gamif.** | ✅ Sí | ❌ Polling manual / Impulso | Orchestrator (User Stream) |
| **Stats Globales** | ✅ Sí | ✅ Realtime (Orchestrator) | ✅ Optimizado |
| **Chats** | ✅ Sí | ✅ Realtime (Orchestrator) | ✅ Optimizado |

---

## 3. Hallazgos Críticos

### 🚨 Hallazgo 1: La "Isla" de Comentarios (Falla: ❌ No realtime)
La vista de comentarios de un reporte no escucha eventos de red. Si el Usuario A comenta, el Usuario B (que está viendo el reporte) no verá el nuevo comentario hasta que cambie de pestaña o refresque.
- **Impacto**: UX estática, sensación de app muerta.
- **Causa**: `useCommentsQuery` depende de `staleTime` y no está conectado al Orquestador.

### 🚨 Hallazgo 2: Orquestación Fragmentada en Notificaciones (Falla: 🧠 Falta de orquestador)
`useUserNotifications` abre su propia suscripción al stream de usuario, ignorando que el `RealtimeOrchestrator` ya está conectado a ese mismo canal.
- **Impacto**: Duplicación de recursos, lógica de `Gap Recovery` duplicada y divergente.
- **Causa**: El Orquestador solo procesa `chats`, delegando el resto a componentes locales.

### 🚨 Hallazgo 3: Gamificación por Polling (Falla: 🧱 Filtro bloqueante)
Los badges dependen de un `triggerBadgeCheck` manual. Si un usuario gana una insignia por una acción pasiva (ej: recibir 10 likes), nunca se enterará en tiempo real.
- **Impacto**: Pérdida de engagement instantáneo.
- **Causa**: No hay un evento SSE 'badge-award' procesado pasivamente.

---

## 4. Arquitectura Recomendada: "The Total Orchestrator"

Para alcanzar el estado de éxito, SafeSpot debe migrar a un modelo **Monocéntrico**:

1.  **Ingesta Unificada**: `RealtimeOrchestrator` debe ser el ÚNICO suscriptor de SSE. 
2.  **Expansión de Dominios**:
    *   **Feed Domain**: Incorporar `comment-create`, `comment-like` y `comment-delete` en `processFeedDomainLogic`.
    *   **User Domain**: Incorporar `notification-new`, `badge-awarded` y `profile-update` en un nuevo `processUserDomainLogic`.
3.  **Habilitación de Cache Observers**: Los hooks como `useCommentsQuery` no deben ser "smart", sino suscribirse pasivamente a los cambios que el Orquestador inyecta en la caché.

---

## 5. Riesgos si NO se corrige
- **Inconsistencia de Datos**: Usuarios viendo contadores de comentarios (ej: "5") que no coinciden con la lista real (ej: solo 3 visibles).
- **Sobrecarga de Servidor**: Múltiples conexiones SSE por pestaña debido a la fragmentación de hooks.
- **Degradación de UX**: Notificaciones que aparecen en el feed pero no disparan el sonido o el badge visual por race conditions entre hooks.

---

## 6. Roadmap de Corrección (Conceptual)

1.  **Fase A (Centralización)**: Migrar los listeners de `useUserNotifications` dentro del `RealtimeOrchestrator`. Eliminar la lógica de reconexión manual del hook.
2.  **Fase B (Feed Social)**: Implementar la lógica de inyección de comentarios en la caché (similar a la de reportes) dentro del Orquestador.
3.  **Fase C (Gamificación Elástica)**: Definir el evento `badge-award` y procesarlo para que el toast aparezca instantáneamente sin importar qué esté haciendo el usuario.
4.  **Fase D (Hardening)**: Unificar todos los `LocalProcessedLog` en una sola tabla de autoridad para garantizar que ninguna notificación se pierda ni se duplique.

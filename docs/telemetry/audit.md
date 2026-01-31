# Motor 8: Unified Telemetry Engine — Auditoría Interna

## 1. Motores del Sistema y Señales Actuales

| Motor | Prefijo / Señal | IDs Generados | Contexto Incluido |
| :--- | :--- | :--- | :--- |
| **Bootstrap** | `[Lifecycle]`, `[Bootstrap]` | - | Estado (Booting, Running, etc.) |
| **Traffic Control** | `[Traffic]` | - | Label de acción, Delay |
| **API Pipe** | `[API Request]`, `[API Gate]` | `requestId` (UUID) | URL, Method |
| **SSE Pool** | `[SSE]` | - | URL, Attempt count |
| **Realtime Orchestrator**| `[Orchestrator]` | `eventId` (Server) | Type, Channel |
| **Data Integrity** | Interno (`processEvent`) | - | Lifecycle events |
| **UI Actions** | `console.error` (dispersos) | - | - |

## 2. Puntos de Pérdida de Contexto (Context Gaps)

1.  **SSE → Orchestrator → UI**: El `eventId` del servidor llega al Orchestrator, pero se pierde al notificar a los hooks de React si no se propaga explícitamente.
2.  **UI → Action → API**: Una acción del usuario (clic) no tiene ID hasta que llega a `apiRequest`. Si el `TrafficController` la pausa, el log de pausa no sabe a qué acción se refiere.
3.  **Bootstrap Recovery → API**: Cuando el sistema se recupera, dispara ráfagas de fetch. No hay un ID que agrupe esta "Oleada de Recuperación".

## 3. Gaps Confirmados (Enterprise Risks)

*   **Identificación de Instancia**: Ceguera total ante múltiples pestañas abiertas.
*   **Linaje Vertical**: Imposibilidad de correlacionar un `requestId` de HTTP con el `eventId` de SSE que lo disparó.
*   **Trazabilidad Temporal**: No hay un timestamp unificado de alta precisión para medir latencia "inter-motor".

## 4. Decisiones de Diseño Justificadas

1.  **X-Trace-Id obligatorio**: Se inyectará en todas las peticiones para que el backend pueda reflejar la trazabilidad.
2.  **sessionStorage for instanceId**: Elegido para persistir durante la vida de la pestaña y sobrevivir a recargas ligeras, sin ensuciar el `localStorage` compartido.
3.  **Async Context Abstraction**: Se usará una abstracción manual (Explicit Context Passing y Global Current Trace) dado que el entorno es Frontend y carecemos de `AsyncLocalStorage` nativo fiable.

---
**Resultado de Auditoría**: El sistema actual es un archipiélago de logs. El Motor 8 actuará como el puente que unifica estas islas mediante una identidad de traza compartida.

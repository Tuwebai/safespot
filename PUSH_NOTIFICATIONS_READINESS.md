# PUSH NOTIFICATIONS READINESS ANALYSIS 🔔

## Estado General: **85% LISTO PARA PRODUCCIÓN**

La infraestructura de Push Notifications está **casi completa**. Los componentes principales funcionan, pero hay inconsistencias en los payloads que limitan las acciones background del Service Worker.

---

## Arquitectura Actual

```mermaid
flowchart LR
    subgraph Frontend
        A[usePushNotifications.ts] -->|subscribe| B[/api/push/subscribe]
    end
    
    subgraph Backend
        B --> C[(push_subscriptions)]
        D[notificationService.js] -->|sendPushNotification| E[webPush.js]
        F[chats.js] -->|sendBatchNotifications| E
    end
    
    subgraph Browser
        E -->|Web Push Protocol| G[sw.ts]
        G -->|showNotification| H[Sistema OS]
        G -->|notificationclick| I[Acción]
    end
```

---

## Componentes Analizados

### ✅ Frontend (usePushNotifications.ts)
| Aspecto | Estado |
|---------|--------|
| Hook de suscripción | ✅ Funcional |
| Conversión VAPID | ✅ Correcta |
| Manejo de permisos | ✅ Completo |
| Actualización de ubicación | ✅ Implementado |
| Desuscripción | ✅ Implementada |

### ✅ Backend Push Routes (push.js)
| Endpoint | Estado |
|----------|--------|
| `GET /vapid-key` | ✅ Funcional |
| `POST /subscribe` | ✅ Upsert con location opcional |
| `DELETE /subscribe` | ✅ Soft delete |
| `PATCH /location` | ✅ Actualiza coords |
| `GET /status` | ✅ Retorna estado |
| `POST /test` | ✅ Para debugging |
| `notifyNearbyUsers()` | ✅ Batch con PostGIS |

### ✅ Web Push Service (webPush.js)
| Función | Estado |
|---------|--------|
| VAPID Config | ✅ Configurado |
| `sendPushNotification()` | ✅ Funcional |
| `sendBatchNotifications()` | ✅ Con cleanup de expirados |
| Payload factories | ⚠️ Ver inconsistencias abajo |

### ⚠️ Service Worker (sw.ts)
| Aspecto | Estado |
|---------|--------|
| Push event | ✅ Parsea payload |
| In-app suppression | ✅ Si app visible, no muestra native |
| notificationclick | ⚠️ Espera campos que no todos los payloads tienen |
| mark-read action | ✅ Fixed (P1 reciente) |
| Navegación | ✅ Abre URL correcta |

---

## Tipos de Notificación Push

| Tipo | Archivo | Push | Payload `anonymousId` | Acciones SW |
|------|---------|------|----------------------|-------------|
| **Chat Message** | chats.js | ✅ | ✅ (Fixed P1) | ✅ mark-read |
| **Activity** (comment/sighting/share) | notificationService.js | ✅ | ❌ Falta | ⚠️ Solo navegación |
| **Reply** | notificationService.js | ✅ | ❌ Falta | ⚠️ Solo navegación |
| **Mention** | notificationService.js | ✅ | ❌ Falta | ⚠️ Solo navegación |
| **Like** | notificationService.js | ✅ | ❌ Falta | ⚠️ Solo navegación |
| **Follow** | notificationService.js | ✅ | ❌ Falta | ⚠️ Solo navegación |
| **Nearby Report** | push.js | ✅ | ❌ Falta | ⚠️ Solo navegación |

---

## Bloqueadores

### P0 (Críticos) - **NINGUNO**
No hay bloqueadores que impidan funcionar en producción.

### P1 (Importantes)

| ID | Problema | Impacto | Archivo |
|----|----------|---------|---------|
| P1-1 | `createActivityNotificationPayload` no incluye `anonymousId` | Acciones background fallan | webPush.js:207-244 |
| P1-2 | `createReportNotificationPayload` no incluye `anonymousId` | Marcar como leído no funciona | webPush.js:165-200 |

### P2 (Mejoras)

| ID | Problema | Impacto |
|----|----------|---------|
| P2-1 | SSE y Push emiten en paralelo sin coordinación | Mini-duplicación visual |
| P2-2 | No hay retry estratégico para push fallidos | Pérdida silenciosa |
| P2-3 | SW no tiene typed contracts con backend | Mantenibilidad |

---

## Cambios Necesarios

### Alta Prioridad

#### [MODIFY] webPush.js - Agregar anonymousId a todos los payloads

```javascript
// createActivityNotificationPayload
data: {
    url: url,
    reportId: reportId,
    anonymousId: recipientAnonymousId, // ← AGREGAR
    type: type, // ← AGREGAR para routing SW
    timestamp: Date.now()
}

// createReportNotificationPayload
data: {
    reportId: report.id,
    anonymousId: recipientAnonymousId, // ← AGREGAR
    type: 'nearby-report', // ← AGREGAR
    url: `/explorar?reportId=${report.id}`,
    timestamp: Date.now()
}
```

#### [MODIFY] notificationService.js - Pasar recipientId a payload factories

En cada llamada a `createActivityNotificationPayload`, pasar el ID del destinatario:

```javascript
const payload = createActivityNotificationPayload({
    type: 'comment',
    title: title,
    message: message,
    reportId: reportId,
    entityId: entityId,
    recipientAnonymousId: report.anonymous_id // ← AGREGAR
});
```

### Media Prioridad

#### [MODIFY] sw.ts - Validación defensiva unificada

```typescript
// Al inicio de notificationclick
const data = event.notification.data || {};
if (!data.anonymousId) {
    console.warn('[SW] Missing anonymousId in notification payload');
    // Continuar con navegación, pero no ejecutar acciones
}
```

---

## Flujo Ideal Post-Fix

```
1. Evento en Backend (ej: nuevo mensaje)
   │
2. notificationService.js / chats.js
   │
3. createXNotificationPayload({ ..., recipientAnonymousId })
   │
4. sendPushNotification(subscription, payload)
   │
5. Service Worker recibe push event
   │
6. Parsea payload con anonymousId
   │
7. showNotification con actions
   │
8. Usuario hace click en acción
   │
9. notificationclick con contexto completo
   │
10. API call con x-anonymous-id header ✅
```

---

## Riesgos en Producción (Sin Fixes)

| Riesgo | Probabilidad | Impacto |
|--------|--------------|---------|
| Acciones "Marcar como leído" fallan para notificaciones que no son chat | Alta | Medio |
| Logs del SW llenos de warnings por payload incompleto | Alta | Bajo |
| UX degradada: usuario espera que acciones funcionen | Media | Alto |

---

## Checklist Final para Producción

- [x] VAPID keys configuradas
- [x] Frontend hook funcional
- [x] Subscribe/Unsubscribe funcional
- [x] Push de chat con contexto completo (P1 Fixed)
- [x] SW parsea payloads correctamente
- [x] SW suprime notificaciones si app visible
- [x] SSE Transaccional implementado (P3 Fixed)
- [ ] **Todos los payloads incluyen `anonymousId`** ← PENDIENTE
- [ ] **Todos los payloads incluyen `type`** ← PENDIENTE
- [x] Cleanup de suscripciones expiradas

---

## Resumen Ejecutivo

**Push Notifications funciona hoy para:**
- ✅ Mensajes de chat (100% funcional con acciones)

**Push Notifications funciona parcialmente para:**
- ⚠️ Comentarios, likes, follows, menciones (navegación OK, acciones NO)
- ⚠️ Reportes cercanos (navegación OK, acciones NO)

**Para 100% producción:**
1. Agregar `anonymousId` y `type` a `createActivityNotificationPayload`
2. Agregar `anonymousId` y `type` a `createReportNotificationPayload`
3. Actualizar llamadas en `notificationService.js`

**Tiempo estimado:** 30 minutos de desarrollo + testing.

---
*Análisis completado: 2026-01-14*

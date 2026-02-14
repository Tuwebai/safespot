# 🔍 Guía de Diagnóstico Push - Modo DEV

## Endpoints Disponibles

### 1. Estado General del Sistema

```bash
curl http://localhost:3000/api/admin/diagnostics/push-health
```

**Respuesta esperada (sano)**:
```json
{
  "timestamp": "2026-02-13T20:00:00.000Z",
  "status": "HEALTHY",
  "healthy": true,
  "checks": {
    "webpush": {
      "configured": true,
      "public_key_preview": "BGFGz5PM_-yeKOzERt3..."
    },
    "subscriptions": {
      "active": "5",
      "inactive": "1",
      "unique_users": "3"
    },
    "presence": {
      "redis_status": "ready",
      "users_online_count": 2,
      "online_users_sample": ["a1b2c3d4...", "e5f6g7h8..."]
    },
    "bullmq": {
      "status": "connected",
      "jobs_waiting": 0,
      "jobs_active": 0,
      "jobs_completed": 12,
      "jobs_failed": 0
    }
  }
}
```

**🚨 Si ves esto, hay problema**:
```json
{
  "subscriptions": { "active": "0" },  // <- Nadie tiene suscripción push
  "presence": { "redis_status": "NOT CONNECTED" }  // <- Presence no funciona
}
```

---

### 2. Test de Envío Real

Para probar si las push llegan a un usuario específico:

```bash
curl -X POST http://localhost:3000/api/admin/diagnostics/push-test \
  -H "Content-Type: application/json" \
  -d '{
    "anonymousId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "message": "Test desde diagnóstico"
  }'
```

**Respuesta exitosa**:
```json
{
  "status": "SUCCESS",
  "summary": {
    "total": 1,
    "successful": 1,
    "failed": 0
  },
  "steps": [
    { "step": "CHECK_SUBSCRIPTIONS", "status": "OK", "count": 1 },
    { "step": "CHECK_PRESENCE", "status": "OK", "is_online": false },
    { "step": "SEND_PUSH", "status": "COMPLETED", "results": [
      { "subscription": "sub123...", "status": "SUCCESS", "http_status": 201 }
    ]}
  ]
}
```

**Respuesta con error 410** (token inválido):
```json
{
  "status": "FAILED",
  "steps": [{
    "step": "SEND_PUSH",
    "results": [{
      "status": "FAILED",
      "error": "Gone",
      "statusCode": 410,
      "should_deactivate": true
    }]
  }]
}
```
> El sistema marca automáticamente `is_active = false` para tokens 410.

---

### 3. Simular Presence (Online/Offline)

Para forzar que un usuario aparezca online u offline:

```bash
# Marcar como ONLINE (no enviará push normalmente)
curl -X POST http://localhost:3000/api/admin/diagnostics/presence-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "anonymousId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "action": "online"
  }'

# Marcar como OFFLINE (enviará push normalmente)  
curl -X POST http://localhost:3000/api/admin/diagnostics/presence-simulate \
  -H "Content-Type: application/json" \
  -d '{
    "anonymousId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "action": "offline"
  }'
```

---

## 🔍 Cómo Interpretar los Logs

Cuando se genera una notificación, verás logs así:

```
[🔔 PUSH-DIAG] [trace-123] START type=ACTIVITY user=a1b2c3d4...
[🔔 PUSH-DIAG] [trace-123] DECISION: isOnline=true isSecurity=false priority=normal
[🔔 PUSH-DIAG] [trace-123] ONLINE → SSE only
[🔔 PUSH-DIAG] [trace-123] SSE result=SUCCESS
```

**Si el usuario está online** → Solo SSE, no llega push al navegador.

```
[🔔 PUSH-DIAG] [trace-456] START type=ACTIVITY user=e5f6g7h8...
[🔔 PUSH-DIAG] [trace-456] DECISION: isOnline=false isSecurity=false priority=normal
[🔔 PUSH-DIAG] [trace-456] OFFLINE → PUSH only
[🔔 PUSH-DIAG] [trace-456] Found 1 active subscriptions
[🔔 PUSH-DIAG] [trace-456] Sending to 1 subscription(s)...
[🔔 PUSH-DIAG] [trace-456] Sub[0] SUCCESS: delivered
[🔔 PUSH-DIAG] [trace-456] PUSH result=SUCCESS
```

**Si el usuario está offline** → Solo Push, debe llegar al navegador.

---

## 🐛 Flujo de Debugging

### Caso: "No me llegan notificaciones push"

**Paso 1**: Verificar suscripciones activas
```bash
curl http://localhost:3000/api/admin/diagnostics/push-health | jq '.checks.subscriptions'
```
- Si `active: "0"` → El frontend nunca llamó `/push/subscribe`
- Ir al navegador → DevTools → Application → Service Workers → Verificar registro
- Verificar `Notification.permission` debe ser `"granted"`

**Paso 2**: Verificar si el usuario está "online" para el sistema
```bash
curl http://localhost:3000/api/admin/diagnostics/push-health | jq '.checks.presence'
```
- Si el usuario está en `online_users_sample` → El sistema cree que tiene la app abierta
- Solución: Usar `presence-simulate` para forzar offline, o cerrar todas las tabs y esperar 60 segundos (TTL)

**Paso 3**: Forzar envío de test
```bash
curl -X POST http://localhost:3000/api/admin/diagnostics/push-test \
  -d '{"anonymousId": "TU_ID", "message": "Test"}'
```

**Posibles resultados**:
- `NO SUBSCRIPTIONS` → Frontend no se suscribió
- `SUCCESS` pero no ves la notificación → Revisar Service Worker en navegador
- `FAILED statusCode: 410` → Token expirado, se auto-limpia
- `FAILED statusCode: 401` → VAPID keys incorrectas

**Paso 4**: Verificar Service Worker en navegador
```javascript
// En consola del navegador:
navigator.serviceWorker.ready.then(reg => {
  console.log('SW registrado:', reg.scope);
});

// Verificar suscripción actual:
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('Suscripción:', sub ? 'Existe' : 'No existe');
    if (sub) console.log('Endpoint:', sub.endpoint);
  });
});
```

---

## 🔧 Problemas Comunes

### 1. Redis desconectado
```json
{ "presence": { "redis_status": "NOT CONNECTED" } }
```
**Impacto**: Todos los usuarios aparecen offline, siempre se envía push.
**Fix**: Verificar `REDIS_URL` en `.env`

### 2. VAPID no configurado
```json
{ "webpush": { "configured": false } }
```
**Fix**: Agregar a `.env`:
```
VAPID_PUBLIC_KEY=BG...
VAPID_PRIVATE_KEY=Ht...
VAPID_EMAIL=mailto:admin@safespot.app
```

### 3. Usuario siempre "online"
```
[🔔 PUSH-DIAG] DECISION: isOnline=true
```
pero el usuario cerró la app.

**Causa**: El heartbeat SSE no se limpió correctamente.
**Fix**: Usar endpoint `presence-simulate` con `action: "offline"`, o reiniciar Redis.

---

## 📊 Métricas Importantes

| Métrica | Valor Esperado | Si es 0 |
|---------|----------------|---------|
| `subscriptions.active` | > 0 | Nadie tiene push habilitado |
| `presence.users_online_count` | Variable | Redis no funciona |
| `bullmq.jobs_completed` | Incrementando | Worker no está procesando |
| `bullmq.jobs_failed` | 0 o bajo | Hay errores en envío |

---

## 🚀 Test End-to-End Completo

```bash
# 1. Ver estado inicial
curl http://localhost:3000/api/admin/diagnostics/push-health

# 2. En el navegador, asegurar que:
#    - Notification.permission === 'granted'
#    - Service Worker registrado
#    - Endpoint de push existe

# 3. Obtener tu anonymousId (desde localStorage o Application tab)
MY_ID="tu-anonymous-id-aqui"

# 4. Verificar suscripciones
curl http://localhost:3000/api/admin/diagnostics/push-health | jq ".checks.subscriptions"

# 5. Forzar envío de prueba
curl -X POST http://localhost:3000/api/admin/diagnostics/push-test \
  -H "Content-Type: application/json" \
  -d "{\"anonymousId\": \"$MY_ID\", \"message\": \"Test E2E\"}"

# 6. Ver logs del servidor - debe aparecer:
# [🔔 PUSH-DIAG] [trace-xxx] START type=...
# [🔔 PUSH-DIAG] [trace-xxx] OFFLINE → PUSH only
# [🔔 PUSH-DIAG] [trace-xxx] Sub[0] SUCCESS: delivered

# 7. Si no llega al navegador, revisar:
#    - DevTools → Application → Service Workers
#    - DevTools → Console (errores del SW)
#    - DevTools → Application → Push
```

---

**Documento creado**: 2026-02-13  
**Versión**: 1.0 (Modo DEV)

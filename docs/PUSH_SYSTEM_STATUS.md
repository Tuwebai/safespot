# 📊 Estado del Sistema de Push - SafeSpot

**Fecha**: 2026-02-14  
**Estado**: ✅ **FUNCIONANDO**

---

## ✅ Componentes Verificados

### Frontend
| Componente | Estado | Notas |
|------------|--------|-------|
| Service Worker | ✅ Registrado | v2.2-robust Activated |
| Permisos | ✅ Concedidos | `permission: 'granted'` |
| Suscripción | ✅ Creada | `isSubscribed: true` |
| Push Test | ✅ Funciona | Notificaciones llegan al navegador |

### Backend
| Componente | Estado | Notas |
|------------|--------|-------|
| WebPush Config | ✅ Configurado | VAPID keys presentes |
| Endpoint `/push/subscribe` | ✅ Funciona | Guarda suscripciones en DB |
| Endpoint `/push-test` | ✅ Funciona | Para testing manual |
| CORS | ✅ Configurado | Puerto 4173 agregado |

---

## 🔧 Fixes Aplicados

### 1. CORS - Puerto 4173
```javascript
// server/src/index.js
const baseOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:4173',  // ← Agregado para preview
  // ...
];
```

### 2. Service Worker Dev
- Creado `public/sw-dev.js` para modo desarrollo
- El SW de producción (`sw.js`) funciona correctamente en `npm run preview`

### 3. Inicialización de Push
- Creado `PushNotificationInitializer.tsx`
- Se monta dentro de `ToastProvider` en `App.tsx`
- Auto-subscribe en modo DEV cuando `permission === 'default'`

### 4. Seguridad - Query Params para SSE
- Frontend: Agrega `?anonymousId=xxx` a URLs SSE
- Backend: Acepta `anonymousId` por query param en GET requests

---

## 🧪 Cómo Testear

### 1. Obtener anonymous_id
```javascript
// En consola del navegador
JSON.parse(localStorage.getItem('safespot_session_v3')).anonymousId
```

### 2. Enviar push de prueba
```bash
node scripts/send-push-browser.cjs <anonymous_id> "Mensaje de prueba"
```

### 3. Verificar en DB
El endpoint `/api/diagnostics/push-health` muestra estadísticas.

---

## 🐛 Bug Conocido: Presence Tracker

**Síntoma**: `presenceTracker.isOnline()` devuelve `true` incluso después de cerrar la pestaña.

**Impacto**: 
- En flujo normal: Push no se envía (sistema cree que usuario está online)
- Workaround: Variable `FORCE_OFFLINE_TEST=true` en `.env`

**Fix pendiente**: Revisar lógica de TTL en Redis para presence.

---

## 📋 Checklist Producción

Antes de deployar:

- [ ] Cambiar `NODE_ENV=production` en `server/.env`
- [ ] Configurar `CORS_ORIGIN` con dominio real
- [ ] Verificar `FORCE_OFFLINE_TEST=false`
- [ ] Asegurar VAPID keys configuradas
- [ ] Probar en HTTPS real (push requiere HTTPS)
- [ ] Corregir bug del presence tracker

---

**Última actualización**: 2026-02-14

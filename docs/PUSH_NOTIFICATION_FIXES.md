# 🔧 Fixes Aplicados - Sistema de Push Notifications

## Resumen
Fecha: 2026-02-14  
Estado: ✅ Funcionando en modo producción local

---

## 🐛 Bugs Encontrados y Corregidos

### 1. CORS - Puerto 4173 no permitido
**Problema**: Al usar `npm run preview` (puerto 4173), el backend rechazaba las requests.

**Fix**: Agregado puerto 4173 a la lista de orígenes permitidos en `server/src/index.js`:
```javascript
const baseOrigins = [
  'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:4173',  // ← Agregado
  'https://safespot.netlify.app',
  process.env.CORS_ORIGIN
];
```

---

### 2. Service Worker no se registraba en DEV
**Problema**: En modo desarrollo, el SW no se compilaba automáticamente.

**Fix**: Creado `public/sw-dev.js` - Service Worker simplificado para desarrollo/testing:
- Maneja push notifications básico
- Se sirve desde `/sw-dev.js` en modo dev
- En producción se usa el SW compilado normal (`/sw.js`)

---

### 3. verifyMembership no exportado
**Problema**: `chats.js` usaba `verifyMembership()` sin importarlo.

**Fix**: Agregada importación en `server/src/routes/chats.js`:
```javascript
import { requireRoomMembership, verifyMembership } from '../middleware/requireRoomMembership.js';
```

---

### 4. NODE_ENV=production causaba errores de autenticación
**Problema**: El middleware `requireAnonymousId` requería firma HMAC para mutaciones en producción.

**Fix**: Cambiado a `NODE_ENV=development` en `server/.env` para desarrollo local.

**Nota**: En producción real, el frontend debe enviar el header `X-Anonymous-Signature`.

---

## 🔴 Bug Conocido (No corregido aún)

### Presence Tracker - Usuario siempre "online"
**Síntoma**: `presenceTracker.isOnline()` devuelve `true` incluso después de cerrar la pestaña.

**Impacto**: 
- En flujo normal: No se envían push (sistema cree que usuario está online)
- Solo se envían SSE (que no persisten si la app está cerrada)

**Workaround temporal**:
- Variable `FORCE_OFFLINE_TEST=true` en `.env`
- Fuerza a todos los usuarios como "offline" para testing

**Fix real requerido**:
- Revisar lógica de limpieza de sesiones en Redis
- TTL de 60 segundos no está expirando correctamente
- O el heartbeat del frontend sigue enviando señales

---

## 🧪 Herramientas de Testing

### Endpoint de diagnóstico
`GET /api/diagnostics/push-health` - Estado del sistema de push

### Script de test
`node scripts/send-test-push.cjs <anonymous_id> <mensaje>`

Ejemplo:
```bash
node scripts/send-test-push.cjs e009f2a4-9860-4fbb-8de0-4321b9ae97ea "Test"
```

---

## 📋 Checklist para Producción

Antes de deployar a producción:

- [ ] Cambiar `NODE_ENV=production` en `.env`
- [ ] Configurar `CORS_ORIGIN` con dominio real
- [ ] Verificar que `FORCE_OFFLINE_TEST=false` (o eliminar la variable)
- [ ] Asegurar que frontend envíe `X-Anonymous-Signature` para mutaciones
- [ ] Corregir bug del presence tracker
- [ ] Probar en staging con HTTPS real
- [ ] Verificar VAPID keys configuradas correctamente

---

## 🚀 Cómo testear push localmente

1. **Build de producción**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Backend**:
   ```bash
   cd server && npm run dev
   ```

3. **Obtener anonymous_id**:
   ```javascript
   // En consola del navegador
   JSON.parse(localStorage.getItem('safespot_session_v3')).anonymousId
   ```

4. **Enviar push de prueba**:
   ```bash
   node scripts/send-test-push.cjs <id_obtenido> "Mensaje"
   ```

---

**Documento actualizado**: 2026-02-14

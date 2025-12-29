# 🚀 Guía de Publicación - SafeSpot Argentina

## Resumen

Esta guía te lleva paso a paso desde desarrollo local hasta producción nacional.

---

## 📋 Pre-requisitos

### Cuentas necesarias
- [ ] **Supabase** (ya configurado) - Base de datos
- [ ] **Vercel** o **Netlify** - Frontend hosting (gratis)
- [ ] **Railway** o **Render** - Backend hosting (gratis tier disponible)
- [ ] **Dominio** (opcional) - ej: safespot.com.ar

### Variables de entorno listas
```bash
# Frontend (.env)
VITE_API_URL=https://api.safespot.app
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Backend (.env)
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
CORS_ORIGIN=https://safespot.app
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

---

## 🗄️ Paso 1: Migraciones de Base de Datos

Ejecutar en **Supabase SQL Editor** (en orden):

```sql
-- 1. Rate Limiting
database/migration_rate_limits.sql

-- 2. Shadow Ban + Audit
database/migration_moderation_audit.sql

-- 3. Geolocalización Nacional
database/migration_province_locality.sql

-- 4. Push Notifications
database/migration_push_subscriptions.sql
```

### Verificar PostGIS
```sql
SELECT PostGIS_version();
-- Debe devolver algo como "3.x.x"
```

---

## 🖥️ Paso 2: Deploy del Backend

### Opción A: Railway (Recomendado)

1. Conectar repo GitHub
2. Seleccionar carpeta `/server`
3. Agregar variables de entorno
4. Deploy automático

**URL resultante:** `https://safespot-api.up.railway.app`

### Opción B: Render

1. New Web Service → Connect repo
2. Root Directory: `server`
3. Build: `npm install`
4. Start: `npm start`
5. Agregar env vars

### Verificación
```bash
curl https://TU-API-URL/health
# Debe devolver: {"status":"ok",...}
```

---

## 🌐 Paso 3: Deploy del Frontend

### Opción A: Vercel (Recomendado)

1. Import proyecto desde GitHub
2. Framework: Vite
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment Variables:
   - `VITE_API_URL` → URL del backend

### Opción B: Netlify

1. New site from Git
2. Build: `npm run build`
3. Publish: `dist`
4. Environment variables en Settings

---

## 🔐 Paso 4: Configurar VAPID Keys

En el backend (`.env`):
```bash
VAPID_PUBLIC_KEY=BO1fgzTQamm...
VAPID_PRIVATE_KEY=y9InDJZEB9...
VAPID_EMAIL=mailto:soporte@safespot.app
```

---

## 🌍 Paso 5: Dominio Personalizado (Opcional)

### Para .com.ar
1. Registrar en NIC Argentina (https://nic.ar)
2. Configurar DNS:
   ```
   safespot.com.ar → Vercel/Netlify
   api.safespot.com.ar → Railway/Render
   ```

### SSL
- Vercel/Netlify: Automático
- Railway/Render: Automático

---

## 📱 Paso 6: PWA y Mobile

### Service Worker
Ya está en `public/sw.js`. Verificar que se registre.

### Manifest (crear si no existe)
```json
// public/manifest.json
{
  "name": "SafeSpot Argentina",
  "short_name": "SafeSpot",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0a0a0a",
  "background_color": "#0a0a0a",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512" }
  ]
}
```

---

## ✅ Checklist Final Pre-Launch

### Base de Datos
- [ ] Migraciones ejecutadas
- [ ] PostGIS habilitado
- [ ] RLS policies activas
- [ ] Índices creados

### Backend
- [ ] Variables de entorno configuradas
- [ ] VAPID keys generadas
- [ ] Health check respondiendo
- [ ] CORS configurado para dominio producción

### Frontend
- [ ] API_URL apuntando a producción
- [ ] Build sin errores
- [ ] SW registrándose
- [ ] Rutas funcionando

### Legal
- [ ] /terminos accesible
- [ ] /privacidad accesible
- [ ] Footer links funcionando

### Funcionalidades Core
- [ ] Crear reporte funciona
- [ ] Mapa carga
- [ ] Compresión de imágenes activa
- [ ] Push notifications (si VAPID configurado)

---

## 📊 Monitoreo Post-Launch

### Supabase Dashboard
- Requests/día
- Storage usado
- Errores de DB

### Uptime
- UptimeRobot (gratis) para monitorear endpoints

### Analytics (Opcional)
- Plausible Analytics (privacy-friendly)
- NO Google Analytics (privacidad)

---

## 🚨 Solución de Problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| CORS error | `CORS_ORIGIN` mal | Verificar dominio exacto |
| Push no funciona | VAPID missing | Generar y agregar keys |
| Mapa no carga | PostGIS missing | Habilitar extensión |
| 500 en reportes | Migración faltante | Ejecutar SQL |

---

## 📈 Escalabilidad

### Para 10,000+ usuarios/día:
1. **Supabase Pro** - Connection pooling
2. **CDN** - Cloudflare para assets
3. **Backend scaling** - Múltiples instancias

### Costos estimados (producción):
| Servicio | Plan | Costo/mes |
|----------|------|-----------|
| Supabase | Free → Pro | $0 → $25 |
| Vercel | Hobby | $0 |
| Railway | Hobby | $0 → $5 |
| Dominio .com.ar | Anual | ~$2,000 ARS |

---

## 🎉 ¡Listo para Argentina!

Una vez completados todos los pasos, tu plataforma estará:

✅ **Segura** - Rate limiting, shadow ban, sanitización  
✅ **Escalable** - PostGIS, índices, caching  
✅ **Legal** - T&C, privacidad, jurisdicción AR  
✅ **Mobile-first** - PWA, compresión, push  
✅ **Nacional** - Georef API, filtrado por provincia  

# 🔍 AUDITORÍA COMPLETA DE FEATURES - SAFESPOT

**Fecha:** 2026-02-11  
**Auditor:** Staff Engineer - SafeSpot Enterprise Protocol  
**Versión del Proyecto:** 2.4.0-pro  
**Scope:** Frontend + Backend + Arquitectura

---

## 📊 RESUMEN EJECUTIVO

SafeSpot es una plataforma de reportes ciudadanos anónimos con ~**372 archivos TypeScript/React** en frontend y ~**90 archivos JavaScript** en backend. La arquitectura es **enterprise-grade** con múltiples motores de resiliencia, sistema de realtime, gamificación completa, y un panel de administración robusto.

---

## ✅ FEATURES ACTUALMENTE IMPLEMENTADAS

### 1️⃣ CORE FEATURES (Fundamentales)

| Feature | Descripción | Tecnología |
|---------|-------------|------------|
| **Reportes Ciudadanos** | Creación/edición/eliminación de reportes con título, descripción, categoría, ubicación GPS, fecha del incidente | React Query + Zod |
| **Sistema Anónimo 100%** | Identidad basada en UUID v4 (`anonymous_id`) sin requerir login | SessionAuthority Engine |
| **Categorías de Reportes** | Celulares, Bicicletas, Motos, Autos, Laptops, Carteras, otros | Enum + Iconos dinámicos |
| **Geolocalización** | Detección automática de provincia/localidad/ciudad con geocodificación inversa | Georef API + Leaflet |
| **Mapa Interactivo** | Visualización de reportes en mapa con clustering, filtros por ubicación | Leaflet + React-Leaflet |
| **Wizard de Creación** | Flujo de 4 pasos para crear reportes (BasicInfo → Descripción → Ubicación/Fecha → Review) | React Hook Form |
| **Búsqueda y Filtros** | Filtros por categoría, zona, estado, fechas, búsqueda textual, radio geográfico | URL params + API |
| **Upload de Imágenes** | Compresión de imágenes (browser-image-compression) + upload a Supabase Storage | FormData |
| **Favoritos** | Guardar reportes favoritos por usuario | Tabla favorites + RLS |

### 2️⃣ GAMIFICATION (Sistema Completo)

| Feature | Descripción |
|---------|-------------|
| **Sistema de Puntos** | Puntos por reportes, comentarios, votos, shares | 
| **Niveles (Levels)** | Cálculo dinámico de nivel basado en puntos totales |
| **Insignias (Badges)** | Sistema de badges con rarezas: common, rare, epic, legendary |
| **Progreso de Badges** | Tracking de progreso hacia próximos logros |
| **Desbloqueo Animado** | Animaciones de confetti (canvas-confetti) al obtener badges |
| **Perfil Gamificado** | Stats cards, badges grid, next achievement preview |
| **Leaderboards** | Ranking de usuarios por contribución |

### 3️⃣ SOCIAL FEATURES

| Feature | Descripción | Estado |
|---------|-------------|--------|
| **Comentarios** | Sistema completo de comentarios con hilos anidados (threads) | ✅ |
| **Votos/Likes** | Upvotes en reportes y comentarios (polymorphic pattern) | ✅ |
| **Seguir Usuarios** | Follow/unfollow con followers/following counts | ✅ |
| **Perfiles Públicos** | Páginas de perfil accesibles por alias `/usuario/:alias` | ✅ |
| **Menciones** | Sistema de @mentions en comentarios con suggestions (Tiptap) | ✅ |
| **Feed Global** | Stream de actividad de la comunidad en tiempo real | ✅ |
| **Compartir Reportes** | Share nativo + registro de shares para gamificación | ✅ |

### 4️⃣ REALTIME & MESSAGING

| Feature | Descripción | Motor |
|---------|-------------|-------|
| **Chat 1-on-1** | Mensajería directa entre usuarios por reporte | SSE + BroadcastChannel |
| **SSE Pool** | Pool de conexiones SSE con state machine (OFFLINE/CONNECTING/CONNECTED/IDLE_SLEEP) | Motor 6 |
| **Leader Election** | Elección de líder entre tabs para coordinar conexiones | Motor 11 |
| **Event Authority Log** | Deduplicación de eventos con IndexedDB + TTL cleanup | Motor 9 |
| **Realtime Orchestrator** | Procesamiento de eventos realtime con Circuit Breaker | Motor 10 |
| **Delivery Receipts** | WhatsApp-grade: delivered + read receipts | ACK System |
| **Typing Indicators** | Indicadores de "escribiendo..." en chat | SSE Events |
| **Notificaciones Push** | Web Push con VAPID, Service Worker handling | Push API |

### 5️⃣ ADMIN & MODERATION

| Feature | Descripción |
|---------|-------------|
| **Panel Admin Separado** | `admin.html` con entry point independiente (`admin/entry.tsx`) |
| **Autenticación Admin** | JWT-based con roles (admin, superadmin) |
| **Moderación de Reportes** | Cambio de estado: pendiente → en_proceso → resuelto/cerrado/rechazado |
| **Moderación de Comentarios** | Pin/unpin, flag, delete de comentarios |
| **Heatmap Admin** | Visualización de densidad de reportes en mapa |
| **Gestión de Usuarios** | Lista, búsqueda, shadow ban de usuarios |
| **Transparencia Log** | Log de acciones de moderación visible al usuario afectado |
| **Notas de Moderación** | Notas internas en reportes |
| **Export de Datos** | Exportación de reportes en múltiples formatos |
| **Tareas de Moderación** | Sistema de tasks para moderadores |

### 6️⃣ SECURITY & ENTERPRISE

| Feature | Descripción | Nivel |
|---------|-------------|-------|
| **Session Authority (Motor 2)** | Gestión atómica de identidad con estados formales | Enterprise |
| **Identity Shield** | Firmas HMAC-SHA256 para validación de identidad | Security |
| **Traffic Controller (Motor 7)** | Rate limiting client-side con serial queue | Enterprise |
| **Data Integrity Engine (Motor 4)** | Supervisión de integridad con healing automático | Enterprise |
| **Telemetry Engine (Motor 8)** | Tracing distribuido con traceId/spanId | Observability |
| **Circuit Breaker** | Prevención de cascada de fallos en realtime | Resilience |
| **Row Level Security (RLS)** | Políticas PostgreSQL granulares por tabla | Security |
| **CORS Estricto** | Whitelist de orígenes con validación de Netlify previews | Security |
| **Rate Limiting Server** | express-rate-limit con Redis backing | Security |
| **Content Sanitization** | Sanitización de inputs (dompurify pattern) | Security |
| **Correlation IDs** | X-Request-ID, X-Trace-ID para trazabilidad E2E | Observability |
| **Versioned Storage** | Storage local con checksums para detección de corrupción | Data Integrity |

### 7️⃣ UX/UI FEATURES

| Feature | Descripción | Librería |
|---------|-------------|----------|
| **Modo Oscuro/Claro** | Theme switching con persistencia | Tailwind + CSS Vars |
| **Onboarding Interactivo** | Tour guiado para nuevos usuarios | React Joyride |
| **Rich Text Editor** | Editor Tiptap con mentions, placeholders, character count | Tiptap |
| **Pull to Refresh** | Gestura de pull en mobile para refrescar | Custom Hook |
| **Infinite Scroll** | Paginación con cursor en listas | React Query |
| **Virtual Scrolling** | Para listas largas de usuarios | @tanstack/react-virtual |
| **Skeleton Loaders** | Estados de carga con shimmer effect | Custom |
| **Toast Notifications** | Sistema de notificaciones toast | Custom Context |
| **Bottom Sheet** | Modales tipo bottom sheet en mobile | Custom |
| **Bottom Navigation** | Navegación inferior tipo app móvil | Custom |
| **Lazy Loading** | Code splitting por rutas | React.lazy |
| **PWA** | Service Worker con Workbox, offline fallback | Vite PWA |
| **Image Optimization** | Compresión automática de imágenes | browser-image-compression |

### 8️⃣ DATA & ENGINE FEATURES

| Feature | Descripción |
|---------|-------------|
| **React Query (TanStack)** | Cache server state con staleTime, refetch strategies |
| **Zustand** | Estado global ligero (auth, map store) |
| **Zod Schemas** | Validación de tipos en runtime |
| **Adapter Pattern** | Transformación Raw → Strict types |
| **Query Keys Normalizadas** | Sistema consistente de query keys |
| **Optimistic Updates** | UI actualiza antes del server con rollback |
| **BroadcastChannel Sync** | Sincronización entre tabs del mismo origen |
| **Error Boundaries** | Múltiples capas: Global, Chunk, Bootstrap |
| **Sentry Integration** | Error tracking con @sentry/react |

### 9️⃣ CONTENT & SEO

| Feature | Descripción |
|---------|-------------|
| **Páginas de Guía de Seguridad** | Protocolos: Anti-piraña, Cuento del Tío, Viaja Pillito, etc. |
| **Intel de Seguridad** | Corredores seguros, mapa nocturno, predicción del delito |
| **Blog** | Sistema de posts estáticos con markdown |
| **SEO Dinámico** | Meta tags, Open Graph, Twitter Cards |
| **Sitemap XML** | Generación automática de sitemap |
| **Schema.org** | Structured data para reportes |

### 🔟 ZONAS DE USUARIO

| Feature | Descripción |
|---------|-------------|
| **Zonas de Interés** | Home, Work, Frequent, Current |
| **Alertas por Zona** | Notificaciones cuando hay reportes en zonas configuradas |
| **Radio de Interés** | Configurable en metros (500m - 50km) |
| **Safe Score** | Puntuación de seguridad por zona basada en reportes |

---

## 📈 ESTADÍSTICAS DEL PROYECTO

| Métrica | Valor |
|---------|-------|
| Archivos Frontend | ~372 (ts/tsx) |
| Archivos Backend | ~90 (js) |
| Componentes React | ~181 |
| Custom Hooks | ~72 |
| Motores/Engines | 11 |
| Tablas PostgreSQL | 8 principales |
| Rutas API | ~35 endpoints |
| RLS Policies | ~20 policies |

---

## 🏛️ FEATURES ENTERPRISE/PROFESIONALES FALTANTES

### 1. SEGURIDAD & COMPLIANCE

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **2FA/MFA** | Autenticación de doble factor para admins | Protección contra acceso no autorizado | Media | P1 |
| **Audit Logging Completo** | Log de TODAS las acciones (quién, qué, cuándo, desde dónde) | Compliance GDPR, trazabilidad forense | Media | P0 |
| **Data Retention Policies** | Eliminación automática de datos antiguos por política | GDPR compliance, reducción de liability | Media | P1 |
| **PII Detection & Masking** | Detección automática de datos personales en reportes | Protección de privacidad | Alta | P2 |
| **Content Moderation AI** | Detección automática de contenido inapropiado (toxicidad, spam) | Reducir carga de moderadores | Alta | P1 |
| **Rate Limiting Avanzado** | Por usuario, por IP, por endpoint con diferentes tiers | Prevenir abuso sofisticado | Media | P1 |
| **IP Geolocation Blocking** | Bloqueo por país/región si es necesario | Cumplir restricciones legales | Baja | P2 |
| **WAF Integration** | Web Application Firewall para protección DDoS/SQLi | Seguridad perimeter | Media | P2 |

### 2. DATA & ANALYTICS

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Analytics Dashboard** | Métricas de uso: DAU, MAU, retention, engagement | Insights de producto | Media | P1 |
| **Heatmap de Actividad** | Visualización de hotspots de reportes por hora/día | Inteligencia operativa | Baja | P1 |
| **Trending Topics** | Detección automática de categorías/zonas con aumento de reportes | Early warning system | Media | P2 |
| **Predictive Analytics** | Predicción de incidentes basada en patrones históricos | Prevención proactiva | Alta | P2 |
| **Export Scheduled** | Reportes automáticos por email (diario/semanal/mensual) | Automatización | Baja | P2 |
| **Funnel Analytics** | Tracking de conversión: visita → crea reporte → completa | Optimización de UX | Media | P2 |
| **A/B Testing Framework** | Sistema para testear cambios de UI/UX | Data-driven decisions | Alta | P3 |

### 3. PERFORMANCE & ESCALABILIDAD

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **CDN para Imágenes** | CloudFlare/AWS CloudFront para assets | Mejorar carga global | Baja | P1 |
| **Redis Cluster** | Cache distribuido para sesiones y datos frecuentes | Escalabilidad | Media | P1 |
| **Read Replicas** | PostgreSQL read replicas para queries pesadas | Escalabilidad lectura | Media | P2 |
| **Connection Pooling** | PgBouncer para manejo eficiente de conexiones DB | Estabilidad bajo carga | Baja | P1 |
| **GraphQL API** | Alternativa flexible a REST para queries complejas | Developer experience | Alta | P3 |
| **Edge Functions** | Deno/Cloudflare Workers para lógica cercana al usuario | Latencia reducida | Media | P2 |
| **Database Sharding** | Particionamiento de datos por región/geografía | Escalabilidad masiva | Alta | P3 |

### 4. MONETIZACIÓN

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Suscripción Premium** | Modelo freemium con features exclusivas para pagos | Revenue stream | Media | P1 |
| **API Rate Tiers** | Límites diferentes para free/premium/enterprise | Monetización API | Baja | P2 |
| **Featured Reports** | Reportes destacados por pago (con etiqueta transparente) | Revenue + visibilidad | Media | P2 |
| **White-label para Gobiernos** | Plataforma customizada para municipios/provincias | B2B revenue | Alta | P2 |
| **Donations/Tips** | Sistema de propinas para usuarios que ayudan | Community support | Baja | P3 |
| **Affiliate Safety Products** | Links a productos de seguridad con comisión | Revenue pasivo | Baja | P3 |

### 5. INTEGRACIONES

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Integración Policía/Municipios** | API para que autoridades reciban reportes oficiales | Legitimidad + impacto real | Alta | P0 |
| **WhatsApp Bot** | Crear reportes vía mensaje de WhatsApp | Accesibilidad | Media | P1 |
| **Twitter/X Bot** | Reportes automáticos desde menciones | Alcance social | Baja | P2 |
| **Slack/Discord Webhooks** | Notificaciones de reportes a comunidades | Engagement | Baja | P2 |
| **Google Maps API** | Mejor geocodificación y places autocomplete | UX de ubicación | Media | P2 |
| **n8n/Zapier** | Automatizaciones con otras plataformas | Integración flexible | Media | P2 |
| **SMS Notifications** | Alertas por SMS para usuarios sin smartphone | Inclusión digital | Media | P2 |

### 6. COMUNICACIÓN & MARKETING

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Email Marketing** | Newsletters, digest semanal de reportes en zona | Engagement | Media | P2 |
| **Referral Program** | Invitar amigos = puntos/badges | Crecimiento orgánico | Baja | P2 |
| **Social Sharing Avanzado** | Cards personalizadas para cada tipo de reporte | Viralidad | Baja | P2 |
| **Push Notification Campaigns** | Notificaciones segmentadas por zona/intereses | Retención | Media | P2 |
| **Landing Pages por Ciudad** | Páginas SEO específicas para cada localidad | SEO local | Media | P2 |
| **Community Challenges** | Desafíos semanales: "Reporta 3 bicicletas esta semana" | Engagement | Baja | P2 |

### 7. MODERACIÓN AVANZADA

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Auto-moderación AI** | ML para detectar reportes falsos/spam automáticamente | Eficiencia moderación | Alta | P1 |
| **Community Moderators** | Usuarios de confianza pueden moderar contenido | Escalar moderación | Media | P2 |
| **Appeal System** | Sistema de apelaciones para usuarios sancionados | Fairness | Media | P1 |
| **Reputation Score** | Score de confianza por usuario basado en historial | Calidad de datos | Media | P2 |
| **Shadow Banning** | Restricción silenciosa de usuarios tóxicos | Moderación invisible | Baja | P1 |
| **Report Escalation** | Escalamiento automático a autoridades en casos graves | Impacto real | Media | P0 |

### 8. AI/ML

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Duplicate Detection** | ML para detectar reportes duplicados del mismo incidente | Calidad de datos | Alta | P2 |
| **Auto-categorization** | Sugerir categoría basada en descripción del reporte | UX simplificada | Media | P2 |
| **Sentiment Analysis** | Análisis de sentimiento en comentarios | Moderación priorizada | Media | P2 |
| **Image Recognition** | Detección de objetos en fotos de reportes | Validación automática | Alta | P3 |
| **Chatbot de Ayuda** | Bot para responder preguntas frecuentes | Soporte 24/7 | Alta | P3 |
| **Incident Clustering** | Agrupar reportes cercanos en tiempo como mismo incidente | Inteligencia | Alta | P2 |

### 9. ENTERPRISE ADMIN

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Multi-tenant Dashboard** | Dashboard separado por municipio/organización | White-label | Alta | P2 |
| **Custom Branding** | Colores, logos, dominios personalizados | White-label | Media | P2 |
| **Role-based Access Control (RBAC)** | Roles granulares: viewer, moderator, admin, superadmin | Seguridad | Media | P1 |
| **SSO Integration** | SAML/OAuth2 para login corporativo | Enterprise adoption | Alta | P2 |
| **API Keys Management** | Gestión de API keys para integraciones B2B | Developer platform | Media | P2 |
| **Bulk Operations** | Acciones masivas sobre reportes/usuarios | Eficiencia operativa | Baja | P1 |
| **Advanced Search** | Búsqueda con filtros complejos y saved searches | Productividad | Media | P1 |

### 10. MULTI-TENANCY / WHITE-LABEL

| Feature | Descripción | Beneficios | Complejidad | Prioridad |
|---------|-------------|------------|-------------|-----------|
| **Tenant Isolation** | Datos completamente separados por tenant | Seguridad multi-cliente | Alta | P2 |
| **Custom Domains** | Cada tenant con su propio dominio | Branding | Media | P2 |
| **Theming por Tenant** | CSS/themes personalizables por organización | Branding | Media | P2 |
| **Configurable Features** | Activar/desactivar features por tenant | Flexibilidad | Media | P2 |
| **Tenant Analytics** | Métricas separadas y dashboard de uso | Insights | Media | P2 |
| **Billing por Tenant** | Facturación separada y usage tracking | Business model | Alta | P2 |

---

## 🎯 RECOMENDACIONES PRIORITARIAS

### Inmediatas (P0 - Próximos 30 días)
1. **Audit Logging Completo** - Crítico para compliance y trazabilidad
2. **Integración con Autoridades** - Agrega valor real y legitimidad
3. **Report Escalation** - Impacto social inmediato

### Corto Plazo (P1 - 3 meses)
1. **Analytics Dashboard** - Necesario para tomar decisiones de producto
2. **2FA para Admins** - Seguridad crítica
3. **Auto-moderación AI** - Escalar moderación eficientemente
4. **Suscripción Premium** - Monetización temprana

### Medio Plazo (P2 - 6-12 meses)
1. **WhatsApp Bot** - Gran impacto en accesibilidad
2. **Redis Cluster + Read Replicas** - Escalabilidad
3. **Predictive Analytics** - Diferenciador de producto
4. **White-label para Gobiernos** - Oportunidad B2B grande

---

## 📋 ANEXO: ARQUITECTURA DE MOTORES

| Motor | Nombre | Responsabilidad |
|-------|--------|-----------------|
| M2 | Session Authority | Gestión atómica de identidad |
| M4 | Data Integrity Engine | Supervisión y healing de datos |
| M6 | SSE Pool | Gestión de conexiones realtime |
| M7 | Traffic Controller | Rate limiting y serial queue |
| M8 | Telemetry Engine | Tracing distribuido |
| M9 | Event Authority Log | Deduplicación de eventos |
| M10 | Realtime Orchestrator | Procesamiento de eventos SSE |
| M11 | Leader Election | Coordinación entre tabs |

---

**Fin del Documento de Auditoría**

*Generado conforme al SafeSpot Enterprise Protocol v1.0*

---

## ADDENDUM SUPREMO (POST LINEA 330) - 2026-02-17

### Objetivo del addendum
Actualizar esta auditoria con evidencia real de codigo para detectar features faltantes o incompletas (no wishlist), priorizadas por riesgo e impacto operativo.

### Metodo aplicado (read-only)
- Barrido de hooks y componentes criticos en `src/admin`, `src/components`, `src/pages`.
- Cruce de contratos UI -> API contra rutas reales en `server/src/routes`.
- Verificacion de placeholders/TODO/FIXME que impactan funcionalidad visible o trazabilidad enterprise.

### Matriz cerrada de gaps reales (confirmados en codigo)

| Feature / Flujo | Estado real | Evidencia en codigo | Riesgo | Prioridad | Cierre minimo recomendado |
|---|---|---|---|---|---|
| Admin Profile: export de datos | Incompleto (frontend llama endpoint inexistente) | `src/admin/hooks/useAdminProfile.ts:344` llama `POST /profile/export`, pero `server/src/routes/adminProfile.js` solo tiene `GET /`, `PUT /`, `PUT /avatar`, `DELETE /avatar` (`:34`, `:84`, `:140`, `:228`) | Alto | P0 | Implementar `POST /api/admin/profile/export` o deshabilitar CTA hasta backend listo |
| Admin Profile: solicitud de baja | Incompleto (frontend llama endpoint inexistente) | `src/admin/hooks/useAdminProfile.ts:365` llama `POST /profile/deletion-request`; sin ruta equivalente en `server/src/routes/adminProfile.js` | Alto | P0 | Implementar endpoint con auditoria M12 y reason obligatorio, o ocultar accion |
| Admin Profile: cierre de sesiones | Incompleto (UI operativa sin backend) | `src/admin/hooks/useAdminProfile.ts:276`, `:298` llaman `DELETE /profile/sessions/all` y `DELETE /profile/sessions/:id`; no existen en `server/src/routes/adminProfile.js` | Alto | P0 | Implementar endpoints de invalidacion de sesiones o bloquear botones en UI con copy "proximamente" |
| Admin Profile: metricas de moderacion | Parcial (hardcoded) | `src/admin/hooks/useAdminProfile.ts:175-176` fija `reports_moderated: 0` y `users_banned: 0` con TODO | Medio | P1 | Exponer metricas reales desde backend y eliminar valores fijos |
| 2FA admin en hook legacy | Inconsistente (flujo duplicado) | `src/admin/hooks/useAdminProfile.ts:321` usa `/profile/2fa/toggle` (placeholder), mientras el flujo real vive en `server/src/routes/adminAuth.js:260-337` y `src/admin/pages/SecurityPage.tsx:59-141` | Medio | P1 | Deprecar hook legacy y centralizar 2FA en flujo `admin/auth/2fa/*` |
| Chat Header Menu (acciones avanzadas) | Parcial (UI preparada, sin wiring en uso principal) | Props opcionales en `src/components/chat/ChatHeaderMenu.tsx:29-34`; en uso real (`src/components/chat/ChatWindow.tsx`) no se inyectan handlers de mute/export/clear/report/block | Medio | P2 | Definir roadmap: conectar handlers o remover opciones del contrato visual interno |
| Diagnostico bootstrap-failure a monitoreo externo | Parcial (solo logging local) | `server/src/routes/diagnostics.js:44` TODO de envio a monitoring service | Medio | P1 | Integrar envio a Sentry/monitor enterprise y validar trazabilidad por `traceId` |
| SafeScore invalid input observability | Parcial (falta telemetria real) | `src/lib/utils-score.ts:19` TODO para log a Sentry (`SAFESCORE_INVALID_INPUT`) | Bajo | P2 | Emitir evento de observabilidad sin payload sensible |
| Filtros de categorias en Reportes | Parcial (hardcoded) | `src/pages/Reportes.tsx:218` comentario `TODO: Hacer dinamico` | Medio | P2 | Externalizar categorias a fuente unica (constantes/backend) para evitar drift |
| Step4 wizard: dependencia de fecha | Deuda tecnica pendiente | `src/components/report-wizard/Step4ReviewSubmit.tsx:6` FIXME por modulo no encontrado en import comentado | Bajo | P3 | Cerrar FIXME (usar util estable o `date-fns`) para evitar regresion futura |

### Rectificacion de estado (auditoria anterior desactualizada)

- `2FA/MFA` **no** debe figurar como "faltante total": hoy existe implementacion real en backend y pantalla de seguridad admin.
- El gap actual de 2FA es de **consistencia interna** (hook legacy placeholder), no de ausencia de feature.

### Backlog recomendado (sin scope creep)

1. P0: cerrar endpoints faltantes de `admin/profile` (export, deletion-request, sessions) con auditoria y reason obligatorio.
2. P1: reemplazar metricas hardcoded del perfil admin por metricas reales backend.
3. P1: unificar superficie de 2FA en `admin/auth/2fa/*` y deprecar toggle legacy.
4. P1: completar integracion de diagnostics con monitoreo externo.
5. P2: cerrar deudas parciales de UX/consistencia (chat actions wiring, categorias dinamicas, observabilidad de SafeScore).

### Criterio de cierre para cada gap

- Contrato no roto (sin cambios breaking en API existente).
- `npx tsc --noEmit` en verde.
- Evidencia funcional (smoke + trazabilidad en logs/telemetria cuando aplique).
- Actualizacion de auditoria en este mismo archivo al cerrar cada item.

---

## FEATURES ENTERPRISE UNICAS Y NECESARIAS (FALTANTES)

> Esta seccion lista iniciativas de nivel superior, con impacto transversal para todos los usuarios (no solo admins), para llevar SafeSpot a estandar top-tier.

| Feature Enterprise | Por que es necesaria para todos | Diferencial/Unicidad | Prioridad | Complejidad | Resultado esperado |
|---|---|---|---|---|---|
| **Passkeys + sesion resistente (WebAuthn)** | Reduce friccion y elimina dependencia de password tradicional; mejora recuperacion de acceso | Login passwordless con seguridad fuerte y UX superior | P0 | Alta | Menos sesiones invalidas, menos abandono en login, mayor seguridad real |
| **Offline-first real de reportes (cola durable + replay)** | Usuarios reportan en calle con conectividad mala/intermitente | Crear reporte sin red y sincronizar automaticamente al volver online | P0 | Alta | Cero perdida de reportes por mala señal; mayor tasa de reporte completado |
| **Centro de alertas inteligentes por contexto (zona/horario/riesgo)** | Todos necesitan alertas relevantes, no ruido | Alertas hipercontextuales por rutina y ubicacion habitual | P0 | Media | Notificaciones utiles y accionables; mayor retencion diaria |
| **Trust Score explicable por reporte (anti-fake enterprise)** | Todo usuario necesita saber si un reporte es confiable | Score interpretable con factores visibles (no caja negra) | P0 | Alta | Menor desinformacion, mejor toma de decision en tiempo real |
| **Workflow de resolucion verificable (caso abierto->validado->cerrado)** | Sin cierre verificable, el usuario no ve valor completo del sistema | Ciclo de vida auditable de cada incidente con evidencia | P1 | Media | Mayor confianza en plataforma y percepcion de utilidad real |
| **Identidad seudonima verificable (sin exponer PII)** | Protege privacidad y mejora calidad de aportes comunitarios | Reputacion portable sin revelar identidad real | P1 | Alta | Menos abuso, mejor calidad de comunidad, privacidad intacta |
| **Modo crisis (evento masivo) con priorizacion automatica** | En incidentes grandes, todos los usuarios necesitan continuidad y orden | Degradacion controlada + prioridad de reportes criticos | P1 | Alta | App util bajo estres extremo; menos caos informativo |
| **Asistente de reporte guiado por evidencia (texto+imagen+contexto)** | Facilita reportes de calidad para cualquier perfil de usuario | Copilot de reporte con validaciones en vivo | P1 | Media | Reportes mas completos, menos errores, mejor accionabilidad |
| **Timeline personal de seguridad (riesgo dinamico por rutina)** | Todo usuario quiere decisiones preventivas concretas | Radar personal de riesgo por horarios y desplazamientos | P2 | Alta | Prevencion proactiva, no solo reaccion a incidentes |
| **Canal de escalamiento institucional con SLA visible** | Usuarios necesitan saber si su reporte tuvo accion real | Integracion con actores institucionales + estado de atencion | P2 | Alta | Credibilidad alta y cierre de loop ciudadano-institucion |

### Orden de ejecucion recomendado (maximo impacto)

1. **P0 inmediato:** Passkeys, Offline-first real, Alertas inteligentes, Trust Score explicable.
2. **P1 consolidacion:** Workflow de resolucion, Identidad seudonima verificable, Modo crisis, Asistente guiado.
3. **P2 expansion:** Timeline personal de seguridad, Escalamiento institucional con SLA visible.

### Criterio de admision (para evitar features "lindas" pero inutiles)

- Debe mejorar una metrica universal: conversion de reporte, retencion, confianza, tiempo de accion.
- Debe funcionar en escenarios mobile reales (Android, red inestable, uso en calle).
- Debe mantener privacidad by design (sin exponer datos sensibles).
- Debe poder auditarse end-to-end (decision, evento, resultado).

### +20 features enterprise adicionales (faltantes)

| Feature Enterprise | Por que es necesaria para todos | Diferencial/Unicidad | Prioridad | Complejidad | Resultado esperado |
|---|---|---|---|---|---|
| **Modo ahorro extremo de datos** | Usuarios con planes limitados necesitan usar la app igual | Compresion/agresividad adaptable por red | P0 | Media | Menor abandono por consumo de datos |
| **Fallback SMS para alertas criticas** | No todos tienen datos activos todo el tiempo | Doble canal resiliente Push+SMS | P1 | Media | Continuidad de alertas en escenarios adversos |
| **Deteccion de zonas ciegas de reporte** | Evita sesgo por baja participacion geografica | Mapa de cobertura comunitaria en tiempo real | P1 | Media | Mejor cobertura y calidad de inteligencia |
| **Priorizacion de incidentes por severidad contextual** | Todos necesitan ver primero lo mas urgente | Ranking dinamico por riesgo real del contexto | P0 | Alta | Menor tiempo de reaccion del usuario |
| **Verificacion cruzada comunitaria por quorum** | Reduce fake reports para toda la red | Confirmacion distribuida con evidencia minima | P0 | Alta | Mayor confianza en el feed |
| **Deteccion de anomalias de abuso en tiempo real** | Protege la experiencia de todos contra spam coordinado | Motor anti-abuso adaptativo por comportamiento | P0 | Alta | Feed mas limpio y estable |
| **Modo accesibilidad total (WCAG AAA operativo)** | App usable para usuarios con discapacidad | Flujos criticos accesibles sin perdida funcional | P0 | Media | Inclusividad real y adopcion mas amplia |
| **Internacionalizacion regional inteligente** | Comunidades mixtas requieren idioma y formato local | Copys, fechas y mapas adaptados por region | P2 | Media | Menos friccion de uso y mejor comprension |
| **Firma de integridad de eventos cliente-servidor** | Todos se benefician de datos no adulterados | Cadena verificable de eventos sensibles | P1 | Alta | Mayor trazabilidad y confianza legal |
| **Replay forense de incidentes (audit trail visual)** | Usuarios y moderacion necesitan explicabilidad completa | Timeline reconstruible de cambios/eventos | P1 | Alta | Resolucion de disputas mas rapida |
| **Notificaciones anti-fatiga (rate inteligente por usuario)** | Evita desinstalaciones por exceso de push | Politica de cadencia personalizada | P0 | Media | Retencion alta sin perder alerta critica |
| **Enrutamiento por confiabilidad de red (multi-endpoint)** | Red movil inestable afecta a todos | Seleccion automatica de endpoint mas sano | P1 | Alta | Menos errores visibles y mejor latencia |
| **Precarga predictiva de vistas criticas** | Reduce espera en flujos frecuentes | Warmup por patron de uso real | P1 | Media | UX mas rapida percibida |
| **Mapa de riesgo por franja horaria personal** | Toma de decisiones diaria para cualquier usuario | Recomendaciones preventivas por horario/habito | P1 | Alta | Prevencion proactiva util |
| **Modo evidencia protegida (metadata segura)** | Mejora validez de reportes con fotos/video | Sellado temporal + minimizacion de PII | P1 | Alta | Evidencia mas util sin comprometer privacidad |
| **Control de calidad de reporte en tiempo real** | Todos reportan mejor con guia inmediata | Validaciones semanticas antes de publicar | P0 | Media | Menos reportes pobres/incompletos |
| **Motor de recomendaciones de seguridad accionables** | Usuarios quieren accion concreta, no solo informacion | Sugerencias situacionales por contexto local | P1 | Media | Mayor utilidad diaria percibida |
| **Sincronizacion robusta multi-dispositivo de preferencias** | Experiencia consistente entre telefono y desktop | Preferencias y alertas coherentes por cuenta | P2 | Media | Menos friccion y configuracion repetida |
| **Gobernanza de cambios con feature flags auditables** | Protege a todos de regresiones en produccion | Rollout gradual con kill-switch inmediato | P0 | Media | Menos incidentes y rollback rapido |
| **Panel publico de transparencia operativa** | Confianza comunitaria requiere visibilidad del sistema | SLA, uptime, latencia y tiempos de moderacion abiertos | P1 | Baja | Mayor credibilidad institucional |

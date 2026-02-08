# 📋 ESPECIFICACIÓN COMPLETA - Páginas Faltantes del Admin

**Fecha:** 2026-02-06  
**Contexto:** SafeSpot Admin Dashboard  
**Páginas Faltantes:** 
1. `/admin/settings` - Configuración del Sistema
2. `/admin/profile` - Perfil del Administrador

---

## 🎯 RESUMEN EJECUTIVO

El Admin Layout (`AdminLayout.tsx`) tiene navegación a dos páginas que **no existen**:

| Link | Línea | Ruta | Estado |
|------|-------|------|--------|
| Botón Settings (icono) | Línea 115 | `/admin/settings` | ❌ No existe página |
| "Mi Perfil" en dropdown | Línea 140 | `/admin/profile` | ❌ No existe página |
| "Configuración" en dropdown | Línea 147 | `/admin/settings` | ❌ No existe página |

Al hacer clic en estos elementos, el router intentará navegar a rutas sin componente asociado, causando una pantalla en blanco o error 404.

---

## 📄 PÁGINA 1: /admin/settings

### 1.1 Propósito
Panel de configuración global de la plataforma SafeSpot para super-administradores. Controla parámetros operativos, límites del sistema, y feature flags.

### 1.2 Layout y Estructura Visual

```
┌─────────────────────────────────────────────────────────────────┐
│ SYSTEM SETTINGS                                    [Guardar]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔔 NOTIFICACIONES                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑️ Notificaciones push habilitadas                      │   │
│  │ ☑️ Email de resumen diario a admins                     │   │
│  │ ☑️ Alertas de moderación en tiempo real                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🛡️ MODERACIÓN AUTOMÁTICA                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Flag threshold: [3] flags para auto-ocultar             │   │
│  │ Auto-moderación IA: [Activada ▼]                        │   │
│  │ Palabras prohibidas: [Editar lista...]                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  📊 LÍMITES DEL SISTEMA                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Reportes por usuario/hora: [3]                          │   │
│  │ Comentarios por reporte: [50]                           │   │
│  │ Imágenes por reporte: [5]                               │   │
│  │ Tamaño máx. imagen: [5MB]                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🎮 GAMIFICACIÓN                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Puntos por reporte: [10]                                │   │
│  │ Puntos por comentario: [2]                              │   │
│  │ Puntos por voto: [1]                                    │   │
│  │ Multiplicador streak: [1.5x]                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚙️ FEATURE FLAGS                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☑️ Chat entre usuarios                                  │   │
│  │ ☑️ Sistema de follows                                   │   │
│  │ ☐ Modo mantenimiento (solo admins)                      │   │
│  │ ☑️ Nuevos registros permitidos                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🗄️ MANTENIMIENTO                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [🧹 Limpiar caché de reportes]                          │   │
│  │ [🔄 Sincronizar contadores]                             │   │
│  │ [📦 Backup de base de datos]                            │   │
│  │ [🚨 Modo emergencia: Desactivar app]                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Componentes Necesarios

#### Estructura de Archivos
```
src/admin/pages/
├── SettingsPage.tsx          # Página principal
├── SettingsPage.test.tsx     # Tests

src/admin/components/settings/
├── SettingsSection.tsx       # Contenedor de sección
├── SettingsToggle.tsx        # Toggle switch
├── SettingsNumberInput.tsx   # Input numérico con validación
├── SettingsSelect.tsx        # Dropdown select
├── FeatureFlagCard.tsx       # Tarjeta de feature flag
├── MaintenanceActions.tsx    # Botones de acciones de mantenimiento
└── SettingsSkeleton.tsx      # Loading state
```

#### SettingsSection.tsx
```typescript
interface SettingsSectionProps {
  title: string;
  icon: LucideIcon;
  description?: string;
  children: React.ReactNode;
}
```

#### SettingsNumberInput.tsx
```typescript
interface SettingsNumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (value: number) => void;
  description?: string;
}
```

### 1.4 Estado y Data Fetching

```typescript
interface SystemSettings {
  notifications: {
    pushEnabled: boolean;
    dailyDigest: boolean;
    moderationAlerts: boolean;
  };
  moderation: {
    flagThreshold: number;
    autoModerationEnabled: boolean;
    bannedWords: string[];
  };
  limits: {
    reportsPerHour: number;
    commentsPerReport: number;
    imagesPerReport: number;
    maxImageSizeMB: number;
  };
  gamification: {
    pointsPerReport: number;
    pointsPerComment: number;
    pointsPerVote: number;
    streakMultiplier: number;
  };
  features: {
    chatEnabled: boolean;
    followsEnabled: boolean;
    maintenanceMode: boolean;
    registrationEnabled: boolean;
  };
}
```

### 1.5 Endpoints Backend Requeridos

```javascript
// GET /api/admin/settings
// Obtiene configuración actual del sistema
Response: { success: true, data: SystemSettings }

// PUT /api/admin/settings
// Actualiza configuración (batch o individual)
Body: Partial<SystemSettings>
Response: { success: true, data: updatedSettings }

// POST /api/admin/maintenance/clear-cache
// Limpia caché de Redis/reportes
Response: { success: true, message: "Cache cleared" }

// POST /api/admin/maintenance/sync-counters
// Re-sincroniza contadores de votos/comentarios
Response: { success: true, affected: number }

// POST /api/admin/maintenance/backup
// Inicia backup de base de datos
Response: { success: true, backupId: string }

// POST /api/admin/maintenance/emergency-mode
// Activa/desactiva modo mantenimiento
Body: { enabled: boolean }
Response: { success: true }
```

### 1.6 Hooks Personalizados

```typescript
// src/admin/hooks/useSystemSettings.ts
export const useSystemSettings = () => {
  return useQuery<SystemSettings>({
    queryKey: ['admin', 'settings'],
    queryFn: fetchSystemSettings,
  });
};

export const useUpdateSettings = () => {
  return useMutation({
    mutationFn: updateSystemSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'settings'] });
      toast.success('Configuración guardada');
    },
  });
};

export const useMaintenanceAction = () => {
  return useMutation({
    mutationFn: performMaintenanceAction,
  });
};
```

### 1.7 Permisos y Seguridad

- **Requiere rol:** `superadmin` o `admin` con permiso `system:settings`
- **Auditoría:** Todos los cambios deben loguearse con:
  - Admin ID
  - Timestamp
  - Campo modificado
  - Valor anterior → Valor nuevo
- **Validación:** Algunos límites tienen máximos/mínimos absolutos

### 1.8 UX Consideraciones

1. **Guardado:** Botón "Guardar cambios" flotante o sticky footer
2. **Estado no guardado:** Warning si el usuario intenta salir con cambios pendientes
3. **Confirmación:** Modal de confirmación para acciones destructivas (modo emergencia)
4. **Feedback:** Toast notifications para éxito/error
5. **Skeleton:** Loading state mientras carga configuración inicial

---

## 📄 PÁGINA 2: /admin/profile - ENTERPRISE EDITION

### 2.1 Propósito
Perfil enterprise del administrador. Centro de control personal con seguridad nivel corporativo, auditoría completa de actividad, gestión de sesiones avanzada, y cumplimiento normativo (GDPR-like).

### 2.2 Estructura de Navegación (8 Secciones)

```
/admin/profile
├── 🧱 Cuenta                    # Identidad y datos personales
├── 🔐 Seguridad                 # Password, 2FA, políticas
├── 📱 Sesiones                  # Gestión de dispositivos
├── 🔔 Notificaciones            # Preferencias de alertas
├── 🎨 Preferencias UI           # Personalización de interfaz
├── 📊 Actividad                 # Auditoría personal y métricas
├── 🔌 API & Integraciones       # Tokens, SSO
└── 🚨 Zona Crítica              # Acciones destructivas
```

---

### 🧱 2.3 SECCIÓN: Identidad & Cuenta (Base Sólida)

#### Layout Visual
```
┌─────────────────────────────────────────────────────────────────┐
│ 🧱 IDENTIDAD & CUENTA                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐  │
│  │                 │  │ Alias          [AdminPro      ] ✏️ │  │
│  │    [Avatar]     │  │ Email          [admin@safe... ] ✏️ │  │
│  │                 │  │ Rol            👑 Super Admin       │  │
│  │  [📷 Cambiar    │  │ Estado         ✅ Activa            │  │
│  │   foto con      │  │ Creado         15 Ene 2025          │  │
│  │   crop]         │  │ Último login   Hoy 14:30 (IP:... ) │  │
│  │                 │  │ Verificación   ⚠️ Pendiente         │  │
│  └─────────────────┘  └─────────────────────────────────────┘  │
│                                                                 │
│  📧 CAMBIO DE EMAIL (Seguridad reforzada)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Para cambiar tu email, debes confirmar:                │   │
│  │ 1. Contraseña actual                                   │   │
│  │ 2. Código enviado a email actual                       │   │
│  │ 3. Código enviado a email nuevo                        │   │
│  │                                                        │   │
│  │ [Iniciar proceso de cambio de email]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Features
- **Avatar con Crop:** Integración con react-cropper, validación de tamaño/tipo
- **Alias editable:** Validación de unicidad, historial de aliases
- **Email enterprise:** Cambio con triple confirmación (password + email viejo + email nuevo)
- **Estado de cuenta:** Activa / Suspendida / Pendiente verificación / En revisión
- **Metadatos:** Fecha creación, último login con IP y geolocalización aproximada

#### Schema
```typescript
interface AdminIdentity {
  id: string;
  alias: string;
  aliasHistory: { alias: string; changedAt: string }[];
  email: string;
  emailVerified: boolean;
  emailPendingVerification?: string;
  role: 'admin' | 'superadmin' | 'auditor';
  avatarUrl?: string;
  status: 'active' | 'suspended' | 'pending_verification' | 'under_review';
  createdAt: string;
  lastLogin: {
    timestamp: string;
    ip: string;
    location: string;
    device: string;
  };
}
```

---

### 🔐 2.4 SECCIÓN: Seguridad Avanzada (Nivel Enterprise)

#### Layout Visual
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔐 SEGURIDAD                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔑 AUTENTICACIÓN                                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Contraseña: **************               [Cambiar]     │   │
│  │ Fuerza: ████████░░ Buena                               │   │
│  │ Último cambio: hace 45 días                            │   │
│  │ Historial: [Ver 5 cambios anteriores]                  │   │
│  │                                                        │   │
│  │ ☑️ Forzar cambio en próximo login                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🛡️ AUTENTICACIÓN DE DOS FACTORES                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Estado: ✅ Activada (TOTP)                             │   │
│  │ Método: Google Authenticator                           │   │
│  │ Último uso: Hoy 09:15                                  │   │
│  │                                                        │   │
│  │ [📥 Descargar códigos de respaldo] (10 restantes)      │   │
│  │ [🔄 Regenerar códigos]                                 │   │
│  │ [➕ Agregar método SMS]                                 │   │
│  │ [⚠️ Desactivar 2FA]                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🔍 SEGURIDAD DE SESIÓN                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Modo paranoia: ☐ Requerir password para acciones críticas       │   │
│  │                ☐ Requerir 2FA para acciones destructivas       │   │
│  │                                                        │   │
│  │ Intentos fallidos recientes: 2 (últimas 24h)           │   │
│  │ [Ver historial de intentos]                            │   │
│  │                                                        │   │
│  │ Notificación de nuevo dispositivo: ✅ Activada         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Features
- **Password Policy:** Medidor de fuerza, historial de contraseñas (no repetir últimas 5), expiración configurable
- **2FA TOTP:** QR setup, backup codes descargables (10 códigos únicos), regeneración, último uso
- **Método secundario:** SMS fallback opcional
- **Modo Paranoia:** Re-autenticación para acciones críticas/destructivas
- **Historial de intentos fallidos:** IP, timestamp, device fingerprint
- **Notificación de nuevos dispositivos:** Email/push cuando hay login desde dispositivo desconocido

#### Schema
```typescript
interface AdminSecurity {
  password: {
    lastChanged: string;
    strength: 'weak' | 'fair' | 'good' | 'strong';
    history: { changedAt: string; reason?: string }[];
    mustChangeOnNextLogin: boolean;
  };
  twoFactor: {
    enabled: boolean;
    method: 'totp' | 'sms' | null;
    totpEnabledAt?: string;
    lastUsed?: string;
    backupCodesRemaining: number;
    hasSecondaryMethod: boolean;
  };
  paranoiaMode: {
    requirePasswordForCritical: boolean;
    require2FAForDestructive: boolean;
  };
  loginAttempts: {
    failedRecent: number;
    history: {
      timestamp: string;
      ip: string;
      device: string;
      success: boolean;
    }[];
  };
}
```

---

### 📱 2.5 SECCIÓN: Sesiones (Gestión Enterprise)

#### Layout Visual
```
┌─────────────────────────────────────────────────────────────────┐
│ 📱 SESIONES ACTIVAS                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  3 dispositivos activos  [🚪 Cerrar todas las demás]           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🖥️  Este dispositivo                    [Actual]        │   │
│  │ Chrome en Windows                        [🚪 Cerrar]    │   │
│  │ IP: 190.191.x.x • Buenos Aires, AR                      │   │
│  │ Última actividad: Ahora                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📱 iPhone de Juan                        [🚪 Cerrar]    │   │
│  │ Safari en iOS                            [Revocar token]│   │
│  │ IP: 190.191.x.x • Buenos Aires, AR                      │   │
│  │ Última actividad: hace 2 horas                          │   │
│  │ Token API: ✅ Activo                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🔌 TOKENS API PERSONALES                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Producción Dashboard      Expira: 30 días    [Revocar] │   │
│  │ Scopes: read:reports, write:moderation                  │   │
│  │ Creado: hace 15 días                                    │   │
│  │ Último uso: hace 2 horas                                │   │
│  │                                                         │   │
│  │ [➕ Crear nuevo token API]                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Features
- **Sesiones detalladas:** Dispositivo, OS, navegador, IP, ubicación aproximada (geoip), última actividad
- **Cierre granular:** Cerrar sesión individual o todas excepto actual
- **Tokens API:** Crear con scopes específicos, rotación, revocación, tracking de uso
- **SSO:** Mostrar método de login (Google Workspace, Azure AD, SAML)
- **Revocación masiva:** Emergencia - revocar todos los tokens y sesiones

#### Schema
```typescript
interface AdminSession {
  id: string;
  device: {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
  };
  ip: string;
  location: {
    city: string;
    country: string;
    coordinates?: [number, number];
  };
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

interface ApiToken {
  id: string;
  name: string;
  scopes: ('read:reports' | 'write:moderation' | 'admin:settings' | 'read:users')[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  lastUsedIp?: string;
}

interface SSOConnection {
  provider: 'google_workspace' | 'azure_ad' | 'saml';
  connectedAt: string;
  email: string;
  canDisconnect: boolean;
}
```

---

### 🔔 2.6 SECCIÓN: Notificaciones (Preferencias Personales)

#### Layout Visual
```
┌─────────────────────────────────────────────────────────────────┐
│ 🔔 PREFERENCIAS DE NOTIFICACIÓN                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📧 EMAIL                                                       │
│  ☑️ Flags críticos (5+ en un reporte)                           │
│  ☑️ Resumen semanal de moderación                               │
│  ☑️ Reportes asignados a mí                                     │
│  ☐ Nuevos usuarios registrados                                  │
│  ☐ Todas las acciones del sistema                               │
│                                                                 │
│  🔔 PUSH / REAL-TIME                                            │
│  ☑️ Alertas de contenido ilegal                                 │
│  ☑️ Sistema bajo ataque/abuso                                   │
│  ☑️ Acciones requieren aprobación urgente                       │
│  ☐ Cualquier reporte nuevo                                      │
│                                                                 │
│  ⏰ HORARIO LABORAL                                             │
│  ☑️ Silenciar notificaciones fuera de horario                   │
│  │  Lunes-Viernes 09:00-18:00 (GMT-3)                          │
│  │  [Configurar horario]                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🎨 2.7 SECCIÓN: Preferencias UI

```
┌─────────────────────────────────────────────────────────────────┐
│ 🎨 PREFERENCIAS DE INTERFAZ                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tema:        [○ Claro  ● Oscuro  ○ Automático]                │
│  Idioma:      [Español ▼]                                       │
│  Densidad:    [○ Compacta  ● Normal  ○ Cómoda]                 │
│                                                                 │
│  Página inicial:                                                │
│  [Dashboard ▼]  (al iniciar sesión)                            │
│                                                                 │
│  Moderación:                                                    │
│  ☑️ Auto-abrir siguiente reporte tras resolver                  │
│  ☑️ Confirmación antes de ban                                  │
│  ☑️ Mostrar contenido sensible con blur                        │
│  ☑️ Mostrar IP de usuarios por defecto                         │
│  ☑️ Modo incógnito (no mostrar mi actividad en logs)           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 📊 2.8 SECCIÓN: Actividad & Auditoría Personal

#### Layout Visual
```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 MI ACTIVIDAD                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📈 ESTADÍSTICAS HOY                                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  12         │ │  3          │ │  2.5h       │              │
│  │ Reportes    │ │ Usuarios    │ │ Promedio    │              │
│  │ moderados   │ │ baneados    │ │ resolución  │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│  Ranking: #3 de 12 moderadores   Precisión: 98.5%             │
│                                                                 │
│  📜 HISTORIAL DE ACCIONES                                      │
│  [Filtro: Todos ▼] [Desde: 01/01/25] [Hasta: Hoy] [📥 Exportar]│
│                                                                 │
│  Hoy 14:30    🚫 BAN          @Usuario123    Robo confirmado   │
│  Hoy 14:15    ✅ RESUELTO     #Reporte-456   Spam              │
│  Hoy 13:45    📝 NOTA         #Reporte-789   Revisar mañana    │
│  ...                                                            │
│                                                                 │
│  [Ver detalle JSON]                                            │
│                                                                 │
│  📅 CALENDARIO DE ACTIVIDAD                                    │
│  [Calendario heatmap tipo GitHub]                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Features
- **Métricas personales:** Reportes moderados, tiempo promedio de resolución, precisión (si hay revisión cruzada), ranking entre moderadores
- **Historial completo:** Con filtros por tipo, fecha, exportar CSV
- **Detalle JSON:** Cada acción tiene payload completo de cambios
- **Calendario heatmap:** Visualización de actividad diaria
- **Score interno:** Nivel de confiabilidad, puntos internos, estado de desempeño
- **Modo investigación:** Marcar todas las acciones como auditadas con notas

#### Schema
```typescript
interface AdminActivity {
  stats: {
    today: {
      moderated: number;
      banned: number;
      avgResolutionTime: string;
    };
    thisWeek: { /* ... */ };
    thisMonth: { /* ... */ };
    allTime: {
      totalModerated: number;
      accuracy: number;
      rank: number;
      of: number;
    };
  };
  recentActions: {
    id: string;
    type: 'ban' | 'resolve' | 'note' | 'settings_change' | 'delete';
    targetType: 'report' | 'comment' | 'user';
    targetId: string;
    targetTitle?: string;
    timestamp: string;
    details: Record<string, any>;
  }[];
  calendar: {
    date: string;
    count: number;
    level: 0 | 1 | 2 | 3 | 4;
  }[];
}
```

---

### 🔌 2.9 SECCIÓN: API & Integraciones

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔌 API TOKENS & INTEGRACIONES                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🔑 TOKENS API PERSONALES                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Nombre: Producción                                       │   │
│  │ Token: sk_live_•••••••••••••••••••••••••••••••••        │   │
│  │ Scopes: read:reports ✓ write:moderation ✓               │   │
│  │ Creado: hace 15 días  Expira: en 15 días                │   │
│  │ Último uso: hace 2 horas desde 190.191.x.x              │   │
│  │ [Rotar] [Revocar]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [➕ Crear nuevo token]                                         │
│                                                                 │
│  🔗 SINGLE SIGN-ON (SSO)                                       │
│  ✅ Google Workspace  conectado como juan@safespot.app        │
│  ☐ Azure AD                                                     │
│  ☐ SAML 2.0                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 🚨 2.10 SECCIÓN: Zona Crítica (Enterprise)

#### Layout Visual
```
┌─────────────────────────────────────────────────────────────────┐
│ 🚨 ZONA CRÍTICA - ACCIONES DESTRUCTIVAS                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ⚠️ Estas acciones son irreversibles. Requieren confirmación.  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🚪 Cerrar todas las sesiones                            │   │
│  │ Cerrar sesión en TODOS los dispositivos excepto este   │   │
│  │                                                         │   │
│  │ [Cerrar todas las sesiones]                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🛑 Desactivar mi cuenta                                 │   │
│  │ Suspender temporalmente mi acceso al panel admin       │   │
│  │ (Puede reactivarse por superadmin)                     │   │
│  │                                                         │   │
│  │ [Desactivar cuenta]                                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🗑️ Solicitar eliminación permanente de cuenta          │   │
│  │ Requiere aprobación de otro superadmin                 │   │
│  │ Se ejecuta soft delete con grace period de 30 días     │   │
│  │                                                         │   │
│  │ [Solicitar eliminación]                                 │   │
│  │ (Debes escribir "ELIMINAR" para confirmar)             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔐 Acciones criptográficas                              │   │
│  │ [🔄 Regenerar claves de firma]                          │   │
│  │ [📋 Rotar todos los tokens API]                         │   │
│  │ [🧹 Limpiar caché de mi cuenta]                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2.11 Componentes Necesarios (Enterprise)

```
src/admin/pages/
├── AdminProfilePage.tsx              # Layout principal con tabs
└── AdminProfilePage.test.tsx         # Tests completos

src/admin/components/profile/
├── tabs/
│   ├── AccountTab.tsx                # Identidad & Cuenta
│   ├── SecurityTab.tsx               # Seguridad Avanzada
│   ├── SessionsTab.tsx               # Sesiones & Tokens
│   ├── NotificationsTab.tsx          # Preferencias de notificación
│   ├── UITab.tsx                     # Preferencias UI
│   ├── ActivityTab.tsx               # Actividad & Auditoría
│   ├── IntegrationsTab.tsx           # API & SSO
│   └── DangerZoneTab.tsx             # Zona Crítica
├── modals/
│   ├── ChangeEmailModal.tsx          # Cambio de email (triple confirm)
│   ├── ChangePasswordModal.tsx       # Cambio de password
│   ├── TwoFactorSetupModal.tsx       # Setup 2FA con QR
│   ├── TwoFactorBackupCodesModal.tsx # Mostrar códigos backup
│   ├── CropAvatarModal.tsx           # Crop de imagen
│   ├── CreateTokenModal.tsx          # Crear token API
│   ├── SessionDetailModal.tsx        # Detalle de sesión
│   └── ConfirmDestructiveModal.tsx   # Confirmación acciones críticas
├── cards/
│   ├── SessionCard.tsx               # Tarjeta de sesión
│   ├── ApiTokenCard.tsx              # Tarjeta de token API
│   ├── ActivityRow.tsx               # Fila de actividad
│   └── SecurityMetricCard.tsx        # Tarjeta de métrica
└── charts/
    ├── ActivityCalendar.tsx          # Heatmap de actividad
    └── ModerationStats.tsx           # Estadísticas de moderación
```

---

### 2.12 Endpoints Backend (Enterprise)

```typescript
// Identidad & Cuenta
GET    /api/admin/profile
PUT    /api/admin/profile
POST   /api/admin/profile/avatar
POST   /api/admin/profile/change-email/init      // Inicia triple confirm
POST   /api/admin/profile/change-email/verify    // Verifica código

// Seguridad
POST   /api/admin/profile/change-password
GET    /api/admin/profile/password-history
POST   /api/admin/profile/2fa/setup
POST   /api/admin/profile/2fa/verify
POST   /api/admin/profile/2fa/disable
GET    /api/admin/profile/2fa/backup-codes
POST   /api/admin/profile/2fa/regenerate-codes
GET    /api/admin/profile/login-attempts
PUT    /api/admin/profile/paranoia-mode

// Sesiones
GET    /api/admin/profile/sessions
DELETE /api/admin/profile/sessions/:id
DELETE /api/admin/profile/sessions/all
GET    /api/admin/profile/tokens
POST   /api/admin/profile/tokens
DELETE /api/admin/profile/tokens/:id

// Notificaciones & UI
PUT    /api/admin/profile/notifications
PUT    /api/admin/profile/ui-preferences

// Actividad
GET    /api/admin/profile/activity
GET    /api/admin/profile/stats
GET    /api/admin/profile/activity/export

// Zona Crítica
POST   /api/admin/profile/deactivate          // Soft disable
POST   /api/admin/profile/request-deletion    // Request delete
DELETE /api/admin/profile                     // Confirm delete
POST   /api/admin/profile/regenerate-keys     // Crypto keys
```

---

### 2.13 Schema de Datos Completo (Enterprise)

```typescript
interface AdminProfileEnterprise {
  // 1. Identidad
  identity: AdminIdentity;
  
  // 2. Seguridad
  security: AdminSecurity;
  
  // 3. Sesiones
  sessions: {
    active: AdminSession[];
    tokens: ApiToken[];
    sso: SSOConnection[];
  };
  
  // 4. Preferencias
  preferences: {
    notifications: NotificationPreferences;
    ui: UIPreferences;
  };
  
  // 5. Actividad
  activity: AdminActivity;
}

// (Las interfaces detalladas están en las secciones anteriores)
```

---

### 2.14 UX Consideraciones Enterprise

1. **Navegación por Tabs:** 8 secciones organizadas en tabs verticales u horizontales
2. **Confirmaciones Escalonadas:** Acciones críticas requieren múltiples confirmaciones
3. **Modo Incógnito:** Toggle para no registrar actividad en logs públicos
4. **Time-based UI:** Silenciar notificaciones fuera de horario laboral
5. **Audit Trail:** Cada acción del propio admin se registra para compliance
6. **Export GDPR:** Botón para exportar todos los datos personales

### 2.5 Endpoints Backend Requeridos

```javascript
// GET /api/admin/profile
// Obtiene perfil del admin actual
Response: { success: true, data: AdminProfile }

// PUT /api/admin/profile
// Actualiza datos básicos (alias, email)
Body: { alias?: string; email?: string }
Response: { success: true, data: AdminProfile }

// POST /api/admin/profile/avatar
// Subir nueva foto de perfil
Body: FormData (image file)
Response: { success: true, avatarUrl: string }

// POST /api/admin/profile/change-password
// Cambiar contraseña
Body: { currentPassword: string; newPassword: string }
Response: { success: true }

// GET /api/admin/profile/2fa/setup
// Iniciar configuración 2FA (genera QR)
Response: { success: true, qrCode: string; secret: string }

// POST /api/admin/profile/2fa/verify
// Verificar código y activar 2FA
Body: { code: string; secret: string }
Response: { success: true }

// POST /api/admin/profile/2fa/disable
// Desactivar 2FA (requiere código)
Body: { code: string; password: string }
Response: { success: true }

// GET /api/admin/profile/sessions
// Listar sesiones activas
Response: { success: true, data: Session[] }

// DELETE /api/admin/profile/sessions/:id
// Cerrar sesión específica
Response: { success: true }

// DELETE /api/admin/profile/sessions/all
// Cerrar todas las sesiones excepto actual
Response: { success: true }

// GET /api/admin/profile/activity
// Historial de acciones del admin
Query: { page?: number; limit?: number }
Response: { success: true, data: ActivityLog[] }

// DELETE /api/admin/profile
// Solicitar eliminación de cuenta
Body: { reason: string; password: string }
Response: { success: true, message: "Request submitted" }
```

### 2.6 Hooks Personalizados

```typescript
// src/admin/hooks/useAdminProfile.ts
export const useAdminProfile = () => {
  return useQuery<AdminProfile>({
    queryKey: ['admin', 'profile'],
    queryFn: fetchAdminProfile,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
};

export const useUpdateProfile = () => {
  return useMutation({
    mutationFn: updateAdminProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'profile'] });
      toast.success('Perfil actualizado');
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: changePassword,
    onSuccess: () => toast.success('Contraseña cambiada'),
    onError: (err) => toast.error(err.message),
  });
};

export const useTwoFactor = () => {
  const setup = useMutation({ mutationFn: setup2FA });
  const verify = useMutation({ mutationFn: verify2FA });
  const disable = useMutation({ mutationFn: disable2FA });
  return { setup, verify, disable };
};

export const useSessions = () => {
  return useQuery({
    queryKey: ['admin', 'sessions'],
    queryFn: fetchSessions,
  });
};
```

### 2.15 UX Consideraciones Enterprise

#### Navegación
- **Tabs persistentes:** Navegación por 8 secciones con estado guardado
- **Breadcrumbs:** Indicador de ubicación dentro de configuración
- **Acceso rápido:** Atajos de teclado para cada sección (Ctrl+1..8)

#### Seguridad UX
- **Niveles de confirmación:**
  - Cambios normales: Guardar automático o botón simple
  - Cambios importantes: Modal de confirmación
  - Acciones destructivas: Confirmación con texto escrito
  - Acciones críticas: Re-autenticación + 2FA
- **Indicadores visuales:** 
  - Shield verde: Configuración segura
  - Warning amarillo: Requiere atención (2FA pendiente)
  - Alerta roja: Riesgo de seguridad detectado

#### Feedback
- **Toast notifications:** Éxito/error de operaciones
- **Estados de carga:** Skeletons específicos por sección
- **Progreso:** Indicadores de completitud (perfil 80% completo)

#### Modo Incógnito
- **Toggle visible:** Switch en header para activar modo investigación
- **Indicador sutil:** Avatar con borde gris cuando está activo
- **Explicación:** Tooltip explicando que acciones no aparecen en logs públicos

#### Responsive
- **Mobile:** Tabs se convierten en dropdown, cards apiladas
- **Tablet:** Layout 2 columnas para secciones con muchos campos
- **Desktop:** Layout óptimo con sidebar de navegación

#### Accesibilidad
- **ARIA labels:** Todos los controles identificables
- **Contraste:** Ratio mínimo 4.5:1 en todos los textos
- **Navegación por teclado:** Tab order lógico, atajos definidos

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### 3.1 Actualizar AdminApp.tsx

```typescript
// Agregar imports
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AdminProfilePage = lazy(() => import('./pages/AdminProfilePage').then(m => ({ default: m.AdminProfilePage })))

// Agregar rutas
<Route path="settings" element={<SettingsPage />} />
<Route path="profile" element={<AdminProfilePage />} />
```

### 3.2 Backend Routes Necesarios (server/src/routes/admin/)

Archivos a crear:
- `adminSettings.js` - CRUD de configuración
- `adminProfile.js` - Perfil, 2FA, sesiones
- `adminMaintenance.js` - Acciones de mantenimiento

### 3.3 Tablas de DB Potencialmente Necesarias

#### Para /admin/settings
```sql
-- Tabla de configuración del sistema
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id)
);
```

#### Para /admin/profile (Enterprise)
```sql
-- Tabla de sesiones de admin (extendida)
CREATE TABLE admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    device_info JSONB, -- {type, os, browser, userAgent}
    ip_address INET,
    location JSONB, -- {city, country, coordinates}
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    revoked_at TIMESTAMP
);

-- Tabla de tokens API personales
CREATE TABLE admin_api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    scopes TEXT[], -- ['read:reports', 'write:moderation']
    last_used_at TIMESTAMP,
    last_used_ip INET,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- Tabla de historial de contraseñas
CREATE TABLE admin_password_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW(),
    reason VARCHAR(100) -- 'user_initiated', 'expired', 'breach_detected'
);

-- Tabla de intentos de login
CREATE TABLE admin_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    device_fingerprint VARCHAR(255),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    failure_reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de backup codes 2FA
CREATE TABLE admin_2fa_backup_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de preferencias de admin
CREATE TABLE admin_preferences (
    admin_id UUID PRIMARY KEY REFERENCES admin_users(id) ON DELETE CASCADE,
    notifications JSONB DEFAULT '{}',
    ui JSONB DEFAULT '{}',
    moderation JSONB DEFAULT '{}',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de auditoría personal (acciones del admin sobre el sistema)
CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL, -- 'report_moderated', 'user_banned', 'settings_changed'
    entity_type VARCHAR(50), -- 'report', 'user', 'comment', 'settings'
    entity_id UUID,
    payload JSONB, -- Detalles de la acción
    metadata JSONB, -- IP, user agent, etc.
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de export requests (GDPR)
CREATE TABLE admin_data_export_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, ready, expired
    file_url VARCHAR(500),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Tabla de account deletion requests
CREATE TABLE admin_deletion_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected, executed
    requested_at TIMESTAMP DEFAULT NOW(),
    approved_by UUID REFERENCES admin_users(id),
    approved_at TIMESTAMP,
    executed_at TIMESTAMP,
    grace_period_ends_at TIMESTAMP
);

-- Tabla de alias history
CREATE TABLE admin_alias_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    alias VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de SSO connections
CREATE TABLE admin_sso_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google_workspace', 'azure_ad', 'saml'
    provider_user_id VARCHAR(255),
    email VARCHAR(255),
    connected_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Índices recomendados
CREATE INDEX idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX idx_admin_api_tokens_admin_id ON admin_api_tokens(admin_id);
CREATE INDEX idx_admin_login_attempts_admin_id ON admin_login_attempts(admin_id);
CREATE INDEX idx_admin_login_attempts_ip ON admin_login_attempts(ip_address);
CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_created ON admin_audit_log(created_at);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
```

---

## 📊 PRIORIDAD Y ESFUERZO (Actualizado)

| Página | Prioridad | Esfuerzo Estimado | Complejidad | Tablas DB |
|--------|-----------|-------------------|-------------|-----------|
| `/admin/settings` | 🟡 Media | 3-4 días | Media-Alta | 1 (system_settings) |
| `/admin/profile` | 🔴 Alta | 5-7 días | Alta | 4+ (profile, sessions, tokens, audit) |

### Cambio de Scope

La página `/admin/profile` ha sido redefinida de **CRUD básico** a **Enterprise Profile Center**:

| Aspecto | Estimación Original | Estimación Enterprise |
|---------|--------------------|----------------------|
| Secciones | 4 | 8 |
| Componentes | ~10 | ~25 |
| Endpoints | ~8 | ~25+ |
| Tablas DB | 1 | 4+ |
| Días estimados | 1-2 | 5-7 |

### Recomendación de Implementación (Fases)

#### Fase 1: Core Identity (Día 1-2)
- [ ] Tab "Cuenta" - Alias, email, avatar
- [ ] Tab "Seguridad" - Password, 2FA TOTP básico
- [ ] Backend: Endpoints básicos de perfil

#### Fase 2: Sessions & Security (Día 3-4)
- [ ] Tab "Sesiones" - Listado y cierre
- [ ] Tab "Notificaciones" - Preferencias
- [ ] 2FA completo con backup codes
- [ ] Backend: Gestión de sesiones

#### Fase 3: Activity & Audit (Día 5-6)
- [ ] Tab "Actividad" - Historial y métricas
- [ ] Heatmap de actividad
- [ ] Export de datos
- [ ] Backend: Auditoría personal

#### Fase 4: Enterprise Features (Día 7-8)
- [ ] Tab "API & Integraciones" - Tokens, SSO
- [ ] Tab "Zona Crítica" - Acciones destructivas
- [ ] Modo paranoia, incógnito
- [ ] Backend: Tokens API, GDPR export

---

## ⚠️ NOTAS IMPORTANTES

1. **Settings vs Profile:** 
   - Settings = Configuración GLOBAL de la plataforma (afecta a todos)
   - Profile = Configuración PERSONAL del admin (afecta solo a él)

2. **Permisos:**
   - Settings debería requerir `superadmin`
   - Profile debería ser accesible por cualquier `admin`

3. **Validación:**
   - Settings necesita validación estricta de rangos
   - Profile necesita validación de email único

4. **Caché:**
   - Settings debería cachearse en Redis
   - Profile puede cachearse en React Query

---

**Fin de la Especificación**

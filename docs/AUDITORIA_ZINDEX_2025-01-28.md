# 🔴 AUDITORÍA CRÍTICA: Z-INDEX Y ESTRUCTURAS VISUALES

**Fecha:** 2025-01-28  
**Auditor:** Staff Engineer  
**Estado:** EN PROGRESO

---

## 📊 RESUMEN EJECUTIVO

### Nivel de Riesgo Estructural: **65/100** 🟠

**¿Apto para producción?** ⚠️ **CONDICIONAL**

**Hallazgo principal:** Los cambios previos se perdieron parcialmente. El sistema `z-index.ts` existe y algunos componentes lo usan, pero hay muchos valores arbitrarios dispersos.

---

## 🚨 HALLAZGOS CRÍTICOS

### 1. Valores Z-Index Arbitrarios Encontrados

```
❌ z-[9999]     → src/components/ui/PromptModal.tsx
❌ z-[1000]     → src/pages/Explorar.tsx (2 veces)
❌ z-[100]      → src/layouts/MapLayout.tsx
❌ z-[100]      → src/index.css (skip-link)
❌ z-[401]      → src/admin/pages/AdminDashboard.tsx
❌ z-50         → Múltiples archivos (15+ ocurrencias)
❌ zIndex: 9999 → src/admin/pages/UsersPage.tsx (confetti)
```

### 2. Componentes Que YA Usan el Sistema (✅ OK)

- `src/config/z-index.ts` - Sistema base
- `src/components/layout/Header.tsx` - Drawer con Portal
- `src/components/ui/toast/ToastContainer.tsx`
- `src/components/ui/ConfirmationModal.tsx`
- `src/components/ui/bottom-sheet.tsx`
- `src/components/ui/BaseModal.tsx`
- `src/components/ui/AliasEditModal.tsx`
- `src/admin/layouts/AdminLayout.tsx`
- `src/admin/components/ui/Modal.tsx`
- `src/admin/components/profile/SessionsModal.tsx`
- `src/admin/components/profile/AvatarUploadModal.tsx`
- `src/admin/pages/TasksPage.tsx`

### 3. Componentes Que NECESITAN Corrección (🔴)

| Archivo | Problema | Severidad |
|---------|----------|-----------|
| `src/components/ui/PromptModal.tsx` | `z-[9999]` | 🔴 Crítico |
| `src/components/ui/dropdown-menu.tsx` | `z-50`, `z-[100]` | 🟠 Alto |
| `src/components/ui/tooltip.tsx` | `z-50` | 🟡 Medio |
| `src/components/ui/rich-text-editor.tsx` | `z-50` | 🟡 Medio |
| `src/layouts/MapLayout.tsx` | `z-[100]` | 🟠 Alto |
| `src/pages/Explorar.tsx` | `z-[1000]` (2x) | 🟠 Alto |
| `src/pages/Mensajes.tsx` | `z-50`, `z-[60]` | 🟠 Alto |
| `src/pages/NotificationsPage.tsx` | `z-50` | 🟡 Medio |
| `src/admin/pages/ModerationPage.tsx` | `z-50` | 🟡 Medio |
| `src/admin/pages/AdminDashboard.tsx` | `z-[401]` | 🟡 Medio |
| `src/components/ShareButton.tsx` | `z-40`, `z-50` | 🟡 Medio |
| `src/components/ui/points-feedback.tsx` | `z-50` (2x) | 🟡 Medio |
| `src/components/ui/PullToRefresh.tsx` | `z-50` | 🔵 Bajo |
| `src/hooks/useConfetti.ts` | `zIndex: 10000` | 🟠 Alto |

### 4. Problemas Específicos por Categoría

#### 🔴 Modales sin Portal o con Z-Index Arbitrario

1. **PromptModal.tsx** - `z-[9999]`
2. **rich-text-editor.tsx** - Modal de link con `z-50`

#### 🟠 Dropdowns y Menús

1. **dropdown-menu.tsx** - `z-50` y `z-[100]` hardcodeados
2. **ShareButton.tsx** - Dropdown con `z-50`

#### 🟠 Layouts con Z-Index Problemáticos

1. **MapLayout.tsx** - `z-[100]` fijo
2. **Mensajes.tsx** - `z-50` y `z-[60]` en layout

#### 🟡 Componentes Misc

1. **tooltip.tsx** - `z-50`
2. **points-feedback.tsx** - `z-50` (animaciones)
3. **useConfetti.ts** - `zIndex: 10000`

---

## 📋 TABLA DE BUGS ESTRUCTURALES

| Severidad | Archivo | Componente | Problema | Causa | Solución |
|-----------|---------|------------|----------|-------|----------|
| 🔴 | PromptModal.tsx | Modal | `z-[9999]` | Valor arbitrario | Usar `Z_INDEX.MODAL` |
| 🔴 | MapLayout.tsx | Layout | `z-[100]` | Valor arbitrario | Usar `Z_INDEX.HEADER` o sistema |
| 🟠 | dropdown-menu.tsx | Dropdown | `z-50`, `z-[100]` | Hardcodeado | Usar `Z_INDEX.DROPDOWN` |
| 🟠 | Explorar.tsx | Mapa | `z-[1000]` | Valor arbitrario | Usar `Z_INDEX` apropiado |
| 🟠 | useConfetti.ts | Confetti | `zIndex: 10000` | Valor extremo | Usar `Z_INDEX.MAX` o sistema |
| 🟡 | tooltip.tsx | Tooltip | `z-50` | Hardcodeado | Usar `Z_INDEX.TOOLTIP` |
| 🟡 | rich-text-editor.tsx | Modal Link | `z-50` | Hardcodeado | Usar `Z_INDEX.MODAL` |
| 🟡 | Mensajes.tsx | Layout | `z-50`, `z-[60]` | Valores arbitrarios | Revisar necesidad |
| 🟡 | ShareButton.tsx | Dropdown | `z-50` | Hardcodeado | Usar `Z_INDEX.DROPDOWN` |
| 🔵 | PullToRefresh.tsx | Indicador | `z-50` | Hardcodeado | Mantener o bajar a `z-20` |

---

## 🔧 RECOMENDACIÓN ESTRUCTURAL GLOBAL

### Sistema Z-Index Actual (Ya Implementado Parcialmente)

```typescript
// src/config/z-index.ts
export const Z_INDEX = {
  // Base Layer (0-10)
  BASE: 0,
  CONTENT: 1,
  
  // Navigation Layer (10-20)
  HEADER: 10,
  BOTTOM_NAV: 10,  // ← Header actualizado, BottomNav NO
  SIDEBAR: 15,
  DRAWER_BACKDROP: 18,
  DRAWER_CONTENT: 19,
  
  // Component Layer (20-30)
  DROPDOWN: 20,    // ← NO implementado en dropdown-menu.tsx
  TOOLTIP: 25,     // ← NO implementado en tooltip.tsx
  POPOVER: 25,
  
  // Modal Layer (30-40)
  MODAL_BACKDROP: 30,
  MODAL_CONTENT: 35,
  
  // Sheet Layer (40-50)
  SHEET_BACKDROP: 40,
  SHEET_CONTENT: 45,
  
  // System Layer (50-60)
  TOAST: 50,       // ← OK implementado
  NOTIFICATION: 55,
  NETWORK_STATUS: 58,
  
  // Dialog Layer (60-70)
  CONFIRMATION_BACKDROP: 60,
  CONFIRMATION_CONTENT: 65,
  
  // Emergency Layer (70-80)
  EMERGENCY_BACKDROP: 70,
  EMERGENCY_CONTENT: 75,
  
  // Max Layer (80-90)
  MAX: 90,
};
```

---

## 🎯 PLAN DE CORRECCIÓN POR FASES

### 🔴 FASE 1: Correcciones Críticas (30 min)

1. **PromptModal.tsx** - Cambiar `z-[9999]` → `Z_INDEX.MODAL`
2. **MapLayout.tsx** - Cambiar `z-[100]` → `Z_INDEX.HEADER`
3. **BottomNav.tsx** - Cambiar `z-index: 25` → `Z_INDEX.BOTTOM_NAV`

### 🟠 FASE 2: Dropdowns y Tooltips (30 min)

1. **dropdown-menu.tsx** - Usar `Z_INDEX.DROPDOWN`
2. **tooltip.tsx** - Usar `Z_INDEX.TOOLTIP`
3. **ShareButton.tsx** - Usar `Z_INDEX.DROPDOWN`

### 🟡 FASE 3: Modales y Componentes Misc (45 min)

1. **rich-text-editor.tsx** - Usar `Z_INDEX.MODAL`
2. **useConfetti.ts** - Usar `Z_INDEX.MAX`
3. **points-feedback.tsx** - Revisar necesidad de z-index alto
4. **Mensajes.tsx** - Revisar layout fijo

### 🟡 FASE 4: Limpieza de Headers y Misc (30 min)

1. **NotificationsPage.tsx** - Quitar z-index innecesario
2. **AdminDashboard.tsx** - Cambiar `z-[401]`
3. **ModerationPage.tsx** - Cambiar `z-50`

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] PromptModal usa sistema z-index
- [ ] MapLayout usa sistema z-index
- [ ] BottomNav usa sistema z-index
- [ ] DropdownMenu usa sistema z-index
- [ ] Tooltip usa sistema z-index
- [ ] RichTextEditor modal usa sistema
- [ ] useConfetti usa sistema z-index
- [ ] Mensajes layout revisado
- [ ] TypeScript compila sin errores
- [ ] Drawer funciona correctamente
- [ ] Modales aparecen sobre todo
- [ ] Dropdowns no quedan cortados

---

**Nota:** El sistema base (`src/config/z-index.ts`) y los hooks (`useScrollLock`, `useKeyPress`) están intactos. Solo hay que aplicarlos consistentemente.

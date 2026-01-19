# 🤝 Contributing to SafeSpot

Gracias por tu interés en contribuir a SafeSpot. Este documento establece las pautas y procesos para mantener la calidad y seguridad del código.

---

## 📋 Code Review Checklist

Toda Pull Request DEBE pasar este checklist antes de ser mergeada:

### 🔒 Security & Auth Guards

- [ ] **¿Esta PR agrega una nueva mutation?**
  - Si SÍ → Verificar que importa `useAuthGuard`
  - Si SÍ → Verificar que llama `checkAuth()` en `mutationFn`
  - Si SÍ → Verificar que lanza error `'AUTH_REQUIRED'`

- [ ] **¿Hay llamadas directas a API desde componentes UI?**
  - ❌ PROHIBIDO: `await reportsApi.create()` en `/components` o `/pages`
  - ✅ PERMITIDO: Solo en hooks `/hooks/queries` con guard

- [ ] **¿Se modificó el sistema de Auth Guards?**
  - Si SÍ → Requiere aprobación de Principal Architect
  - Si SÍ → Actualizar `README_AUTH_GUARDS.md`

### 🧪 Testing

- [ ] **Build pasa sin errores**
  - `npm run build` → Exit code 0
  
- [ ] **Linter pasa sin warnings críticos**
  - `npm run lint` → No errors

- [ ] **TypeScript compila correctamente**
  - No type errors
  - No `as any` innecesarios

### 📝 Documentación

- [ ] **Cambios documentados**
  - README actualizado si aplica
  - JSDoc agregado en funciones públicas

---

## 🚨 Reglas Críticas (NUNCA ROMPER)

### 1. Auth Guards Obligatorios

**REGLA**: Toda mutation que escriba datos DEBE usar `useAuthGuard()`

**Verificación**:
```typescript
// ✅ CORRECTO
const { checkAuth } = useAuthGuard();
return useMutation({
    mutationFn: async (data) => {
        if (!checkAuth()) throw new Error('AUTH_REQUIRED');
        return api.write(data);
    }
});
```

### 2. No Direct API Calls

**REGLA**: Componentes UI NO pueden importar de `@/lib/api`

**Verificación**:
```typescript
// ❌ PROHIBIDO en /components o /pages
import { reportsApi } from '@/lib/api';

// ✅ CORRECTO
import { useCreateReportMutation } from '@/hooks/queries/useReportsQuery';
```

### 3. Single Source of Truth

**REGLA**: No duplicar lógica de auth. Usar `permissions.ts`

**Verificación**:
- No leer `localStorage.getItem('token')` directamente
- No implementar guards locales
- Confiar en `isAuthenticated()` de `permissions.ts`

---

## 🔍 Pre-Commit Checklist

Antes de hacer commit:

```bash
# 1. Verificar build
npm run build

# 2. Verificar linter
npm run lint

# 3. Verificar types
npm run type-check  # si existe
```

---

## 🎯 Proceso de PR

### 1. Crear Branch

```bash
git checkout -b feature/nombre-descriptivo
```

### 2. Hacer Cambios

- Seguir convenciones de código existentes
- Agregar tests si aplica
- Documentar cambios complejos

### 3. Commit

```bash
git commit -m "feat: descripción clara del cambio"
```

Formato de mensajes:
- `feat:` - Nueva feature
- `fix:` - Bug fix
- `docs:` - Cambios en documentación
- `refactor:` - Refactor sin cambio de funcionalidad
- `security:` - Fix de seguridad

### 4. Push y Crear PR

```bash
git push origin feature/nombre-descriptivo
```

### 5. Completar Checklist en PR

Copiar y completar el checklist de arriba en la descripción de la PR.

---

## 🚫 Antipatterns Comunes

### ❌ Mutation sin Guard

```typescript
// ❌ MAL
useMutation({
    mutationFn: (data) => api.create(data)  // Sin checkAuth()
});
```

### ❌ Direct API Call

```typescript
// ❌ MAL - en componente UI
const handleClick = () => {
    reportsApi.create({ title: 'Test' });
};
```

### ❌ Auth Check Manual

```typescript
// ❌ MAL - duplicando lógica
const token = localStorage.getItem('token');
if (token) {
    // custom logic
}
```

---

## ✅ Patrones Recomendados

### ✅ Mutation con Guard

```typescript
// ✅ BIEN
const { checkAuth } = useAuthGuard();
useMutation({
    mutationFn: async (data) => {
        if (!checkAuth()) throw new Error('AUTH_REQUIRED');
        return api.create(data);
    }
});
```

### ✅ UI con Hook

```typescript
// ✅ BIEN
const createReport = useCreateReportMutation();
const handleClick = () => {
    createReport.mutate({ title: 'Test' });
};
```

---

## 📚 Recursos

- **Auth Guards**: Ver `README_AUTH_GUARDS.md`
- **Arquitectura**: Ver `docs/ARCHITECTURE.md` (si existe)
- **ESLint Config**: Ver `.eslintrc.js`

---

## 🆘 Ayuda

Si tenés dudas:

1. Revisá la documentación
2. Mirá PRs anteriores aprobadas
3. Consultá con el equipo antes de implementar

---

**Recordatorio**: La seguridad y consistencia son prioridad. Mejor preguntar que mergear código inseguro.

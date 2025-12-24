# Resumen de Unificación de Acceso a Base de Datos

## Problema Identificado

El proyecto mezclaba dos enfoques para acceder a la base de datos:
1. **`queryWithRLS`**: SQL raw con conexión directa, puede establecer `app.anonymous_id` para RLS
2. **`supabase.from()`**: Cliente HTTP/REST, NO puede establecer `app.anonymous_id`

**Impacto crítico**: Las políticas RLS que dependen de `current_anonymous_id()` no funcionan correctamente cuando se usa `supabase.from()` para operaciones que modifican datos.

## Estrategia Implementada

### Regla Fundamental
- **Operaciones que modifican datos (INSERT/UPDATE/DELETE)**: DEBEN usar `queryWithRLS`
- **Operaciones de solo lectura públicas**: PUEDEN usar `supabase.from()` (donde RLS permite NULL)

### Cambios Realizados

#### 1. `server/src/routes/reports.js` ✅ COMPLETADO
- ✅ POST `/api/reports` - Migrado a `queryWithRLS` para INSERT
- ✅ PATCH `/api/reports/:id` - Migrado a `queryWithRLS` para UPDATE
- ✅ POST `/api/reports/:id/favorite` - Migrado a `queryWithRLS` para INSERT/DELETE
- ✅ POST `/api/reports/:id/flag` - Migrado a `queryWithRLS` para INSERT
- ✅ GET endpoints - Mantienen `supabase.from()` (operaciones públicas de lectura)

#### 2. Helper Unificado: `server/src/utils/db.js` ✅ CREADO
- Proporciona API consistente que internamente usa `queryWithRLS`
- Clase `DB` con métodos `withContext()` y `public()`
- Listo para uso futuro en otros módulos

#### 3. Documentación ✅ CREADA
- `server/DATABASE_ACCESS_STRATEGY.md` - Estrategia completa
- `server/RLS_UNIFICATION_SUMMARY.md` - Este documento

## Estado de Otros Módulos

### `server/src/routes/comments.js`
- **Estado**: Usa `supabase.from()` para INSERT/UPDATE/DELETE
- **Acción requerida**: Migrar a `queryWithRLS` para operaciones que modifican datos

### `server/src/routes/votes.js`
- **Estado**: Usa `supabase.from()` para INSERT/DELETE
- **Acción requerida**: Migrar a `queryWithRLS` para operaciones que modifican datos

### `server/src/routes/favorites.js`
- **Estado**: Solo tiene GET (lectura pública)
- **Acción requerida**: Ninguna (ya usa `supabase.from()` correctamente)

### `server/src/routes/users.js`
- **Estado**: Mezcla `queryWithRLS` y `supabase.from()`
- **Acción requerida**: Revisar y unificar (ya usa `queryWithRLS` para operaciones con ownership)

## Beneficios de la Unificación

1. **Seguridad**: RLS funciona consistentemente en todas las operaciones
2. **Mantenibilidad**: Un solo enfoque claro para acceso a datos
3. **Auditabilidad**: Fácil verificar que todas las operaciones respetan RLS
4. **Predecibilidad**: Comportamiento consistente en todos los endpoints

## Próximos Pasos

1. Migrar `comments.js` a `queryWithRLS` para INSERT/UPDATE/DELETE
2. Migrar `votes.js` a `queryWithRLS` para INSERT/DELETE
3. Revisar y documentar cualquier excepción justificada
4. Agregar tests para verificar que RLS funciona correctamente

## Verificación

Para verificar que la unificación funciona:
1. Todas las operaciones INSERT/UPDATE/DELETE usan `queryWithRLS`
2. Las políticas RLS funcionan correctamente
3. No hay bypass accidental de seguridad
4. El código es más predecible y mantenible


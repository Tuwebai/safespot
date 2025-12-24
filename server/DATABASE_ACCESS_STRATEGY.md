# Estrategia de Acceso a Base de Datos

## Problema

El proyecto mezcla dos enfoques para acceder a la base de datos:
1. **`queryWithRLS`**: SQL raw con conexión directa a PostgreSQL, puede establecer `app.anonymous_id` para RLS
2. **`supabase.from()`**: Cliente HTTP/REST de Supabase, NO puede establecer `app.anonymous_id`

## Impacto en RLS

Las políticas RLS dependen de `current_anonymous_id()` que lee `app.anonymous_id` de la sesión PostgreSQL:

```sql
CREATE OR REPLACE FUNCTION current_anonymous_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.anonymous_id', TRUE), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;
```

**Problema crítico**: `supabase.from()` usa HTTP/REST y NO puede ejecutar `SET LOCAL app.anonymous_id`, por lo que las políticas que requieren `current_anonymous_id()` no funcionan correctamente.

## Estrategia Unificada

### Regla 1: Operaciones que REQUIEREN contexto RLS
**DEBEN usar `queryWithRLS`**:
- ✅ INSERT (aunque la política permita NULL, es más seguro con contexto)
- ✅ UPDATE (requiere verificación de ownership)
- ✅ DELETE (requiere verificación de ownership)
- ✅ SELECT cuando la política depende de `current_anonymous_id()`

### Regla 2: Operaciones públicas (RLS permite NULL)
**PUEDEN usar `supabase.from()`**:
- ✅ SELECT público (política `USING (true)`)
- ✅ Estadísticas públicas
- ✅ Operaciones de solo lectura sin filtros de ownership

### Regla 3: Operaciones de Storage
**DEBEN usar `supabaseAdmin`**:
- ✅ Subida de archivos a Supabase Storage
- ✅ Operaciones que requieren bypass de RLS

## Implementación

### Helper Unificado: `server/src/utils/db.js`

Proporciona una API consistente que internamente usa `queryWithRLS` cuando se necesita contexto RLS:

```javascript
import { DB } from '../utils/db.js';

// Operación con contexto RLS
const db = DB.withContext(anonymousId);
const report = await db.insert('reports', reportData);
const updated = await db.update('reports', updateData, { id, anonymous_id: anonymousId });

// Operación pública (sin contexto RLS)
const publicDb = DB.public();
const reports = await publicDb.select('reports', { where: { status: 'pendiente' } });
```

### Migración de Endpoints

1. **reports.js**: Migrar INSERT/UPDATE/DELETE a `DB.withContext()`
2. **comments.js**: Migrar INSERT/UPDATE/DELETE a `DB.withContext()`
3. **votes.js**: Migrar INSERT/DELETE a `DB.withContext()`
4. **users.js**: Migrar queries con ownership a `DB.withContext()`
5. **favorites.js**: Migrar INSERT/DELETE a `DB.withContext()`

## Verificación

Después de la migración, verificar que:
- ✅ No hay mezcla de métodos dentro del mismo módulo
- ✅ Todas las operaciones que modifican datos usan `DB.withContext()`
- ✅ Las políticas RLS funcionan correctamente
- ✅ No hay bypass accidental de RLS

## Excepciones

**NO hay excepciones**. Si una operación requiere contexto RLS, DEBE usar `queryWithRLS` o `DB.withContext()`.


# Supabase RLS Audit & Fix

> **Fecha:** 2026-01-29  
> **Proyecto:** SafeSpot  
> **Autor:** Database Security Engineer  

---

## Tabla: public.spatial_ref_sys

- **Clasificación:** Tipo A – Tabla de Sistema / Extensión (PostGIS)
- **Decisión:** NO habilitar RLS directamente. Revocar acceso público y mantener solo para `service_role`.
- **SQL aplicado:**

```sql
-- Revocar acceso a roles públicos
REVOKE ALL ON public.spatial_ref_sys FROM anon, authenticated;
GRANT SELECT ON public.spatial_ref_sys TO service_role;
```

- **Justificación de seguridad:**
  - `spatial_ref_sys` es una tabla de sistema de PostGIS con definiciones de SRID públicas
  - No contiene datos sensibles de la aplicación
  - Habilitar RLS requiere superuser (owner es `supabase_admin`)
  - Revocar acceso a `anon`/`authenticated` elimina la exposición vía API REST
  - `service_role` mantiene acceso para operaciones del backend con PostGIS

---

## Tabla: public.followers

- **Clasificación:** Tipo B – Tabla User-Facing (Sistema de Seguimiento)
- **Decisión:** Habilitar RLS con políticas de ownership
- **SQL aplicado:**

```sql
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

-- Lectura pública (conteos de seguidores en perfiles)
DROP POLICY IF EXISTS followers_select ON public.followers;
CREATE POLICY followers_select ON public.followers
    FOR SELECT USING (true);

-- Solo el usuario puede crear follows donde él es follower
DROP POLICY IF EXISTS followers_insert ON public.followers;
CREATE POLICY followers_insert ON public.followers
    FOR INSERT WITH CHECK (follower_id = current_anonymous_id());

-- Solo el usuario puede eliminar sus propios follows
DROP POLICY IF EXISTS followers_delete ON public.followers;
CREATE POLICY followers_delete ON public.followers
    FOR DELETE USING (follower_id = current_anonymous_id());
```

- **Justificación de seguridad:**
  - SELECT público permite mostrar conteo de seguidores en perfiles públicos
  - INSERT restringido previene que alguien fuerce un follow en nombre de otro usuario
  - DELETE restringido previene que alguien elimine follows de otros
  - No hay UPDATE porque la relación follower-following es inmutable

---

## Tabla: public.zone_safety_scores

- **Clasificación:** Tipo B – Tabla de Cache/Datos Derivados (SafeScore por Zona)
- **Decisión:** Habilitar RLS. Lectura pública, escritura solo backend.
- **SQL aplicado:**

```sql
ALTER TABLE public.zone_safety_scores ENABLE ROW LEVEL SECURITY;

-- Lectura pública (SafeScores son información pública de zonas)
DROP POLICY IF EXISTS zone_safety_scores_select ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_select ON public.zone_safety_scores
    FOR SELECT USING (true);

-- Bloquear INSERT para anon/authenticated (solo backend)
DROP POLICY IF EXISTS zone_safety_scores_insert ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_insert ON public.zone_safety_scores
    FOR INSERT WITH CHECK (false);

-- Bloquear UPDATE
DROP POLICY IF EXISTS zone_safety_scores_update ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_update ON public.zone_safety_scores
    FOR UPDATE USING (false) WITH CHECK (false);

-- Bloquear DELETE
DROP POLICY IF EXISTS zone_safety_scores_delete ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_delete ON public.zone_safety_scores
    FOR DELETE USING (false);
```

- **Justificación de seguridad:**
  - SELECT público porque los SafeScores son datos públicos de zonas geográficas
  - INSERT/UPDATE/DELETE bloqueados previenen manipulación maliciosa de scores
  - El backend usa `service_role` que bypasea RLS, permitiendo escribir

---

## Tabla: public.starred_messages

- **Clasificación:** Tipo B – Tabla User-Facing (Mensajes Destacados)
- **Decisión:** Habilitar RLS con políticas de ownership estrictas.
- **SQL aplicado:**

```sql
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;

-- Solo el usuario puede ver sus propios destacados
DROP POLICY IF EXISTS starred_messages_select ON public.starred_messages;
CREATE POLICY starred_messages_select ON public.starred_messages
    FOR SELECT USING (user_id = current_anonymous_id());

-- Solo el usuario puede destacar mensajes como él mismo
DROP POLICY IF EXISTS starred_messages_insert ON public.starred_messages;
CREATE POLICY starred_messages_insert ON public.starred_messages
    FOR INSERT WITH CHECK (user_id = current_anonymous_id());

-- Solo el usuario puede quitar sus propios destacados
DROP POLICY IF EXISTS starred_messages_delete ON public.starred_messages;
CREATE POLICY starred_messages_delete ON public.starred_messages
    FOR DELETE USING (user_id = current_anonymous_id());
```

- **Justificación de seguridad:**
  - SELECT restringido porque los destacados son preferencias privadas del usuario
  - INSERT con validación de ownership previene destacar en nombre de otro
  - DELETE restringido previene remover destacados ajenos
  - No hay UPDATE porque los destacados no se modifican, se recrean

---

## Script SQL Completo

```sql
-- ============================================
-- SAFESPOT RLS FIX - COMPLETE SCRIPT
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. SPATIAL_REF_SYS
REVOKE ALL ON public.spatial_ref_sys FROM anon, authenticated;
GRANT SELECT ON public.spatial_ref_sys TO service_role;

-- 2. FOLLOWERS
ALTER TABLE public.followers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS followers_select ON public.followers;
CREATE POLICY followers_select ON public.followers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS followers_insert ON public.followers;
CREATE POLICY followers_insert ON public.followers
    FOR INSERT WITH CHECK (follower_id = current_anonymous_id());

DROP POLICY IF EXISTS followers_delete ON public.followers;
CREATE POLICY followers_delete ON public.followers
    FOR DELETE USING (follower_id = current_anonymous_id());

-- 3. ZONE_SAFETY_SCORES
ALTER TABLE public.zone_safety_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS zone_safety_scores_select ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_select ON public.zone_safety_scores
    FOR SELECT USING (true);

DROP POLICY IF EXISTS zone_safety_scores_insert ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_insert ON public.zone_safety_scores
    FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS zone_safety_scores_update ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_update ON public.zone_safety_scores
    FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS zone_safety_scores_delete ON public.zone_safety_scores;
CREATE POLICY zone_safety_scores_delete ON public.zone_safety_scores
    FOR DELETE USING (false);

-- 4. STARRED_MESSAGES
ALTER TABLE public.starred_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS starred_messages_select ON public.starred_messages;
CREATE POLICY starred_messages_select ON public.starred_messages
    FOR SELECT USING (user_id = current_anonymous_id());

DROP POLICY IF EXISTS starred_messages_insert ON public.starred_messages;
CREATE POLICY starred_messages_insert ON public.starred_messages
    FOR INSERT WITH CHECK (user_id = current_anonymous_id());

DROP POLICY IF EXISTS starred_messages_delete ON public.starred_messages;
CREATE POLICY starred_messages_delete ON public.starred_messages
    FOR DELETE USING (user_id = current_anonymous_id());
```

---

## Checklist Final

- [ ] RLS habilitado en todas las tablas public afectadas
- [ ] Ninguna tabla expuesta sin políticas
- [ ] Linter Supabase pasa sin errores
- [ ] No se rompió acceso legítimo

### Verificación Post-Ejecución

1. **Verificar RLS habilitado:**
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('followers', 'zone_safety_scores', 'starred_messages');
```

2. **Verificar políticas creadas:**
```sql
SELECT schemaname, tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('followers', 'zone_safety_scores', 'starred_messages');
```

3. **Test de seguridad desde cliente JS:**
```javascript
// DEBE FALLAR (401/403)
await supabase.from('zone_safety_scores').insert({ zone_id: 'test', score: 100 });

// DEBE FUNCIONAR
await supabase.from('zone_safety_scores').select('*');
```

---

## Notas Técnicas

> **Prerequisito:** La función `current_anonymous_id()` ya existe en el schema (línea 292-297 de `schema.sql`). Retorna `current_setting('app.anonymous_id', TRUE)::UUID`.

> **Backend:** El servidor usa conexión directa con `DATABASE_URL` (rol `postgres`) que bypasea RLS. Las políticas solo afectan accesos vía Supabase Client SDK con `anon`/`authenticated` keys.

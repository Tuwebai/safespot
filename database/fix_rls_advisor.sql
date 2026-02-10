-- ============================================
-- FIX: RLS Advisor Warnings
-- Fecha: 2025-02-10
-- ============================================

-- 1. spatial_ref_sys - Tabla de sistema PostGIS
-- NOTA: Esta es una tabla de referencia espacial de solo lectura
-- No requiere RLS porque es datos geoespaciales públicos del sistema
-- El advisor la detecta como "public" pero es intencional

-- Verificar si es realmente necesario habilitar RLS aquí
-- Normalmente NO se habilita RLS en tablas de sistema PostGIS
-- porque contienen datos de referencia geoespacial públicos

-- Si el advisor insiste, podemos habilitarla pero con política de lectura pública:
-- ALTER TABLE spatial_ref_sys ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY spatial_ref_sys_select ON spatial_ref_sys FOR SELECT USING (true);

-- ============================================
-- 2. feature_flags - Configuración de features
-- ============================================

-- Verificar estructura actual
-- SELECT * FROM feature_flags LIMIT 1;

-- Si feature_flags contiene configuraciones sensibles:
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Política: Solo lectura pública para flags activos
-- (Asumiendo que los feature flags son públicos para el frontend)
DROP POLICY IF EXISTS feature_flags_select ON feature_flags;
CREATE POLICY feature_flags_select ON feature_flags
    FOR SELECT USING (true);

-- Si hay flags de admin/sistema que no deben verse:
-- CREATE POLICY feature_flags_admin ON feature_flags
--     FOR ALL USING (current_user = 'admin' OR EXISTS (
--         SELECT 1 FROM admin_users WHERE id = current_setting('app.user_id')::uuid
--     ));

-- Verificación
SELECT 
    tablename,
    relrowsecurity as rls_enabled
FROM pg_tables 
JOIN pg_class ON pg_tables.tablename = pg_class.relname
WHERE tablename IN ('spatial_ref_sys', 'feature_flags');

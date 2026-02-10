-- ============================================
-- MIGRATION: Personal Aliases for Users
-- Fecha: 2025-02-10
-- Clasificación: Nivel B (Feature nueva)
-- ============================================

-- 1. TABLA: user_personal_aliases
-- Diseño preparado para futura extensión (notas, etiquetas, bloqueos)
CREATE TABLE IF NOT EXISTS user_personal_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_anonymous_id UUID NOT NULL,      -- Quien asigna el alias
    target_anonymous_id UUID NOT NULL,     -- A quien se le asigna
    alias VARCHAR(40) NOT NULL,            -- El alias personalizado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints de integridad
    CONSTRAINT fk_owner FOREIGN KEY (owner_anonymous_id) 
        REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT fk_target FOREIGN KEY (target_anonymous_id) 
        REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT no_self_alias CHECK (owner_anonymous_id != target_anonymous_id),
    CONSTRAINT alias_not_empty CHECK (LENGTH(TRIM(alias)) > 0),
    CONSTRAINT alias_max_length CHECK (LENGTH(alias) <= 40),
    
    -- Un alias por relación owner-target
    UNIQUE(owner_anonymous_id, target_anonymous_id)
);

-- 2. ÍNDICES: Optimizados para JOINs en /nearby y /global
CREATE INDEX IF NOT EXISTS idx_personal_aliases_owner 
    ON user_personal_aliases(owner_anonymous_id);
CREATE INDEX IF NOT EXISTS idx_personal_aliases_target 
    ON user_personal_aliases(target_anonymous_id);
CREATE INDEX IF NOT EXISTS idx_personal_aliases_lookup 
    ON user_personal_aliases(owner_anonymous_id, target_anonymous_id);

-- 3. RLS: Habilitar
ALTER TABLE user_personal_aliases ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES: Solo owner puede ver/modificar sus aliases
DROP POLICY IF EXISTS personal_aliases_select ON user_personal_aliases;
CREATE POLICY personal_aliases_select ON user_personal_aliases
    FOR SELECT USING (owner_anonymous_id = current_anonymous_id());

DROP POLICY IF EXISTS personal_aliases_insert ON user_personal_aliases;
CREATE POLICY personal_aliases_insert ON user_personal_aliases
    FOR INSERT WITH CHECK (owner_anonymous_id = current_anonymous_id());

DROP POLICY IF EXISTS personal_aliases_update ON user_personal_aliases;
CREATE POLICY personal_aliases_update ON user_personal_aliases
    FOR UPDATE USING (owner_anonymous_id = current_anonymous_id())
    WITH CHECK (owner_anonymous_id = current_anonymous_id());

DROP POLICY IF EXISTS personal_aliases_delete ON user_personal_aliases;
CREATE POLICY personal_aliases_delete ON user_personal_aliases
    FOR DELETE USING (owner_anonymous_id = current_anonymous_id());

-- 5. TRIGGER: Auto-update updated_at (consistencia con sistema)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_personal_aliases_updated_at ON user_personal_aliases;
CREATE TRIGGER update_user_personal_aliases_updated_at
    BEFORE UPDATE ON user_personal_aliases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICACIÓN POST-MIGRACIÓN
-- ============================================
-- \dt user_personal_aliases
-- \d user_personal_aliases
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'user_personal_aliases';

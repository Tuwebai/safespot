-- ============================================
-- MIGRATION: Favorites and Report Flags
-- ============================================
-- This migration adds:
-- 1. favorites table for saving favorite reports
-- 2. report_flags table for reporting inappropriate content
-- ============================================

-- ============================================
-- 1. CREATE favorites TABLE
-- ============================================
-- Table to track favorite reports by anonymous users
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anonymous_id UUID NOT NULL,
    report_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_favorites_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_anonymous FOREIGN KEY (anonymous_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT unique_favorite UNIQUE (anonymous_id, report_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_favorites_anonymous_id ON favorites(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_favorites_report_id ON favorites(report_id);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(created_at DESC);

-- ============================================
-- 2. CREATE report_flags TABLE
-- ============================================
-- Table to track reports flagged by anonymous users
CREATE TABLE IF NOT EXISTS report_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL,
    anonymous_id UUID NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_report_flags_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_flags_anonymous FOREIGN KEY (anonymous_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT unique_report_flag UNIQUE (anonymous_id, report_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_report_flags_report_id ON report_flags(report_id);
CREATE INDEX IF NOT EXISTS idx_report_flags_anonymous_id ON report_flags(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_report_flags_created_at ON report_flags(created_at DESC);

-- ============================================
-- 3. ADD flags_count TO reports TABLE (Optional)
-- ============================================
-- Add column to track flag count (for moderation purposes)
ALTER TABLE reports 
ADD COLUMN IF NOT EXISTS flags_count INTEGER DEFAULT 0;

-- Index for filtering by flags
CREATE INDEX IF NOT EXISTS idx_reports_flags_count ON reports(flags_count) WHERE flags_count > 0;

-- ============================================
-- 4. TRIGGER: Update flags_count
-- ============================================
-- Automatically update flags_count when flags are added/removed
CREATE OR REPLACE FUNCTION update_report_flags_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE reports SET flags_count = flags_count + 1 WHERE id = NEW.report_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reports SET flags_count = GREATEST(0, flags_count - 1) WHERE id = OLD.report_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_report_flags_count ON report_flags;
CREATE TRIGGER trigger_update_report_flags_count
    AFTER INSERT OR DELETE ON report_flags
    FOR EACH ROW
    EXECUTE FUNCTION update_report_flags_count();

-- ============================================
-- 5. RLS: favorites TABLE
-- ============================================
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own favorites
DROP POLICY IF EXISTS favorites_select ON favorites;
CREATE POLICY favorites_select ON favorites
    FOR SELECT
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Anyone can create favorites (with their anonymous_id)
DROP POLICY IF EXISTS favorites_insert ON favorites;
CREATE POLICY favorites_insert ON favorites
    FOR INSERT
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only delete their own favorites
DROP POLICY IF EXISTS favorites_delete ON favorites;
CREATE POLICY favorites_delete ON favorites
    FOR DELETE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- ============================================
-- 6. RLS: report_flags TABLE
-- ============================================
ALTER TABLE report_flags ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own flags
DROP POLICY IF EXISTS report_flags_select ON report_flags;
CREATE POLICY report_flags_select ON report_flags
    FOR SELECT
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Anyone can create flags (with their anonymous_id)
DROP POLICY IF EXISTS report_flags_insert ON report_flags;
CREATE POLICY report_flags_insert ON report_flags
    FOR INSERT
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only delete their own flags (for undo)
DROP POLICY IF EXISTS report_flags_delete ON report_flags;
CREATE POLICY report_flags_delete ON report_flags
    FOR DELETE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- ============================================
-- NOTES
-- ============================================
-- 1. favorites: Tracks which reports users have favorited
-- 2. report_flags: Tracks reports flagged for moderation
-- 3. flags_count: Automatically maintained by trigger
-- 4. RLS policies ensure users can only manage their own favorites/flags
-- 5. UNIQUE constraints prevent duplicate favorites/flags per user
-- ============================================


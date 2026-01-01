-- ============================================
-- FIX: USER STATS UPDATE ON SOFT DELETE
-- ============================================

BEGIN;

CREATE OR REPLACE FUNCTION update_user_stats_on_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Reports
    IF TG_TABLE_NAME = 'reports' THEN
        -- Case A: Soft Delete (Deleted_at becomes not null)
        IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
            UPDATE anonymous_users 
            SET total_reports = GREATEST(0, total_reports - 1)
            WHERE anonymous_id = NEW.anonymous_id;
        
        -- Case B: Restore (Deleted_at becomes null)
        ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
            UPDATE anonymous_users 
            SET total_reports = total_reports + 1
            WHERE anonymous_id = NEW.anonymous_id;
        END IF;

    -- Comments
    ELSIF TG_TABLE_NAME = 'comments' THEN
        -- Case A: Soft Delete
        IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
            UPDATE anonymous_users 
            SET total_comments = GREATEST(0, total_comments - 1)
            WHERE anonymous_id = NEW.anonymous_id;

        -- Case B: Restore
        ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN
            UPDATE anonymous_users 
            SET total_comments = total_comments + 1
            WHERE anonymous_id = NEW.anonymous_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach Triggers

DROP TRIGGER IF EXISTS trg_reports_user_stats_soft_delete ON reports;
CREATE TRIGGER trg_reports_user_stats_soft_delete
AFTER UPDATE OF deleted_at ON reports
FOR EACH ROW
EXECUTE FUNCTION update_user_stats_on_soft_delete();

DROP TRIGGER IF EXISTS trg_comments_user_stats_soft_delete ON comments;
CREATE TRIGGER trg_comments_user_stats_soft_delete
AFTER UPDATE OF deleted_at ON comments
FOR EACH ROW
EXECUTE FUNCTION update_user_stats_on_soft_delete();

COMMIT;

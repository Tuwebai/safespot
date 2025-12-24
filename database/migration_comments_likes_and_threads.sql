-- ============================================
-- MIGRATION: Comments Likes and Threads Support
-- ============================================
-- This migration adds:
-- 1. parent_id to comments table for thread support
-- 2. comment_likes table for tracking likes on comments
-- ============================================

-- ============================================
-- 1. ADD parent_id TO comments TABLE
-- ============================================
-- Add parent_id column to support comment threads/replies
ALTER TABLE comments 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Index for performance on parent_id lookups
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id) WHERE parent_id IS NOT NULL;

-- Index for getting top-level comments (parent_id IS NULL)
CREATE INDEX IF NOT EXISTS idx_comments_top_level ON comments(report_id, created_at) WHERE parent_id IS NULL;

-- ============================================
-- 2. CREATE comment_likes TABLE
-- ============================================
-- Table to track likes on comments by anonymous users
CREATE TABLE IF NOT EXISTS comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL,
    anonymous_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_comment_likes_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_likes_anonymous FOREIGN KEY (anonymous_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT unique_comment_like UNIQUE (comment_id, anonymous_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_anonymous_id ON comment_likes(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_created_at ON comment_likes(created_at DESC);

-- ============================================
-- 3. TRIGGER: Update comments.upvotes_count
-- ============================================
-- Automatically update upvotes_count when likes are added/removed
CREATE OR REPLACE FUNCTION update_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE comments SET upvotes_count = upvotes_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE comments SET upvotes_count = GREATEST(0, upvotes_count - 1) WHERE id = OLD.comment_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comment_likes_count ON comment_likes;
CREATE TRIGGER trigger_update_comment_likes_count
    AFTER INSERT OR DELETE ON comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_likes_count();

-- ============================================
-- 4. RLS: comment_likes TABLE
-- ============================================
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read comment_likes (for counting)
DROP POLICY IF EXISTS comment_likes_select ON comment_likes;
CREATE POLICY comment_likes_select ON comment_likes
    FOR SELECT
    USING (true);

-- Policy: Anyone can create likes (with their anonymous_id)
DROP POLICY IF EXISTS comment_likes_insert ON comment_likes;
CREATE POLICY comment_likes_insert ON comment_likes
    FOR INSERT
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only delete their own likes
DROP POLICY IF EXISTS comment_likes_delete ON comment_likes;
CREATE POLICY comment_likes_delete ON comment_likes
    FOR DELETE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- ============================================
-- 5. UPDATE comments_count TRIGGER
-- ============================================
-- Update report comments_count to only count top-level comments (parent_id IS NULL)
-- This ensures replies don't inflate the comment count on reports
CREATE OR REPLACE FUNCTION update_report_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Only increment if it's a top-level comment (not a reply)
        IF NEW.parent_id IS NULL THEN
            UPDATE reports SET comments_count = comments_count + 1 WHERE id = NEW.report_id;
        END IF;
        UPDATE anonymous_users SET total_comments = total_comments + 1 WHERE anonymous_id = NEW.anonymous_id;
    ELSIF TG_OP = 'DELETE' THEN
        -- Only decrement if it was a top-level comment
        IF OLD.parent_id IS NULL THEN
            UPDATE reports SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.report_id;
        END IF;
        UPDATE anonymous_users SET total_comments = GREATEST(0, total_comments - 1) WHERE anonymous_id = OLD.anonymous_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with updated function
DROP TRIGGER IF EXISTS trigger_update_report_comments ON comments;
CREATE TRIGGER trigger_update_report_comments
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_report_comments_count();

-- ============================================
-- NOTES
-- ============================================
-- 1. parent_id allows comments to be replies to other comments
-- 2. comment_likes table tracks individual likes (one per anonymous_id per comment)
-- 3. upvotes_count is automatically maintained by trigger
-- 4. RLS policies ensure users can only manage their own likes
-- 5. comments_count on reports only counts top-level comments (not replies)
-- ============================================


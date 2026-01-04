-- ============================================
-- SAFESPOT ANONYMOUS BACKEND SCHEMA
-- ============================================
-- This schema supports 100% anonymous operations
-- No authentication, no login, no user accounts
-- All operations tied to anonymous_id (UUID v4)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ANONYMOUS USERS TABLE
-- ============================================
-- Tracks anonymous users by their anonymous_id
-- Future-proof: can migrate to authenticated users
CREATE TABLE IF NOT EXISTS anonymous_users (
    anonymous_id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_reports INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    -- Note: anonymous_id is provided by frontend, not auto-generated
    -- This ensures persistence across sessions
    CONSTRAINT valid_uuid_format CHECK (anonymous_id IS NOT NULL)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_anonymous_users_last_active ON anonymous_users(last_active_at);

-- ============================================
-- 2. REPORTS TABLE
-- ============================================
-- All reports created by anonymous users
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anonymous_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    zone VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status VARCHAR(50) DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'resuelto', 'cerrado')),
    upvotes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    incident_date TIMESTAMP WITH TIME ZONE -- Date when the incident actually occurred (may differ from created_at)
    -- Note: anonymous_id is UUID NOT NULL, NO foreign key constraint
    -- This allows 100% anonymous operations without requiring anonymous_users table
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reports_anonymous_id ON reports(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_zone ON reports(zone);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_incident_date ON reports(incident_date DESC);

-- ============================================
-- 3. COMMENTS TABLE
-- ============================================
-- Comments on reports by anonymous users
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL,
    anonymous_id UUID NOT NULL,
    content TEXT NOT NULL,
    upvotes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_comments_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_anonymous FOREIGN KEY (anonymous_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_comments_report_id ON comments(report_id);
CREATE INDEX IF NOT EXISTS idx_comments_anonymous_id ON comments(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

-- ============================================
-- 4. VOTES TABLE
-- ============================================
-- Votes (upvotes) on reports and comments
-- Prevents duplicate votes per anonymous_id
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    anonymous_id UUID NOT NULL,
    report_id UUID,
    comment_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_votes_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_votes_comment FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    CONSTRAINT fk_votes_anonymous FOREIGN KEY (anonymous_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT vote_target CHECK (
        (report_id IS NOT NULL AND comment_id IS NULL) OR
        (report_id IS NULL AND comment_id IS NOT NULL)
    ),
    CONSTRAINT one_vote_per_target UNIQUE (anonymous_id, report_id, comment_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_votes_report_id ON votes(report_id) WHERE report_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_votes_comment_id ON votes(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_votes_anonymous_id ON votes(anonymous_id);

-- ============================================
-- 5. GAMIFICATION STATS TABLE (Optional)
-- ============================================
-- Tracks gamification progress per anonymous user
CREATE TABLE IF NOT EXISTS gamification_stats (
    anonymous_id UUID PRIMARY KEY,
    total_reports INTEGER DEFAULT 0,
    total_comments INTEGER DEFAULT 0,
    total_votes_given INTEGER DEFAULT 0,
    total_votes_received INTEGER DEFAULT 0,
    points INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    badges JSONB DEFAULT '[]'::jsonb,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_gamification_anonymous FOREIGN KEY (anonymous_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE
);

-- ============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Update reports.updated_at on change
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reports_updated_at ON reports;
CREATE TRIGGER trigger_update_reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

-- Update comments.updated_at on change
CREATE OR REPLACE FUNCTION update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comments_updated_at ON comments;
CREATE TRIGGER trigger_update_comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_comments_updated_at();

-- Update report upvotes_count when vote is added/removed
CREATE OR REPLACE FUNCTION update_report_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.report_id IS NOT NULL THEN
        UPDATE reports SET upvotes_count = upvotes_count + 1 WHERE id = NEW.report_id;
        UPDATE anonymous_users SET total_votes = total_votes + 1 WHERE anonymous_id = NEW.anonymous_id;
    ELSIF TG_OP = 'DELETE' AND OLD.report_id IS NOT NULL THEN
        UPDATE reports SET upvotes_count = GREATEST(0, upvotes_count - 1) WHERE id = OLD.report_id;
        UPDATE anonymous_users SET total_votes = GREATEST(0, total_votes - 1) WHERE anonymous_id = OLD.anonymous_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_report_upvotes ON votes;
CREATE TRIGGER trigger_update_report_upvotes
    AFTER INSERT OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_report_upvotes_count();

-- Update comment upvotes_count when vote is added/removed
CREATE OR REPLACE FUNCTION update_comment_upvotes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.comment_id IS NOT NULL THEN
        UPDATE comments SET upvotes_count = upvotes_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.comment_id IS NOT NULL THEN
        UPDATE comments SET upvotes_count = GREATEST(0, upvotes_count - 1) WHERE id = OLD.comment_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_comment_upvotes ON votes;
CREATE TRIGGER trigger_update_comment_upvotes
    AFTER INSERT OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_comment_upvotes_count();

-- Update report comments_count when comment is added/removed
CREATE OR REPLACE FUNCTION update_report_comments_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE reports SET comments_count = comments_count + 1 WHERE id = NEW.report_id;
        UPDATE anonymous_users SET total_comments = total_comments + 1 WHERE anonymous_id = NEW.anonymous_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE reports SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.report_id;
        UPDATE anonymous_users SET total_comments = GREATEST(0, total_comments - 1) WHERE anonymous_id = OLD.anonymous_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_report_comments ON comments;
CREATE TRIGGER trigger_update_report_comments
    AFTER INSERT OR DELETE ON comments
    FOR EACH ROW
    EXECUTE FUNCTION update_report_comments_count();

-- Update anonymous_users stats when report is created
CREATE OR REPLACE FUNCTION update_anonymous_user_on_report()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE anonymous_users 
        SET total_reports = total_reports + 1,
            last_active_at = NOW()
        WHERE anonymous_id = NEW.anonymous_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE anonymous_users 
        SET total_reports = GREATEST(0, total_reports - 1)
        WHERE anonymous_id = OLD.anonymous_id;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_anonymous_on_report ON reports;
CREATE TRIGGER trigger_update_anonymous_on_report
    AFTER INSERT OR DELETE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION update_anonymous_user_on_report();

-- ============================================
-- HELPER FUNCTION: Get or create anonymous user
-- ============================================
-- This function ensures anonymous_id exists in database
-- Updates last_active_at on every call
CREATE OR REPLACE FUNCTION get_or_create_anonymous_user(p_anonymous_id UUID)
RETURNS UUID AS $$
DECLARE
    v_anonymous_id UUID;
BEGIN
    -- Try to get existing user
    SELECT anonymous_id INTO v_anonymous_id
    FROM anonymous_users
    WHERE anonymous_id = p_anonymous_id;
    
    -- If not found, create new one
    IF v_anonymous_id IS NULL THEN
        INSERT INTO anonymous_users (anonymous_id, created_at, last_active_at)
        VALUES (p_anonymous_id, NOW(), NOW())
        ON CONFLICT (anonymous_id) DO UPDATE SET last_active_at = NOW()
        RETURNING anonymous_id INTO v_anonymous_id;
    ELSE
        -- Update last_active_at
        UPDATE anonymous_users
        SET last_active_at = NOW()
        WHERE anonymous_id = p_anonymous_id;
    END IF;
    
    RETURN v_anonymous_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
-- Enable RLS on all tables for security
-- Policies allow public read, but restrict write to owners
-- ============================================

-- Function to get current anonymous_id from request context
-- This will be set by the backend application
CREATE OR REPLACE FUNCTION current_anonymous_id()
RETURNS UUID AS $$
BEGIN
    RETURN NULLIF(current_setting('app.anonymous_id', TRUE), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RLS: ANONYMOUS_USERS
-- ============================================
ALTER TABLE anonymous_users ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read anonymous_users (for stats)
DROP POLICY IF EXISTS anonymous_users_select ON anonymous_users;
CREATE POLICY anonymous_users_select ON anonymous_users
    FOR SELECT
    USING (true);

-- Policy: Anyone can insert their own anonymous_user
DROP POLICY IF EXISTS anonymous_users_insert ON anonymous_users;
CREATE POLICY anonymous_users_insert ON anonymous_users
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can only update their own record
DROP POLICY IF EXISTS anonymous_users_update ON anonymous_users;
CREATE POLICY anonymous_users_update ON anonymous_users
    FOR UPDATE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL)
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- ============================================
-- RLS: REPORTS
-- ============================================
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read reports (public)
DROP POLICY IF EXISTS reports_select ON reports;
CREATE POLICY reports_select ON reports
    FOR SELECT
    USING (true);

-- Policy: Anyone can create reports (with their anonymous_id)
DROP POLICY IF EXISTS reports_insert ON reports;
CREATE POLICY reports_insert ON reports
    FOR INSERT
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only update their own reports
DROP POLICY IF EXISTS reports_update ON reports;
CREATE POLICY reports_update ON reports
    FOR UPDATE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL)
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only delete their own reports
DROP POLICY IF EXISTS reports_delete ON reports;
CREATE POLICY reports_delete ON reports
    FOR DELETE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- ============================================
-- RLS: COMMENTS
-- ============================================
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read comments (public)
DROP POLICY IF EXISTS comments_select ON comments;
CREATE POLICY comments_select ON comments
    FOR SELECT
    USING (true);

-- Policy: Anyone can create comments (with their anonymous_id)
DROP POLICY IF EXISTS comments_insert ON comments;
CREATE POLICY comments_insert ON comments
    FOR INSERT
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only update their own comments
DROP POLICY IF EXISTS comments_update ON comments;
CREATE POLICY comments_update ON comments
    FOR UPDATE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL)
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only delete their own comments
DROP POLICY IF EXISTS comments_delete ON comments;
CREATE POLICY comments_delete ON comments
    FOR DELETE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- ============================================
-- RLS: VOTES
-- ============================================
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own votes
DROP POLICY IF EXISTS votes_select ON votes;
CREATE POLICY votes_select ON votes
    FOR SELECT
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Anyone can create votes (with their anonymous_id)
DROP POLICY IF EXISTS votes_insert ON votes;
CREATE POLICY votes_insert ON votes
    FOR INSERT
    WITH CHECK (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: Users can only delete their own votes
DROP POLICY IF EXISTS votes_delete ON votes;
CREATE POLICY votes_delete ON votes
    FOR DELETE
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- ============================================
-- RLS: GAMIFICATION_STATS
-- ============================================
ALTER TABLE gamification_stats ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own stats
DROP POLICY IF EXISTS gamification_stats_select ON gamification_stats;
CREATE POLICY gamification_stats_select ON gamification_stats
    FOR SELECT
    USING (anonymous_id = current_anonymous_id() OR current_anonymous_id() IS NULL);

-- Policy: System can insert/update stats (via triggers/functions)
DROP POLICY IF EXISTS gamification_stats_all ON gamification_stats;
CREATE POLICY gamification_stats_all ON gamification_stats
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- ============================================


-- ============================================
-- 6. CHAT ROOMS TABLE
-- ============================================
-- Manages 1-on-1 chats linked to specific reports
CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL,
    participant_a UUID NOT NULL, -- The user who initiates contact
    participant_b UUID NOT NULL, -- The report owner
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_chat_report FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_a FOREIGN KEY (participant_a) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_b FOREIGN KEY (participant_b) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    -- Prevent duplicate rooms for same participants on same report
    CONSTRAINT unique_chat_room UNIQUE (report_id, participant_a, participant_b),
    -- Prevent chatting with oneself
    CONSTRAINT different_participants CHECK (participant_a <> participant_b)
);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_report_id ON chat_rooms(report_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participant_a ON chat_rooms(participant_a);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participant_b ON chat_rooms(participant_b);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_last_message ON chat_rooms(last_message_at DESC);

-- ============================================
-- 7. CHAT MESSAGES TABLE
-- ============================================
-- Messages within a chat room
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'text' CHECK (type IN ('text', 'image', 'sighting')),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_message_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_message_sender FOREIGN KEY (sender_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
    CONSTRAINT message_content_not_empty CHECK (LENGTH(TRIM(content)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread_count ON chat_messages(room_id, sender_id, is_read) WHERE is_read = false;

-- ============================================
-- RLS: CHAT_ROOMS
-- ============================================
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see rooms they are part of
DROP POLICY IF EXISTS chat_rooms_select ON chat_rooms;
CREATE POLICY chat_rooms_select ON chat_rooms
    FOR SELECT
    USING (participant_a = current_anonymous_id() OR participant_b = current_anonymous_id());

-- Policy: Users can create rooms they are participant_a of
DROP POLICY IF EXISTS chat_rooms_insert ON chat_rooms;
CREATE POLICY chat_rooms_insert ON chat_rooms
    FOR INSERT
    WITH CHECK (participant_a = current_anonymous_id());

-- ============================================
-- RLS: CHAT_MESSAGES
-- ============================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see messages in rooms they belong to
DROP POLICY IF EXISTS chat_messages_select ON chat_messages;
CREATE POLICY chat_messages_select ON chat_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chat_rooms 
            WHERE id = chat_messages.room_id 
            AND (participant_a = current_anonymous_id() OR participant_b = current_anonymous_id())
        )
    );

-- Policy: Users can only send messages as themselves in their own rooms
DROP POLICY IF EXISTS chat_messages_insert ON chat_messages;
CREATE POLICY chat_messages_insert ON chat_messages
    FOR INSERT
    WITH CHECK (
        sender_id = current_anonymous_id() AND
        EXISTS (
            SELECT 1 FROM chat_rooms 
            WHERE id = room_id 
            AND (participant_a = current_anonymous_id() OR participant_b = current_anonymous_id())
        )
    );



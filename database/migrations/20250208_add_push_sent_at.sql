-- ============================================
-- FASE 2: Push Notification Tracking
-- Adds push_sent_at to notifications table
-- ============================================

-- Safety check: Add column only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'notifications' 
        AND column_name = 'push_sent_at'
    ) THEN
        ALTER TABLE notifications 
        ADD COLUMN push_sent_at TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE 'Added push_sent_at column to notifications table';
    ELSE
        RAISE NOTICE 'push_sent_at column already exists, skipping';
    END IF;
END $$;

-- Index for queries: notifications sent but not yet read (optional optimization)
-- Only create if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE indexname = 'idx_notifications_push_sent_at'
    ) THEN
        CREATE INDEX idx_notifications_push_sent_at 
        ON notifications(push_sent_at) 
        WHERE push_sent_at IS NOT NULL;
        
        RAISE NOTICE 'Created index on push_sent_at';
    END IF;
END $$;

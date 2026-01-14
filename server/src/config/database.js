import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create connection pool
// Supabase (direct connection or pooler) always requires SSL
const isSupabase = process.env.DATABASE_URL?.includes('supabase.co') ||
  process.env.DATABASE_URL?.includes('pooler.supabase.com');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isSupabase || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 50, // P0 FIX: Increased to 50 to absorb concurrent background tasks
  idleTimeoutMillis: 60000, // 60s
  connectionTimeoutMillis: 5000, // 5s fast fail (do not wait 20s)
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Database connection pool error:', err);
  // Important: We don't exit the process here to allow the server to recover 
  // and attempt to reconnect on subsequent requests.
});

// Test connection on startup (async, no bloquea)
async function testConnection() {
  try {
    if (!process.env.DATABASE_URL) {
      console.error('❌ [DATABASE] DATABASE_URL no está definido en server/.env');
      return;
    }

    // Esperar un poco antes de intentar conectar
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🔍 [DATABASE] Testing connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ [DATABASE] Connection successful');
    console.log('   [DATABASE] Remote Time:', result.rows[0].now);

    // Initial check: if we are in production, we might want to skip the heavy initSql
    // but here we keep it safe with IF NOT EXISTS.

    console.log('🏗️ [DATABASE] Checking schema health...');

    const initSql = `
      -- 1. Rate Limiting Table
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        hits_minute INTEGER DEFAULT 0,
        hits_hour INTEGER DEFAULT 0,
        reset_minute TIMESTAMP WITH TIME ZONE NOT NULL,
        reset_hour TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- 1b. Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_reports_anonymous_id ON reports(anonymous_id);
      CREATE INDEX IF NOT EXISTS idx_comments_anonymous_id ON comments(anonymous_id);
      CREATE INDEX IF NOT EXISTS idx_votes_anonymous_id ON votes(anonymous_id);
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
      
      -- PERFORMANCE CRITICAL: Spatial index for geographic queries
      CREATE INDEX IF NOT EXISTS idx_reports_location_gist ON reports USING GIST (location);
      
      -- PERFORMANCE CRITICAL: Cursor pagination composite index
      CREATE INDEX IF NOT EXISTS idx_reports_cursor ON reports (created_at DESC, id DESC) WHERE deleted_at IS NULL;
      
      -- PERFORMANCE CRITICAL: Trust score filter index
      CREATE INDEX IF NOT EXISTS idx_trust_scores_filter ON anonymous_trust_scores (anonymous_id) WHERE trust_score >= 30 AND moderation_status NOT IN ('shadow_banned', 'banned');

      -- 2. Follow System Table
      CREATE TABLE IF NOT EXISTS followers (
        follower_id UUID NOT NULL,
        following_id UUID NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (follower_id, following_id),
        CONSTRAINT fk_follower FOREIGN KEY (follower_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
        CONSTRAINT fk_following FOREIGN KEY (following_id) REFERENCES anonymous_users(anonymous_id) ON DELETE CASCADE,
        CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
      );
      CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_id);

      -- 3. Sync columns
      ALTER TABLE anonymous_users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
      ALTER TABLE anonymous_users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

      -- 4. Triggers (Idempotent creation)
      CREATE OR REPLACE FUNCTION update_follow_counts()
      RETURNS TRIGGER AS $$
      BEGIN
          IF TG_OP = 'INSERT' THEN
              UPDATE anonymous_users SET following_count = following_count + 1 WHERE anonymous_id = NEW.follower_id;
              UPDATE anonymous_users SET followers_count = followers_count + 1 WHERE anonymous_id = NEW.following_id;
          ELSIF TG_OP = 'DELETE' THEN
              UPDATE anonymous_users SET following_count = GREATEST(0, following_count - 1) WHERE anonymous_id = OLD.follower_id;
              UPDATE anonymous_users SET followers_count = GREATEST(0, followers_count - 1) WHERE anonymous_id = OLD.following_id;
          END IF;
          RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      -- Use a DO block to safely create trigger
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_follow_counts') THEN
              CREATE TRIGGER trigger_update_follow_counts
              AFTER INSERT OR DELETE ON followers
              FOR EACH ROW EXECUTE FUNCTION update_follow_counts();
          END IF;
      END $$;

      -- 6. Chat features
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS caption TEXT;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE;
      
      -- 7. Constraints
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_messages_type_check') THEN
          ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_type_check;
        END IF;
      END $$;
      
      ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_type_check 
        CHECK (type IN ('text', 'image', 'sighting', 'location'));

      -- 8. Admin Tasks performance
      CREATE INDEX IF NOT EXISTS idx_admin_tasks_status ON admin_tasks(status);
      CREATE INDEX IF NOT EXISTS idx_admin_tasks_severity ON admin_tasks(severity);
      CREATE INDEX IF NOT EXISTS idx_admin_tasks_type ON admin_tasks(type);
      CREATE INDEX IF NOT EXISTS idx_admin_tasks_created_at ON admin_tasks(created_at DESC);

      -- 9. Chat Global Schema Fixes
      ALTER TABLE chat_messages ALTER COLUMN room_id DROP NOT NULL;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reply_to_id UUID;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE;
      
      -- 10. Presence & Profile
      ALTER TABLE anonymous_users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
      ALTER TABLE anonymous_users ADD COLUMN IF NOT EXISTS interest_radius_meters INTEGER DEFAULT 1000;

      -- 11. Google Auth Support
      ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS provider VARCHAR(20) DEFAULT 'email';
      ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS provider_user_id VARCHAR(255);
      ALTER TABLE user_auth ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
      
      -- Add Unique Constraint for Providers (One Google Account per User-ish)
      -- We do this in a DO block to avoid error if it already exists
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_auth_provider_unique') THEN
            ALTER TABLE user_auth ADD CONSTRAINT user_auth_provider_unique UNIQUE (provider, provider_user_id);
        END IF;
      END $$;

      -- ============================================
      -- 12. CHAT MENU ACTIONS (WhatsApp-Grade)
      -- ============================================
      
      -- 12a. Reactions: JSONB on messages for emoji reactions
      -- Format: { "👍": ["user1", "user2"], "❤️": ["user3"] }
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';
      
      -- 12b. Pin: One pinned message per conversation
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_message_id UUID;
      
      -- 12c. Starred Messages: Per-user starred messages (separate table)
      CREATE TABLE IF NOT EXISTS starred_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        message_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, message_id)
      );
      
      -- Index for fast starred message lookups
      CREATE INDEX IF NOT EXISTS idx_starred_messages_user ON starred_messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_starred_messages_message ON starred_messages(message_id);
    `;

    // Only run the long script if we successfully connected
    await pool.query(initSql);
    console.log('✅ [DATABASE] Schema verification completed');

    // Quick sync for counts (non-blocking) - Only runs if needed or periodically
    // Removing the forced UPDATE on every startup to save resources in multi-process scenarios
    /*
    await pool.query(`
      UPDATE anonymous_users u
    SET
    followers_count = (SELECT COUNT(*) FROM followers WHERE following_id = u.anonymous_id),
    following_count = (SELECT COUNT(*) FROM followers WHERE follower_id = u.anonymous_id);
    `);
    */

  } catch (error) {
    if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      console.warn('⚠️  [DATABASE] Warning: Temporary connection issue (DNS/Timeout).');
    } else {
      console.error('❌ [DATABASE] Critical Error during startup:');
      console.error('   [DATABASE] Message:', error.message);
    }
  }
}

// Run test asynchronously
testConnection().catch(() => { });

export default pool;

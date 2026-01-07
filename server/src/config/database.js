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
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000, // Increased timeout for Supabase
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
      console.error('❌ DATABASE_URL no está definido en server/.env');
      return;
    }

    // Esperar un poco antes de intentar conectar
    // Esto da tiempo a que el sistema resuelva el DNS
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('🔍 Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connection test successful');
    console.log('   Database time:', result.rows[0].now);

    // SQL for required tables
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
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_hour ON rate_limits(reset_hour);

      -- 1b. Performance Indexes for Gamification & Feeds
      CREATE INDEX IF NOT EXISTS idx_reports_anonymous_id ON reports(anonymous_id);
      CREATE INDEX IF NOT EXISTS idx_comments_anonymous_id ON comments(anonymous_id);
      CREATE INDEX IF NOT EXISTS idx_votes_anonymous_id ON votes(anonymous_id);
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

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

      -- 3. Add columns to anonymous_users if they don't exist
      ALTER TABLE anonymous_users ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
      ALTER TABLE anonymous_users ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

      -- 4. Triggers to keep counts in sync
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

      DROP TRIGGER IF EXISTS trigger_update_follow_counts ON followers;
      CREATE TRIGGER trigger_update_follow_counts
          AFTER INSERT OR DELETE ON followers
          FOR EACH ROW
          EXECUTE FUNCTION update_follow_counts();

      -- 5. Initial sync for follow counts
      UPDATE anonymous_users u
      SET 
        followers_count = (SELECT COUNT(*) FROM followers WHERE following_id = u.anonymous_id),
        following_count = (SELECT COUNT(*) FROM followers WHERE follower_id = u.anonymous_id);
      -- 6. Add caption and delivered status to chat_messages
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS caption TEXT;
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_delivered BOOLEAN DEFAULT FALSE;
      -- 7. Update type check constraint for chat_messages
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
    `;

    await pool.query(initSql);
    console.log('✅ Core database tables prepared (rate_limits, followers)');

    // Test if tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('anonymous_users', 'reports', 'comments', 'votes', 'followers')
      ORDER BY table_name
    `);

    if (tablesCheck.rows.length === 0) {
      console.warn('⚠️  No se encontraron tablas. Ejecuta database/schema.sql');
    } else {
      console.log(`✅ Tablas encontradas: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);
    }
  } catch (error) {
    // No mostrar error si es ENOTFOUND - puede ser un problema temporal de DNS
    if (error.code === 'ENOTFOUND') {
      console.warn('⚠️  No se pudo resolver DNS en el test inicial.');
    } else {
      console.error('❌ Database connection test failed:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);
    }
  }
}

// Run test asynchronously
testConnection().catch(() => { });

export default pool;

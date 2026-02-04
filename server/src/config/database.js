import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isTest = process.env.NODE_ENV === 'test';

let pool;

if (isTest && !process.env.DATABASE_URL) {
  console.log('⚠️ [DATABASE] Running in TEST mode with MOCK pool (No DATABASE_URL found)');
  pool = {
    query: async () => ({ rows: [], rowCount: 0 }),
    on: () => { },
    end: async () => { },
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => { }
    })
  };
} else {
  // Create connection pool
  // Supabase (direct connection or pooler) always requires SSL
  const isSupabase = process.env.DATABASE_URL?.includes('supabase.co') ||
    process.env.DATABASE_URL?.includes('pooler.supabase.com');

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isSupabase || process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
    max: 20, // Reduced from 50 to avoid overwhelming the pooler
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000, // Increased for remote latency
  });
}

// Test connection
pool.on('connect', () => {
  // Silent connection in production
  if (process.env.NODE_ENV !== 'production' || process.env.DEBUG) {
    console.log('✅ Database connected');
  }
});

pool.on('error', (err) => {
  console.error('❌ Database connection pool error:', err);
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

    const result = await pool.query('SELECT NOW()');
    // console.log('✅ [DATABASE] Connection successful');
    console.log('   [DATABASE] Remote Time:', result.rows[0].now);

    // Initial check: if we are in production, we might want to skip the heavy initSql
    // but here we keep it safe with IF NOT EXISTS.

    // await pool.query(initSql); (Executed below)
    // console.log('✅ [DATABASE] Schema verification completed');

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
if (process.env.NODE_ENV !== 'test') {
  testConnection().catch(() => { });
}

export default pool;

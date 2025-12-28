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
  console.error('❌ Database connection error:', err);
  process.exit(-1);
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

    // Ensure rate_limits table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        hits_minute INTEGER DEFAULT 0,
        hits_hour INTEGER DEFAULT 0,
        reset_minute TIMESTAMP WITH TIME ZONE NOT NULL,
        reset_hour TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_hour ON rate_limits(reset_hour);
    `);
    console.log('✅ Rate limiting table prepared');

    // Test if tables exist
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('anonymous_users', 'reports', 'comments', 'votes')
      ORDER BY table_name
    `);

    if (tablesCheck.rows.length === 0) {
      console.warn('⚠️  No se encontraron tablas. Ejecuta database/schema.sql');
    } else {
      console.log(`✅ Tablas encontradas: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);
    }
  } catch (error) {
    // No mostrar error si es ENOTFOUND - puede ser un problema temporal de DNS
    // El pool se creará cuando se haga la primera query real
    if (error.code === 'ENOTFOUND') {
      console.warn('⚠️  No se pudo resolver DNS en el test inicial.');
      console.warn('   El servidor continuará. La conexión se establecerá cuando se haga la primera query.');
      console.warn('   Si las queries fallan, verifica tu conexión a internet.\n');
    } else {
      console.error('❌ Database connection test failed:');
      console.error('   Error:', error.message);
      console.error('   Code:', error.code);

      if (error.code === 'ECONNREFUSED') {
        console.error('   → Conexión rechazada');
        console.error('   → Verifica que la base de datos esté accesible');
        console.error('   → Verifica el puerto (5432 para PostgreSQL)');
      } else if (error.code === '28P01') {
        console.error('   → Error de autenticación');
        console.error('   → Verifica usuario y contraseña en DATABASE_URL');
      } else if (error.code === '3D000') {
        console.error('   → La base de datos no existe');
        console.error('   → Créala primero o verifica el nombre');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('   → Timeout de conexión');
        console.error('   → Verifica que la base de datos esté accesible');
        console.error('   → Para Supabase, verifica que el proyecto esté activo');
      }

      console.error('\n⚠️  El servidor continuará, pero las operaciones pueden fallar.');
      console.error('   Verifica tu archivo server/.env\n');
    }
  }
}

// Run test asynchronously (no bloquea el inicio del servidor)
testConnection().catch(() => {
  // Ignorar errores del test - el pool se creará cuando se necesite
});

export default pool;


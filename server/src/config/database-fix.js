import pg from 'pg';
import dotenv from 'dotenv';
import dns from 'dns';
import { promisify } from 'util';

dotenv.config();

const { Pool } = pg;

// Resolver DNS manualmente antes de crear el pool
async function resolveHostname(hostname) {
  return new Promise((resolve, reject) => {
    // Intentar con IPv4 primero
    dns.lookup(hostname, { family: 4, all: true }, (err, addresses) => {
      if (err) {
        // Si falla IPv4, intentar IPv6
        dns.lookup(hostname, { family: 6, all: true }, (err6, addresses6) => {
          if (err6) {
            reject(err6);
          } else {
            resolve(addresses6);
          }
        });
      } else {
        resolve(addresses);
      }
    });
  });
}

// Función para crear pool con resolución DNS manual
export async function createDatabasePool() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL no está definido');
  }

  // Extraer hostname del connection string
  const url = new URL(connectionString.replace('postgresql://', 'http://'));
  const hostname = url.hostname;
  
  console.log(`🔍 Resolviendo DNS para: ${hostname}`);
  
  try {
    // Intentar resolver el hostname
    const addresses = await resolveHostname(hostname);
    console.log(`✅ DNS resuelto: ${addresses.map(a => a.address).join(', ')}`);
  } catch (error) {
    console.warn(`⚠️  No se pudo resolver DNS: ${error.message}`);
    console.warn(`   Continuando de todas formas...`);
  }

  // Crear pool normalmente - pg debería manejar la conexión
  const isSupabase = connectionString.includes('supabase.co');
  const pool = new Pool({
    connectionString: connectionString,
    ssl: isSupabase || process.env.NODE_ENV === 'production' 
      ? { rejectUnauthorized: false } 
      : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });

  // Test connection
  try {
    await pool.query('SELECT 1');
    console.log('✅ Pool de conexión creado exitosamente');
  } catch (error) {
    console.error('❌ Error al crear pool:', error.message);
    throw error;
  }

  return pool;
}

// Crear pool inmediatamente
let poolPromise = null;

export default function getPool() {
  if (!poolPromise) {
    poolPromise = createDatabasePool();
  }
  return poolPromise;
}

// Para compatibilidad con código existente
export async function getPoolSync() {
  if (!poolPromise) {
    poolPromise = createDatabasePool();
  }
  return await poolPromise;
}


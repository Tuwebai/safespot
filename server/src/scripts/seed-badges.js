import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to find .env in various locations
const envPaths = [
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../../../.env'),
    path.join(process.cwd(), '.env'),
    path.join(process.cwd(), 'server/.env')
];

let envFound = false;
for (const envPath of envPaths) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
        console.log(`✅ Loaded .env from: ${envPath}`);
        envFound = true;
        break;
    }
}

if (!envFound || !process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in environment.');
    process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function seedBadges() {
    console.log('🚀 Seeding badges catalog...');

    const badges = [
        { code: 'FIRST_REPORT', name: 'Primer Reporte', description: 'Se otorga al crear el primer reporte en SafeSpot.', icon: '📝', category: 'activity', points: 50 },
        { code: 'ACTIVE_VOICE', name: 'Voz Activa', description: 'Has creado 5 reportes. Tu voz es fundamental para la comunidad.', icon: '🚀', category: 'activity', points: 150 },
        { code: 'FIRST_COMMENT', name: 'Primera Opinión', description: 'Primer comentario publicado en un reporte.', icon: '💬', category: 'community', points: 30 },
        { code: 'PARTICIPATIVE', name: 'Participativo', description: 'Has realizado 10 comentarios. ¡Gracias por participar!', icon: '👥', category: 'community', points: 100 },
        { code: 'FIRST_LIKE_RECEIVED', name: 'Primer Like', description: 'Primer like recibido en uno de tus reportes o comentarios.', icon: '⭐', category: 'interaction', points: 20 },
        { code: 'VALUABLE_CONTRIBUTION', name: 'Aporte Valioso', description: 'Has recibido 5 likes. Tus aportes son valorados.', icon: '🔥', category: 'interaction', points: 100 },
        { code: 'RECURRING_USER', name: 'Usuario Recurrente', description: 'Actividad registrada en 7 días distintos.', icon: '📅', category: 'retention', points: 200 },
        { code: 'CONSISTENT_USER', name: 'Constante', description: 'Actividad registrada en 30 días distintos. ¡Excelente compromiso!', icon: '🎯', category: 'retention', points: 500 },
        { code: 'VERIFIED_REPORT', name: 'Reporte Verificado', description: 'Un reporte con al menos 5 interacciones (likes + comentarios).', icon: '✅', category: 'impact', points: 300 },
        { code: 'GOOD_CITIZEN', name: 'Buen Ciudadano', description: 'Sin reportes válidos en contra y participación activa.', icon: '🛡️', category: 'good_use', points: 400 }
    ];

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            for (const badge of badges) {
                await client.query(`
          INSERT INTO badges (code, name, description, icon, category, points)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            icon = EXCLUDED.icon,
            category = EXCLUDED.category,
            points = EXCLUDED.points
        `, [badge.code, badge.name, badge.description, badge.icon, badge.category, badge.points]);
            }
            await client.query('COMMIT');
            console.log(`✅ Seeded ${badges.length} badges successfully.`);
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error) {
        console.error('❌ Error during seeding:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

seedBadges();

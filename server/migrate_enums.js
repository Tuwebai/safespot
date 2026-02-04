
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;

async function runMigration() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected.');

        console.log('Current enum values for user_action_type:');
        const checkRes = await client.query("SELECT unnest(enum_range(NULL::user_action_type)) as val");
        const currentValues = checkRes.rows.map(r => r.val);
        console.log(currentValues);

        const missingEnums = ['LIKE_REPORT', 'UNLIKE_REPORT'].filter(v => !currentValues.includes(v));

        if (missingEnums.length === 0) {
            console.log('No enums missing. All good.');
        } else {
            console.log('Adding missing enums:', missingEnums);
            for (const val of missingEnums) {
                // ALTER TYPE ... ADD VALUE cannot be executed in a transaction block (usually)
                // But depends on PG version. To be safe, we run it outside a BEGIN/COMMIT or one by one.
                await client.query(`ALTER TYPE user_action_type ADD VALUE '${val}'`);
                console.log(`Added ${val}`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();

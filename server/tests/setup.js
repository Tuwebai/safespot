import { beforeAll, afterAll } from 'vitest';
// import pool from '../src/config/database.js'; // Will be used later for DB connection closing

beforeAll(async () => {
    console.log('[Test Setup] Starting backend tests...');
});

afterAll(async () => {
    // Ensure DB pool is closed if we import it
    // await pool.end();
    console.log('[Test Setup] Finished backend tests.');
});

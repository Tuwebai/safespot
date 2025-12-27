import express from 'express';
import pool from '../config/database.js';
import { logError, logSuccess } from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/test/db
 * Test database connection
 */
router.get('/db', async (req, res) => {
  try {
    console.log('🔍 Intentando conectar a la base de datos...');
    const result = await pool.query('SELECT NOW(), version()');

    logSuccess('Database connection successful');

    res.json({
      success: true,
      message: 'Database connection successful',
      data: {
        serverTime: result.rows[0].now,
        version: result.rows[0].version
      }
    });
  } catch (error) {
    logError(error, req);

    res.status(500).json({
      success: false,
      error: 'Database connection failed'
    });
  }
});

export default router;


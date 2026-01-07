import express from 'express';
import { DB } from '../utils/db.js';
import { createAdminTask } from '../utils/adminTasks.js';

const router = express.Router();

/**
 * GET /api/admin/tasks
 * Fetch all tasks with optional filtering
 */
router.get('/', async (req, res, next) => {
    try {
        const { status, severity, type } = req.query;
        const db = DB.public();

        // Simple query building
        let query = 'SELECT * FROM admin_tasks';
        const conditions = [];
        const params = [];
        let pIdx = 1;

        if (status) {
            conditions.push(`status = $${pIdx++}`);
            params.push(status);
        }
        if (severity) {
            conditions.push(`severity = $${pIdx++}`);
            params.push(severity);
        }
        if (type) {
            conditions.push(`type = $${pIdx++}`);
            params.push(type);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY created_at DESC LIMIT 100';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

/**
 * POST /api/admin/tasks
 * Create a manual task
 */
router.post('/', async (req, res, next) => {
    try {
        const { title, description, severity, metadata } = req.body;

        const task = await createAdminTask({
            type: 'manual',
            title,
            description,
            severity: severity || 'low',
            source: 'manual',
            metadata: metadata || {}
        });

        res.status(201).json(task);
    } catch (error) {
        next(error);
    }
});

/**
 * PATCH /api/admin/tasks/:id
 * Update status or resolution
 */
router.patch('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, resolution_note } = req.body;
        const db = DB.public();

        const updateData = { status };
        if (status === 'done') {
            updateData.resolved_at = new Date().toISOString();
            updateData.metadata = {
                ... (await db.select('admin_tasks', { where: { id }, single: true }))?.metadata,
                resolution_note
            };
        }

        const result = await db.update('admin_tasks', updateData, { id });

        if (!result.length) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json(result[0]);
    } catch (error) {
        next(error);
    }
});

/**
 * DELETE /api/admin/tasks/:id
 * Remove a task permanently
 */
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const db = DB.public();

        const result = await db.delete('admin_tasks', { id });

        if (!result.length) {
            return res.status(404).json({ error: 'Task not found' });
        }

        res.json({ message: 'Task deleted successfully', deletedId: id });
    } catch (error) {
        next(error);
    }
});

export default router;

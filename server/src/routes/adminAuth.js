import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';
import { loginLimiter } from '../utils/rateLimiter.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-this';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.warn('⚠️ WARNING: Using default JWT_SECRET in production. Please set JWT_SECRET env var.');
}

// POST /api/admin/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and Password required' });
    }

    try {
        // 1. Check against Environment Variables (Master Credentials)
        const envEmail = process.env.ADMIN_EMAIL;
        const envPassword = process.env.ADMIN_PASSWORD;

        if (envEmail && envPassword && email === envEmail && password === envPassword) {
            console.log('[AdminAuth] Login successful via .env master credentials');
            const token = jwt.sign(
                { id: 'master-admin', email: envEmail, role: 'admin' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            return res.json({ token, user: { email: envEmail, role: 'admin' } });
        }

        // 2. Fallback: Fetch user from database
        const { data: user, error } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .eq('email', email)
            .single();

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 3. Compare password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 4. Update last login
        await supabaseAdmin
            .from('admin_users')
            .update({ last_login: new Date().toISOString() })
            .eq('id', user.id);

        // 5. Generate JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, user: { email: user.email, role: user.role } });

    } catch (err) {
        console.error('Login Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/admin/auth/verify
// Protected endpoint to validate token on client load
router.get('/verify', verifyAdminToken, (req, res) => {
    res.json({ valid: true, user: req.adminUser });
});

export default router;

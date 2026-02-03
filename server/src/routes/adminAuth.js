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
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and Password required' });
    }

    try {
        // 1. IDENTITY ACCESS GATEWAY (Nominal First)
        const { data: user, error } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .eq('email', email)
            .single();

        let isEnvAuth = false;
        let authUser = user;

        // 2. BREAK-GLASS FALLBACK (Emergency Only)
        // SECURITY: Only active if explicit flag is set AND not in permanent production
        const ALLOW_ENV_LOGIN = process.env.ENABLE_ADMIN_BREAKGLASS === 'true';
        if (!user && ALLOW_ENV_LOGIN) {
            const envEmail = process.env.ADMIN_EMAIL;
            const envPassword = process.env.ADMIN_PASSWORD;

            if (envEmail && envPassword && email === envEmail && password === envPassword) {
                console.warn(`[SECURITY] Break-glass login attempt by ${email} from ${ip}`);
                isEnvAuth = true;
                authUser = {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', // SYSTEM_ROOT_ID
                    email: envEmail,
                    role: 'super_admin',
                    alias: 'SafeSpot Core'
                };
            }
        }

        if (!authUser) {
            // Log failed attempt
            await supabaseAdmin.from('admin_access_logs').insert({
                attempt_email: email,
                ip_address: ip,
                user_agent: ua,
                success: false,
                failure_reason: 'User not found',
                auth_context: 'NOMINAL'
            });
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // 3. PASSWORD VERIFICATION (If not ENV auth)
        if (!isEnvAuth) {
            const validPassword = await bcrypt.compare(password, authUser.password_hash);
            if (!validPassword) {
                await supabaseAdmin.from('admin_access_logs').insert({
                    admin_id: authUser.id,
                    attempt_email: email,
                    ip_address: ip,
                    user_agent: ua,
                    success: false,
                    failure_reason: 'Invalid password',
                    auth_context: 'NOMINAL'
                });
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        // 4. LOG SUCCESSFUL ACCESS (Enterprise Ledger)
        await supabaseAdmin.from('admin_access_logs').insert({
            admin_id: authUser.id,
            attempt_email: email,
            ip_address: ip,
            user_agent: ua,
            success: true,
            auth_context: isEnvAuth ? 'ENV_BREAK_GLASS' : 'NOMINAL'
        });

        // 5. UPDATE LAST LOGIN
        if (!isEnvAuth) {
            await supabaseAdmin.from('admin_users')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', authUser.id);
        }

        // 6. GENERATE ENTERPRISE JWT
        const token = jwt.sign(
            {
                id: authUser.id,
                email: authUser.email,
                role: authUser.role,
                auth_type: isEnvAuth ? 'SYSTEM' : 'HUMAN'
            },
            JWT_SECRET,
            { expiresIn: '8h' } // Short TTL for Admin
        );

        // 🍪 SET SECURE SESSION COOKIE (Required for Zero-Trust static assets)
        res.cookie('admin_jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000 // 8 hours
        });


        res.json({
            token,
            user: {
                id: authUser.id,
                email: authUser.email,
                role: authUser.role,
                alias: authUser.alias
            }
        });

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

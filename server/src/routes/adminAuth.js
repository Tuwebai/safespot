import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';
import { loginLimiter, apiLimiter } from '../utils/rateLimiter.js';
import {
    generateTOTPSecret,
    verifyAndEnableTOTP,
    verifyTOTPCode,
    disableTOTP,
    regenerateBackupCodes,
    createTempToken,
    verifyTempToken,
    has2FAEnabled,
    get2FAStatus
} from '../services/admin2FAService.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-this';

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    console.warn('⚠️ WARNING: Using default JWT_SECRET in production. Please set JWT_SECRET env var.');
}

// ============================================================================
// LOGIN CON 2FA SUPPORT
// ============================================================================

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
        const ALLOW_ENV_LOGIN = process.env.ENABLE_ADMIN_BREAKGLASS === 'true';
        if (!user && ALLOW_ENV_LOGIN) {
            const envEmail = process.env.ADMIN_EMAIL;
            const envPassword = process.env.ADMIN_PASSWORD;

            if (envEmail && envPassword && email === envEmail && password === envPassword) {
                console.warn(`[SECURITY] Break-glass login attempt by ${email} from ${ip}`);
                isEnvAuth = true;
                authUser = {
                    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                    email: envEmail,
                    role: 'super_admin',
                    alias: 'SafeSpot Core'
                };
            }
        }

        if (!authUser) {
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

        // 4. CHECK 2FA REQUIREMENT
        const userHas2FA = await has2FAEnabled(authUser.id);
        
        if (userHas2FA && !isEnvAuth) {
            // Create temp token for 2FA step
            const { token: tempToken, expiresAt } = await createTempToken(authUser.id, req);
            
            return res.json({
                requires2FA: true,
                tempToken,
                expiresAt: expiresAt.toISOString(),
                user: {
                    id: authUser.id,
                    email: authUser.email,
                    role: authUser.role,
                    alias: authUser.alias
                }
            });
        }

        // 5. LOG SUCCESSFUL ACCESS (No 2FA or Break-glass)
        await supabaseAdmin.from('admin_access_logs').insert({
            admin_id: authUser.id,
            attempt_email: email,
            ip_address: ip,
            user_agent: ua,
            success: true,
            auth_context: isEnvAuth ? 'ENV_BREAK_GLASS' : 'NOMINAL'
        });

        // 6. UPDATE LAST LOGIN
        if (!isEnvAuth) {
            await supabaseAdmin.from('admin_users')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', authUser.id);
        }

        // 7. GENERATE ENTERPRISE JWT
        const token = jwt.sign(
            {
                id: authUser.id,
                email: authUser.email,
                role: authUser.role,
                auth_type: isEnvAuth ? 'SYSTEM' : 'HUMAN'
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.cookie('admin_jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000
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

// POST /api/admin/auth/verify-2fa
// Step 2: Verify TOTP code and return final JWT
router.post('/verify-2fa', loginLimiter, async (req, res) => {
    const { tempToken, code } = req.body;
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';

    if (!tempToken || !code) {
        return res.status(400).json({ error: 'Token and code required' });
    }

    try {
        // Verify temp token
        const adminId = await verifyTempToken(tempToken);
        
        if (!adminId) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Verify TOTP code
        const verified = await verifyTOTPCode(adminId, code);
        
        if (!verified) {
            return res.status(401).json({ error: 'Invalid verification code' });
        }

        // Get user data
        const { data: user, error } = await supabaseAdmin
            .from('admin_users')
            .select('*')
            .eq('id', adminId)
            .single();

        if (error || !user) {
            return res.status(500).json({ error: 'User not found' });
        }

        // Log successful 2FA login
        await supabaseAdmin.from('admin_access_logs').insert({
            admin_id: user.id,
            attempt_email: user.email,
            ip_address: ip,
            user_agent: ua,
            success: true,
            auth_context: '2FA'
        });

        // Update last login
        await supabaseAdmin.from('admin_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id);

        // Generate final JWT
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                auth_type: 'HUMAN_2FA'
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.cookie('admin_jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 8 * 60 * 60 * 1000
        });

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                alias: user.alias
            }
        });

    } catch (err) {
        console.error('2FA Verification Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ============================================================================
// 2FA MANAGEMENT (Protected)
// ============================================================================

// GET /api/admin/auth/2fa/status
router.get('/2fa/status', verifyAdminToken, async (req, res) => {
    try {
        const status = await get2FAStatus(req.adminUser.id);
        res.json({ success: true, data: status });
    } catch (err) {
        console.error('2FA Status Error:', err);
        res.status(500).json({ error: 'Failed to get 2FA status' });
    }
});

// POST /api/admin/auth/2fa/setup - Generate secret and QR code
router.post('/2fa/setup', verifyAdminToken, apiLimiter, async (req, res) => {
    try {
        const { secret, qrUrl, backupCodes } = await generateTOTPSecret(
            req.adminUser.id,
            req.adminUser.email
        );

        res.json({
            success: true,
            data: {
                secret, // Show only during setup
                qrUrl,
                backupCodes // Show only once
            }
        });
    } catch (err) {
        console.error('2FA Setup Error:', err);
        res.status(500).json({ error: 'Failed to generate 2FA setup' });
    }
});

// POST /api/admin/auth/2fa/verify-setup - Verify first code and enable 2FA
router.post('/2fa/verify-setup', verifyAdminToken, loginLimiter, async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code required' });
    }

    try {
        const result = await verifyAndEnableTOTP(req.adminUser.id, code);
        
        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        res.json({ success: true, message: result.message });
    } catch (err) {
        console.error('2FA Enable Error:', err);
        res.status(500).json({ error: 'Failed to enable 2FA' });
    }
});

// POST /api/admin/auth/2fa/disable - Disable 2FA
router.post('/2fa/disable', verifyAdminToken, loginLimiter, async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code required' });
    }

    try {
        const result = await disableTOTP(req.adminUser.id, code);
        
        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        res.json({ success: true, message: result.message });
    } catch (err) {
        console.error('2FA Disable Error:', err);
        res.status(500).json({ error: 'Failed to disable 2FA' });
    }
});

// POST /api/admin/auth/2fa/backup-codes - Generate new backup codes
router.post('/2fa/backup-codes', verifyAdminToken, loginLimiter, async (req, res) => {
    const { code } = req.body;

    if (!code) {
        return res.status(400).json({ error: 'Verification code required' });
    }

    try {
        const result = await regenerateBackupCodes(req.adminUser.id, code);
        
        if (!result.success) {
            return res.status(400).json({ error: result.message });
        }

        res.json({
            success: true,
            data: { backupCodes: result.backupCodes }
        });
    } catch (err) {
        console.error('Backup Codes Error:', err);
        res.status(500).json({ error: 'Failed to generate backup codes' });
    }
});

// GET /api/admin/auth/verify
router.get('/verify', verifyAdminToken, (req, res) => {
    res.json({ valid: true, user: req.adminUser });
});

export default router;

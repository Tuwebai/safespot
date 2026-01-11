
import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import { validateAuth, signToken } from '../middleware/auth.js';
import { logError, logSuccess } from '../utils/logger.js';
import { validateAnonymousId } from '../utils/validation.js';
import { authLimiter } from '../utils/rateLimiter.js';
import { verifyGoogleToken } from '../services/googleAuth.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

/**
 * POST /api/auth/register
 * Links an existing anonymous_id to a new email/password account.
 */
router.post('/register', authLimiter, async (req, res) => {
    try {
        const { email, password, current_anonymous_id } = req.body;

        // 1. Validation
        if (!email || !password || !current_anonymous_id) {
            return res.status(400).json({ error: 'Faltan datos requeridos (email, password, current_anonymous_id)' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // Validate UUID format
        try {
            validateAnonymousId(current_anonymous_id);
        } catch (e) {
            return res.status(400).json({ error: 'ID Anónimo inválido' });
        }

        // 2. Check overlap
        const existing = await pool.query('SELECT id FROM user_auth WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'El email ya está registrado' });
        }

        // 3. Hash Password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 4. Create Link (Identity Promotion)
        const result = await pool.query(
            `INSERT INTO user_auth (email, password_hash, anonymous_id, provider)
       VALUES ($1, $2, $3, 'email')
       RETURNING id, created_at`,
            [email, passwordHash, current_anonymous_id]
        );

        const newUser = result.rows[0];

        // 5. Generate Token
        const token = signToken({
            auth_id: newUser.id,
            anonymous_id: current_anonymous_id,
            email: email
        });

        // 6. Send Welcome Email (Async - Fire & Forget)
        import('../utils/emailService.js').then(({ emailService }) => {
            emailService.sendAuthEmail({
                type: 'welcome',
                email: email
            }).catch(err => console.error('Welcome email failed:', err));
        });

        logSuccess('User Registered', { auth_id: newUser.id, anonymous_id: current_anonymous_id });

        res.status(201).json({
            success: true,
            token,
            anonymous_id: current_anonymous_id,
            user: {
                email,
                auth_id: newUser.id
            }
        });

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Error del servidor al registrar user' });
    }
});

/**
 * POST /api/auth/login
 * Recovers the anonymous_id linked to the email.
 */
router.post('/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email y contraseña requeridos' });
        }

        // 1. Find User
        const result = await pool.query(
            'SELECT id, password_hash, anonymous_id FROM user_auth WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const user = result.rows[0];

        // 2. Verify Password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        // 3. Update Last Login
        await pool.query('UPDATE user_auth SET last_login_at = NOW() WHERE id = $1', [user.id]);

        // 4. Generate Token (With the recovered anonymous_id)
        const token = signToken({
            auth_id: user.id,
            anonymous_id: user.anonymous_id,
            email: email
        });

        logSuccess('User Logged In', { auth_id: user.id });

        res.json({
            success: true,
            token,
            anonymous_id: user.anonymous_id, // Client MUST use this to replace local ID
            message: 'Login exitoso'
        });

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * POST /api/auth/forgot-password
 * Initiates password reset flow.
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        // 1. Find user (Silent fail check later)
        const result = await pool.query('SELECT id FROM user_auth WHERE email = $1', [email]);
        const user = result.rows[0];

        if (user) {
            // 2. Generate Reset Token (Random Bytes, NOT JWT)
            const crypto = await import('crypto');
            const resetToken = crypto.randomBytes(32).toString('hex');
            const tokenHash = await bcrypt.hash(resetToken, 10);
            const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

            // 3. Save Hash in DB
            await pool.query(
                'UPDATE user_auth SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
                [tokenHash, expires, user.id]
            );

            // 4. Send Email via n8n
            console.log('Sending email via n8n...');
            const { emailService } = await import('../utils/emailService.js');
            const resetLink = `${process.env.CLIENT_URL || 'http://localhost:5174'}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

            await emailService.sendAuthEmail({
                type: 'password_reset',
                email: email,
                resetLink: resetLink
            });
        }

        // 5. Generic Response (Timing attack mitigation - though awaiting email might leak timing, simple for MVP)
        res.json({ message: 'Si el email existe, recibirás instrucciones.' });

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * POST /api/auth/reset-password
 * Completes password reset flow.
 */
router.post('/reset-password', authLimiter, async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // 1. Find User by Email
        const result = await pool.query(
            'SELECT id, reset_token, reset_token_expires FROM user_auth WHERE email = $1',
            [email]
        );
        const user = result.rows[0];

        if (!user || !user.reset_token) {
            return res.status(400).json({ error: 'Token inválido o expirado' });
        }

        // 2. Check Expiration
        if (new Date() > new Date(user.reset_token_expires)) {
            return res.status(400).json({ error: 'Token expirado' });
        }

        // 3. Verify Token Hash
        const isValid = await bcrypt.compare(token, user.reset_token);
        if (!isValid) {
            return res.status(400).json({ error: 'Token inválido' });
        }

        // 4. Update Password & Clear Token
        const saltRounds = 10;
        const newHash = await bcrypt.hash(newPassword, saltRounds);

        await pool.query(
            'UPDATE user_auth SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
            [newHash, user.id]
        );

        res.json({ success: true, message: 'Contraseña actualizada con éxito' });

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * POST /api/auth/change-password
 * Authenticated user password change.
 */
router.post('/change-password', validateAuth, authLimiter, async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });

    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Faltan datos' });

        // 1. Get User Password Hash
        const result = await pool.query('SELECT password_hash FROM user_auth WHERE id = $1', [req.user.auth_id]);
        const user = result.rows[0];

        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        // 2. Verify Current
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) return res.status(401).json({ error: 'Contraseña actual incorrecta' });

        // 3. Update
        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE user_auth SET password_hash = $1 WHERE id = $2', [newHash, req.user.auth_id]);

        res.json({ success: true, message: 'Contraseña actualizada' });

    } catch (err) {
        logError(err, req);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

/**
 * GET /api/auth/me
 * Returns current session state
 */
router.get('/me', validateAuth, (req, res) => {
    if (req.user) {
        res.json({
            authenticated: true,
            user: req.user,
            anonymous_id: req.headers['x-anonymous-id']
        });
    } else {
        res.json({
            authenticated: false,
            anonymous_id: req.headers['x-anonymous-id'] || null,
            message: 'Anonymous session'
        });
    }
});

/**
 * POST /api/auth/google
 * Handles Google OAuth Login/Register with Identity Promotion.
 */
router.post('/google', authLimiter, async (req, res) => {
    try {
        const { google_id_token, google_access_token, current_anonymous_id } = req.body;

        console.log('[DEBUG] Google Auth Request:', {
            hasIdToken: !!google_id_token,
            hasAccessToken: !!google_access_token,
            anonId: current_anonymous_id
        });

        if ((!google_id_token && !google_access_token) || !current_anonymous_id) {
            console.error('[DEBUG] Missing required fields for Google Auth');
            return res.status(400).json({ error: 'Token y ID anónimo requeridos' });
        }

        // 1. Verify Token (supports both now)
        const googleUser = await verifyGoogleToken({ google_id_token, google_access_token });

        // 2. Check if user exists (Provider-based)
        const userResult = await pool.query(
            'SELECT * FROM user_auth WHERE provider = $1 AND provider_user_id = $2',
            ['google', googleUser.sub]
        );

        let user = userResult.rows[0];
        let anonymousIdToUse = current_anonymous_id;

        if (user) {
            // LOGIN: User exists, use their stored anonymous_id (Restore Identity)
            anonymousIdToUse = user.anonymous_id;
        } else {
            // REGISTER: User doesn't exist, promote current anonymous identity

            // 1. Check if email is taken by standard auth (optional safety, or allow merge in future)
            const emailCheck = await pool.query('SELECT id FROM user_auth WHERE email = $1 AND provider = $2', [googleUser.email, 'email']);
            if (emailCheck.rows.length > 0) {
                console.warn('[DEBUG] Email already registered with password:', googleUser.email);
                return res.status(400).json({ error: 'Este email ya está registrado con contraseña. Por favor inicia sesión manual.' });
            }

            // 2. CHECK FOR IDENTITY COLLISION
            // If the current_anonymous_id is already linked to ANOTHER user account, we cannot steal it.
            // We must generate a fresh identity for this new user.
            const collisionCheck = await pool.query('SELECT id FROM user_auth WHERE anonymous_id = $1', [current_anonymous_id]);

            if (collisionCheck.rows.length > 0) {
                console.warn('[AUTH] Identity Collision detected. Preserving old user data. Generating fresh ID for new user.');

                // Generate new ID
                const crypto = await import('crypto');
                anonymousIdToUse = crypto.randomUUID();

                // Ensure it exists in anonymous_users table (Foreign Key Constraint)
                await pool.query('INSERT INTO anonymous_users (anonymous_id) VALUES ($1)', [anonymousIdToUse]);
            } else {
                anonymousIdToUse = current_anonymous_id;
            }

            // 3. Create User
            const newUser = await pool.query(
                `INSERT INTO user_auth (
                    email, 
                    provider, 
                    provider_user_id, 
                    anonymous_id, 
                    email_verified
                ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [googleUser.email, 'google', googleUser.sub, anonymousIdToUse, googleUser.email_verified]
            );
            user = newUser.rows[0];
        }

        // 3. Update Last Login
        await pool.query('UPDATE user_auth SET last_login_at = NOW() WHERE id = $1', [user.id]);

        // 4. Generate Session Token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            anonymous_id: anonymousIdToUse, // IMPORTANT: The one from DB (if login) or Current (if register)
            role: user.role || 'user'
        };

        const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({
            message: 'Autenticación con Google exitosa',
            token,
            anonymous_id: anonymousIdToUse,
            user: {
                id: user.id,
                email: user.email,
                alias: user.alias,
                provider: 'google'
            }
        });

    } catch (err) {
        logError(err, req);
        res.status(401).json({ error: 'Falló la autenticación con Google' });
    }
});

export default router;

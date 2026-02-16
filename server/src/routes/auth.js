
import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { validateAuth, signToken } from '../middleware/auth.js';
import { logError, logSuccess } from '../utils/logger.js';
import { validateAnonymousId } from '../utils/validation.js';
import { authLimiter } from '../utils/rateLimiter.js';
import { verifyGoogleToken } from '../services/googleAuth.js';
import { migrateGoogleAvatar } from '../services/avatarMigration.js';
import jwt from 'jsonwebtoken';
import { AppError, ValidationError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/AppError.js';
import { v4 as uuidv4 } from 'uuid';
import { signAnonymousId } from '../utils/crypto.js';
import { auditLog, AuditAction, ActorType } from '../services/auditService.js';
import { attachOpsRequestTelemetry } from '../utils/opsTelemetry.js';
import { getJwtSecret } from '../utils/env.js';

const router = express.Router();
router.use(attachOpsRequestTelemetry('auth'));
const JWT_SECRET = getJwtSecret();

/**
 * POST /api/auth/bootstrap
 * Deterministic identity bootstrap for anonymous sessions.
 * Returns a short-lived JWT that confers identity authority.
 */
router.post('/bootstrap', async (req, res, next) => {
    try {
        const { currentAnonymousId } = req.body;
        let anonymousId = currentAnonymousId;

        // 1. Validate or Generate ID
        if (anonymousId) {
            try {
                validateAnonymousId(anonymousId);
            } catch (e) {
                anonymousId = uuidv4();
            }
        } else {
            anonymousId = uuidv4();
        }

        // 2. Ensure ID exists in DB (Idempotent)
        await pool.query(
            'INSERT INTO anonymous_users (anonymous_id) VALUES ($1) ON CONFLICT (anonymous_id) DO NOTHING',
            [anonymousId]
        );

        // 3. Generate Session Token
        const sessionId = uuidv4();
        const issuedAt = Date.now();
        const expiresIn = 60 * 60 * 24 * 7; // 7 days in seconds
        const expiresAt = issuedAt + (expiresIn * 1000);

        const token = jwt.sign({
            anonymous_id: anonymousId,
            session_id: sessionId,
            type: 'anonymous'
        }, JWT_SECRET, { expiresIn });

        logSuccess('Identity Bootstrap', { anonymousId, sessionId });

        res.json({
            success: true,
            token,
            signature: signAnonymousId(anonymousId), // Identity Shield Signature
            session: {
                anonymousId,
                sessionId,
                issuedAt,
                expiresAt
            }
        });

    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/register
 * Links an existing anonymous_id to a new email/password account.
 */
router.post('/register', authLimiter, async (req, res, next) => {
    try {
        const { email, password, current_anonymous_id } = req.body;

        // 1. Validation
        if (!email || !password || !current_anonymous_id) {
            throw new ValidationError('Faltan datos requeridos (email, password, current_anonymous_id)');
        }

        if (password.length < 6) {
            throw new ValidationError('La contraseña debe tener al menos 6 caracteres');
        }

        // Validate UUID format
        try {
            validateAnonymousId(current_anonymous_id);
        } catch (e) {
            throw new ValidationError('ID Anónimo inválido');
        }

        // 2. Check overlap
        const existing = await pool.query('SELECT id FROM user_auth WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            throw new ConflictError('El email ya está registrado');
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

        // AUDIT LOG
        auditLog({
            action: AuditAction.USER_REGISTER,
            actorType: ActorType.ANONYMOUS,
            actorId: current_anonymous_id,
            actorRole: 'citizen',
            req,
            metadata: { method: 'email', authId: newUser.id },
            success: true
        }).catch(() => { });

        res.status(201).json({
            success: true,
            token,
            anonymous_id: current_anonymous_id,
            signature: signAnonymousId(current_anonymous_id),
            user: {
                email,
                auth_id: newUser.id
            }
        });

    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/login
 * Recovers the anonymous_id linked to the email.
 */
router.post('/login', authLimiter, async (req, res, next) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ValidationError('Email y contraseña requeridos');
        }

        // 1. Find User
        const result = await pool.query(
            'SELECT id, password_hash, anonymous_id FROM user_auth WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            throw new UnauthorizedError('Credenciales inválidas');
        }

        const user = result.rows[0];

        // 2. Verify Password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            throw new UnauthorizedError('Credenciales inválidas');
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

        // AUDIT LOG
        auditLog({
            action: AuditAction.AUTH_LOGIN,
            actorType: ActorType.ANONYMOUS,
            actorId: user.anonymous_id,
            actorRole: 'citizen',
            req,
            metadata: { method: 'password', authId: user.id },
            success: true
        }).catch(() => { });

        res.json({
            success: true,
            token,
            anonymous_id: user.anonymous_id,
            signature: signAnonymousId(user.anonymous_id),
            message: 'Login exitoso'
        });

    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/forgot-password
 * Initiates password reset flow.
 */
router.post('/forgot-password', authLimiter, async (req, res, next) => {
    try {
        const { email } = req.body;
        if (!email) throw new ValidationError('Email requerido');

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
        next(err);
    }
});

/**
 * POST /api/auth/reset-password
 * Completes password reset flow.
 */
router.post('/reset-password', authLimiter, async (req, res, next) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) {
            throw new ValidationError('Datos incompletos');
        }

        if (newPassword.length < 6) {
            throw new ValidationError('La contraseña debe tener al menos 6 caracteres');
        }

        // 1. Find User by Email
        const result = await pool.query(
            'SELECT id, reset_token, reset_token_expires FROM user_auth WHERE email = $1',
            [email]
        );
        const user = result.rows[0];

        if (!user || !user.reset_token) {
            throw new ValidationError('Token inválido o expirado');
        }

        // 2. Check Expiration
        if (new Date() > new Date(user.reset_token_expires)) {
            throw new ValidationError('Token expirado');
        }

        // 3. Verify Token Hash
        const isValid = await bcrypt.compare(token, user.reset_token);
        if (!isValid) {
            throw new ValidationError('Token inválido');
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
        next(err);
    }
});

/**
 * POST /api/auth/change-password
 * Authenticated user password change.
 */
router.post('/change-password', validateAuth, authLimiter, async (req, res, next) => {
    try {
        if (!req.user) throw new UnauthorizedError('No autenticado');
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) throw new ValidationError('Faltan datos');

        // 1. Get User Password Hash
        const result = await pool.query('SELECT password_hash FROM user_auth WHERE id = $1', [req.user.auth_id]);
        const user = result.rows[0];

        if (!user) throw new NotFoundError('Usuario no encontrado');

        // 2. Verify Current
        const isValid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!isValid) throw new UnauthorizedError('Contraseña actual incorrecta');

        // 3. Update
        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE user_auth SET password_hash = $1 WHERE id = $2', [newHash, req.user.auth_id]);

        res.json({ success: true, message: 'Contraseña actualizada' });

    } catch (err) {
        next(err);
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
            anonymous_id: req.anonymousId || req.user.anonymous_id || null
        });
    } else {
        res.json({
            authenticated: false,
            anonymous_id: req.anonymousId || null,
            message: 'Anonymous session'
        });
    }
});

/**
 * POST /api/auth/google
 * Handles Google OAuth Login/Register with Identity Promotion.
 */
router.post('/google', authLimiter, async (req, res, next) => {
    try {
        const { google_id_token, google_access_token, current_anonymous_id } = req.body;

        if ((!google_id_token && !google_access_token) || !current_anonymous_id) {
            throw new ValidationError('Token y ID anónimo requeridos');
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

            // SYNC AVATAR: Check if we need to update credential, but ALWAYS sync public profile
            if (googleUser.picture) {
                // 1. Update Credential (if changed)
                if (googleUser.picture !== user.avatar_url) {
                    await pool.query('UPDATE user_auth SET avatar_url = $1 WHERE id = $2', [googleUser.picture, user.id]);
                    user.avatar_url = googleUser.picture;
                }

                // 2. Update Public Profile (Always force sync avatar)
                // ✅ FIX: Solo actualizar avatar en LOGIN, NO alias (preservar cambios manuales)
                await pool.query(
                    'UPDATE anonymous_users SET avatar_url = $1 WHERE anonymous_id = $2',
                    [googleUser.picture, anonymousIdToUse]
                );
            }
        } else {
            // REGISTER: User doesn't exist, promote current anonymous identity

            // 1. Check if email exists (for any provider) to Link/Merge
            const emailCheck = await pool.query('SELECT * FROM user_auth WHERE email = $1', [googleUser.email]);

            if (emailCheck.rows.length > 0) {
                // ACCOUNT MERGING: User exists with this email. Link Google to it.
                user = emailCheck.rows[0];
                console.log('[AUTH] Merging existing account with Google for:', googleUser.email);

                // Update the user to include Google ID. 
                // We update 'provider' to google to enable fast lookup next time, 
                // but we DO NOT clear the password verification hash, so they can still use password if they want.
                await pool.query(
                    'UPDATE user_auth SET provider = $1, provider_user_id = $2, avatar_url = $3 WHERE id = $4',
                    ['google', googleUser.sub, googleUser.picture, user.id]
                );

                // CRITICAL FIX: Also sync avatar to public profile (anonymous_users)
                // user.anonymous_id might be null if legacy, but it should exist.
                // ✅ FIX: Solo actualizar avatar en MERGE, NO alias (preservar cambios manuales)
                if (user.anonymous_id) {
                    await pool.query(
                        'UPDATE anonymous_users SET avatar_url = $1 WHERE anonymous_id = $2',
                        [googleUser.picture, user.anonymous_id]
                    );
                }

                // Use the existing user's anonymous_id (Restore Identity)
                anonymousIdToUse = user.anonymous_id;

                // Update local user object for response
                user.provider = 'google';
                user.provider_user_id = googleUser.sub;
                user.avatar_url = googleUser.picture;
            } else {

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
                    // ✅ FIX: Sincronizar alias público desde Google
                    await pool.query(
                        'INSERT INTO anonymous_users (anonymous_id, avatar_url, alias) VALUES ($1, $2, $3)',
                        [anonymousIdToUse, googleUser.picture, googleUser.name]
                    );
                } else {
                    anonymousIdToUse = current_anonymous_id;
                    // Update existing anonymous user with avatar and alias
                    // ✅ FIX: En REGISTER, sincronizar alias SOLO si no existe
                    await pool.query(
                        `UPDATE anonymous_users 
                         SET avatar_url = $1, 
                             alias = COALESCE(alias, $2) 
                         WHERE anonymous_id = $3`,
                        [googleUser.picture, googleUser.name, anonymousIdToUse]
                    );
                }

                // 3. Create User
                const newUser = await pool.query(
                    `INSERT INTO user_auth (
                    email, 
                    provider, 
                    provider_user_id, 
                    anonymous_id, 
                    email_verified,
                    avatar_url
                ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                    [googleUser.email, 'google', googleUser.sub, anonymousIdToUse, googleUser.email_verified, googleUser.picture]
                );
                user = newUser.rows[0];
            }
        }

        // 3. Migrate Google Avatar to Supabase Storage (Enterprise Fix)
        // This prevents Tracking Prevention and CORB issues in browser
        if (googleUser.picture && anonymousIdToUse) {
            migrateGoogleAvatar(anonymousIdToUse, googleUser.picture)
                .then(migratedUrl => {
                    if (migratedUrl) {
                        console.log('[AUTH] Avatar migrated to Supabase:', migratedUrl);
                    }
                })
                .catch(err => {
                    console.error('[AUTH] Avatar migration failed:', err.message);
                });
        }

        // 4. Update Last Login
        await pool.query('UPDATE user_auth SET last_login_at = NOW() WHERE id = $1', [user.id]);

        // 5. Fetch Public Profile (SSOT: anonymous_users)
        // ✅ ENTERPRISE FIX: alias público vive SOLO en anonymous_users
        // Ya fue sincronizado en pasos anteriores (líneas 398, 422, 447, 451)
        const publicProfileResult = await pool.query(
            'SELECT alias, avatar_url FROM anonymous_users WHERE anonymous_id = $1',
            [anonymousIdToUse]
        );
        const publicProfile = publicProfileResult.rows[0] || {};

        // 5. Generate Session Token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            anonymous_id: anonymousIdToUse, // IMPORTANT: The one from DB (if login) or Current (if register)
            role: user.role || 'user',
            avatar_url: user.avatar_url
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '30d' });

        res.json({
            message: 'Autenticación con Google exitosa',
            token,
            anonymous_id: anonymousIdToUse,
            signature: signAnonymousId(anonymousIdToUse),
            user: {
                id: user.id,
                email: user.email,
                alias: publicProfile.alias ?? null,  // ✅ FIX: SSOT público, sin fallbacks dinámicos
                provider: 'google',
                avatar_url: publicProfile.avatar_url || user.avatar_url  // ✅ Priorizar SSOT público
            }
        });

    } catch (err) {
        next(err);
    }
});

export default router;

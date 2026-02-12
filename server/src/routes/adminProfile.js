import express from 'express';
import multer from 'multer';
import { supabaseAdmin } from '../utils/db.js';
import { verifyAdminToken } from '../utils/adminMiddleware.js';

const router = express.Router();

// ============================================
// MULTER CONFIGURATION
// ============================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
    },
    fileFilter: (_req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Formato no soportado. Usa JPG, PNG o WebP.'));
        }
    }
});

// ============================================
// ENDPOINTS
// ============================================

/**
 * GET /api/admin/profile
 */
router.get('/', verifyAdminToken, async (req, res) => {
    try {
        if (!req.adminUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const userId = req.adminUser.id;

        const { data: user, error: userError } = await supabaseAdmin
            .from('admin_users')
            .select('id, email, alias, role, created_at, avatar_url, totp_enabled, last_login_at')
            .eq('id', userId)
            .single();

        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { data: logs, error: logsError } = await supabaseAdmin
            .from('admin_access_logs')
            .select('*')
            .eq('admin_id', userId)
            .eq('success', true)
            .order('attempt_at', { ascending: false })
            .limit(10);

        if (logsError) {
            console.error('[AdminProfile] Error fetching logs:', logsError.message);
        }

        const response = {
            user: {
                ...user,
                two_factor_enabled: user.totp_enabled === true
            },
            sessions: logs || []
        };

        return res.json(response);

    } catch (err) {
        console.error('[AdminProfile] GET / error:', err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/admin/profile
 * Update admin profile (alias/email)
 */
router.put('/', verifyAdminToken, async (req, res) => {
    try {
        if (!req.adminUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const userId = req.adminUser.id;
        const { alias, email } = req.body;

        // Validate input
        if (alias !== undefined && (!alias.trim() || alias.trim().length < 2)) {
            return res.status(400).json({ error: 'Alias must be at least 2 characters' });
        }

        if (email !== undefined && !email.includes('@')) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Build update object
        const updates = {};
        if (alias !== undefined) updates.alias = alias.trim();
        if (email !== undefined) updates.email = email.trim();

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        const { data: user, error } = await supabaseAdmin
            .from('admin_users')
            .update(updates)
            .eq('id', userId)
            .select('id, email, alias, role, created_at, avatar_url, totp_enabled, last_login_at')
            .single();

        if (error) {
            console.error('[AdminProfile] PUT / error:', error.message);
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        return res.json({
            user: {
                ...user,
                two_factor_enabled: user.totp_enabled === true
            }
        });

    } catch (err) {
        console.error('[AdminProfile] PUT / error:', err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * PUT /api/admin/profile/avatar
 * Upload admin avatar to Supabase Storage
 */
router.put('/avatar', verifyAdminToken, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.adminUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No se recibió ningún archivo' });
        }

        const adminId = req.adminUser.id;
        const timestamp = Date.now();
        const filename = `avatar-${timestamp}.webp`;
        const filePath = `avatars/${adminId}/${filename}`;

        console.log(`[AdminProfile] Avatar upload started: adminId=${adminId}, size=${req.file.size}, mime=${req.file.mimetype}`);

        // 1. Get current avatar_url to delete old file
        const { data: currentUser } = await supabaseAdmin
            .from('admin_users')
            .select('avatar_url')
            .eq('id', adminId)
            .single();

        // 2. Upload new avatar to Supabase Storage
        const { error: uploadError } = await supabaseAdmin
            .storage
            .from('admin-avatars')
            .upload(filePath, req.file.buffer, {
                contentType: 'image/webp',
                upsert: false
            });

        if (uploadError) {
            console.error('[AdminProfile] Upload error:', uploadError.message);
            return res.status(500).json({ error: 'Error al subir la imagen' });
        }

        // 3. Get public URL with cache busting
        const { data: publicUrlData } = supabaseAdmin
            .storage
            .from('admin-avatars')
            .getPublicUrl(filePath);

        // Add timestamp for cache busting (prevents browser from showing stale images)
        const avatarUrl = `${publicUrlData.publicUrl}?v=${timestamp}`;

        // 4. Update admin_users table
        const { error: updateError } = await supabaseAdmin
            .from('admin_users')
            .update({ avatar_url: avatarUrl })
            .eq('id', adminId);

        if (updateError) {
            console.error('[AdminProfile] DB update error:', updateError.message);
            // Rollback: delete uploaded file
            await supabaseAdmin.storage.from('admin-avatars').remove([filePath]);
            return res.status(500).json({ error: 'Error al actualizar perfil' });
        }

        // 5. Delete old avatar if exists
        if (currentUser?.avatar_url) {
            try {
                const oldPath = currentUser.avatar_url.split('/admin-avatars/')[1];
                if (oldPath) {
                    await supabaseAdmin.storage.from('admin-avatars').remove([oldPath]);
                    console.log(`[AdminProfile] Old avatar deleted: ${oldPath}`);
                }
            } catch (cleanupError) {
                console.warn('[AdminProfile] Failed to delete old avatar:', cleanupError.message);
                // Non-critical error, continue
            }
        }

        console.log(`[AdminProfile] Avatar uploaded successfully: ${avatarUrl}`);

        return res.json({ avatar_url: avatarUrl });

    } catch (err) {
        console.error('[AdminProfile] PUT /avatar error:', err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * DELETE /api/admin/profile/avatar
 * Delete admin avatar from Supabase Storage
 */
router.delete('/avatar', verifyAdminToken, async (req, res) => {
    try {
        if (!req.adminUser) {
            return res.status(401).json({ error: 'Not authenticated' });
        }

        const adminId = req.adminUser.id;

        // 1. Get current avatar_url
        const { data: currentUser } = await supabaseAdmin
            .from('admin_users')
            .select('avatar_url')
            .eq('id', adminId)
            .single();

        if (!currentUser?.avatar_url) {
            return res.status(404).json({ error: 'No hay avatar para eliminar' });
        }

        // 2. Delete from Storage
        try {
            const filePath = currentUser.avatar_url.split('/admin-avatars/')[1];
            if (filePath) {
                const { error: deleteError } = await supabaseAdmin
                    .storage
                    .from('admin-avatars')
                    .remove([filePath]);

                if (deleteError) {
                    console.warn('[AdminProfile] Storage delete warning:', deleteError.message);
                    // Continue anyway to clear DB
                }
            }
        } catch (storageError) {
            console.warn('[AdminProfile] Storage cleanup error:', storageError.message);
            // Continue to clear DB
        }

        // 3. Update DB to NULL
        const { error: updateError } = await supabaseAdmin
            .from('admin_users')
            .update({ avatar_url: null })
            .eq('id', adminId);

        if (updateError) {
            console.error('[AdminProfile] DB update error:', updateError.message);
            return res.status(500).json({ error: 'Error al eliminar avatar' });
        }

        console.log(`[AdminProfile] Avatar deleted: adminId=${adminId}`);

        return res.json({ success: true });

    } catch (err) {
        console.error('[AdminProfile] DELETE /avatar error:', err.message);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;

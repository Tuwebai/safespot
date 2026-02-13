/**
 * ============================================================================
 * AVATAR MIGRATION SERVICE - Enterprise Grade
 * ============================================================================
 * 
 * Handles migration of external avatars (Google, etc.) to Supabase Storage.
 * 
 * Principles:
 * - Server-side only (no client-side fetching)
 * - Idempotent (safe to call multiple times)
 * - Automatic on Google login
 * - Fallback to default avatar on failure
 * 
 * @version 1.0 - Enterprise Implementation
 */

import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import pool from '../config/database.js';

// Initialize Supabase Admin Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[AvatarMigration] Missing Supabase credentials');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKET_NAME = 'avatars';
const FOLDER_PATH = 'google-migrated';

/**
 * Check if URL is from Google
 */
function isGoogleAvatar(url) {
    if (!url) return false;
    return url.includes('lh3.googleusercontent.com') || 
           url.includes('googleusercontent.com');
}

/**
 * Check if URL is already from Supabase Storage
 */
function isSupabaseAvatar(url) {
    if (!url) return false;
    return url.includes(supabaseUrl) || 
           url.includes('supabase.co/storage');
}

/**
 * Download image from URL (server-side)
 */
async function downloadImage(url) {
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'SafeSpot-Avatar-Migration/1.0'
            }
        });
        
        return Buffer.from(response.data);
    } catch (error) {
        console.error('[AvatarMigration] Download failed:', error.message);
        return null;
    }
}

/**
 * Upload buffer to Supabase Storage
 */
async function uploadToSupabase(buffer, fileName, contentType) {
    try {
        const filePath = `${FOLDER_PATH}/${fileName}`;
        
        // Upload with upsert (idempotent)
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, buffer, {
                contentType,
                upsert: true,
                cacheControl: '3600'
            });
        
        if (error) {
            console.error('[AvatarMigration] Upload failed:', error.message);
            return null;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);
        
        return urlData.publicUrl;
    } catch (error) {
        console.error('[AvatarMigration] Upload error:', error.message);
        return null;
    }
}

/**
 * Update avatar URL in database
 */
async function updateDatabaseAvatar(anonymousId, avatarUrl) {
    try {
        // Update anonymous_users (public profile)
        await pool.query(
            'UPDATE anonymous_users SET avatar_url = $1 WHERE anonymous_id = $2',
            [avatarUrl, anonymousId]
        );
        
        // Update user_auth (auth record)
        await pool.query(
            'UPDATE user_auth SET avatar_url = $1 WHERE anonymous_id = $2',
            [avatarUrl, anonymousId]
        );
        
        console.log('[AvatarMigration] Database updated for:', anonymousId);
        return true;
    } catch (error) {
        console.error('[AvatarMigration] Database update failed:', error.message);
        return false;
    }
}

/**
 * Main migration function - IDEMPOTENT
 * 
 * @param {string} anonymousId - User's anonymous ID
 * @param {string} googleAvatarUrl - Google avatar URL
 * @returns {Promise<string|null>} - Supabase URL or null if failed
 */
export async function migrateGoogleAvatar(anonymousId, googleAvatarUrl) {
    try {
        // Validation
        if (!anonymousId || !googleAvatarUrl) {
            console.log('[AvatarMigration] Missing parameters');
            return null;
        }
        
        // Skip if not Google URL
        if (!isGoogleAvatar(googleAvatarUrl)) {
            console.log('[AvatarMigration] Not a Google avatar, skipping');
            return googleAvatarUrl;
        }
        
        // Check if already migrated (idempotency)
        const { rows } = await pool.query(
            'SELECT avatar_url FROM anonymous_users WHERE anonymous_id = $1',
            [anonymousId]
        );
        
        const currentUrl = rows[0]?.avatar_url;
        
        if (currentUrl && isSupabaseAvatar(currentUrl)) {
            console.log('[AvatarMigration] Already migrated:', anonymousId);
            return currentUrl;
        }
        
        console.log('[AvatarMigration] Starting migration for:', anonymousId);
        
        // 1. Download from Google
        const imageBuffer = await downloadImage(googleAvatarUrl);
        if (!imageBuffer) {
            console.error('[AvatarMigration] Failed to download image');
            return null;
        }
        
        // 2. Determine file type
        const isPng = imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50;
        const ext = isPng ? 'png' : 'jpg';
        const contentType = isPng ? 'image/png' : 'image/jpeg';
        const fileName = `${anonymousId}-${Date.now()}.${ext}`;
        
        // 3. Upload to Supabase
        const supabaseUrl = await uploadToSupabase(imageBuffer, fileName, contentType);
        if (!supabaseUrl) {
            console.error('[AvatarMigration] Failed to upload');
            return null;
        }
        
        // 4. Update database
        const updated = await updateDatabaseAvatar(anonymousId, supabaseUrl);
        if (!updated) {
            console.error('[AvatarMigration] Failed to update database');
            return null;
        }
        
        console.log('[AvatarMigration] Success:', supabaseUrl);
        return supabaseUrl;
        
    } catch (error) {
        console.error('[AvatarMigration] Unexpected error:', error.message);
        return null;
    }
}

/**
 * Check if user needs avatar migration
 */
export async function needsAvatarMigration(anonymousId) {
    try {
        const { rows } = await pool.query(
            'SELECT avatar_url FROM anonymous_users WHERE anonymous_id = $1',
            [anonymousId]
        );
        
        const avatarUrl = rows[0]?.avatar_url;
        
        // Needs migration if has Google URL
        return isGoogleAvatar(avatarUrl);
    } catch (error) {
        console.error('[AvatarMigration] Check failed:', error.message);
        return false;
    }
}

export default {
    migrateGoogleAvatar,
    needsAvatarMigration
};

/* eslint-disable no-undef */
import { supabaseAdmin } from '../utils/db.js';

/**
 * Setup script for admin-avatars bucket in Supabase Storage
 * Run once: node src/scripts/setupAdminAvatarsBucket.js
 */

async function setupBucket() {
    console.log('[Setup] Creating admin-avatars bucket...');

    try {
        // 1. Create bucket
        const { data: bucketData, error: bucketError } = await supabaseAdmin
            .storage
            .createBucket('admin-avatars', {
                public: true,
                fileSizeLimit: 2097152, // 2MB
                allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
            });

        if (bucketError) {
            if (bucketError.message.includes('already exists')) {
                console.log('[Setup] Bucket already exists, skipping creation');
            } else {
                throw bucketError;
            }
        } else {
            console.log('[Setup] Bucket created successfully:', bucketData);
        }

        // 2. Verify bucket exists
        const { data: buckets, error: listError } = await supabaseAdmin
            .storage
            .listBuckets();

        if (listError) {
            throw listError;
        }

        const bucket = buckets.find(b => b.name === 'admin-avatars');
        if (bucket) {
            console.log('[Setup] ✅ Bucket verified:', bucket);
            console.log('[Setup] Public:', bucket.public);
            console.log('[Setup] File size limit:', bucket.file_size_limit);
        } else {
            console.error('[Setup] ❌ Bucket not found after creation');
        }

        console.log('\n[Setup] ✅ Setup complete!');
        console.log('[Setup] You can now upload avatars to admin-avatars bucket');

    } catch (error) {
        console.error('[Setup] ❌ Error:', error.message);
        process.exit(1);
    }
}

setupBucket();

/*
  Supabase Storage Cleanup Script
  Detects and removes orphan files not referenced in the database.
  
  Usage:
  node cleanup-storage.js --dry-run   (List candidates only - DEFAULT)
  node cleanup-storage.js --execute   (Perform deletion)
*/

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from project root (server/.env)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Requires Service Role for admin access
const BUCKET_NAME = 'report-images';
const RETENTION_HOURS = 24;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials. Ensure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function getAllDatabaseImageUrls() {
    console.log('📡 Fetching valid image URLs from database...');

    // Fetch only image_urls column
    const { data, error } = await supabase
        .from('reports')
        .select('image_urls');

    if (error) throw new Error(`DB Error: ${error.message}`);

    const validUrls = new Set();

    data.forEach(row => {
        if (Array.isArray(row.image_urls)) {
            row.image_urls.forEach(url => {
                if (url) validUrls.add(url);
            });
        }
    });

    console.log(`✅ Found ${validUrls.size} valid image references in DB.`);
    return validUrls;
}

async function getAllStorageFiles(bucket) {
    console.log(`📂 Listing files in bucket '${bucket}'...`);

    // Note: Supabase list() returns max 100 items by default.
    // We need to implement pagination properly if there are many files.
    // For this implementation, strictly flat 'root' listing.
    // If your files are in folders, you MUST implement recursive listing.

    let allFiles = [];
    let page = 0;
    // Increase limit closer to max (1000)
    const pageSize = 1000;
    let hasMore = true;

    try {
        const { data, error } = await supabase
            .storage
            .from(bucket)
            .list('', { limit: pageSize, offset: 0 }); // List root

        if (error) throw new Error(`Storage Error: ${error.message}`);

        // Check if we got something
        if (data) {
            allFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder');
        }

        return allFiles;
    } catch (err) {
        if (err.message.includes('Bucket not found')) {
            console.error(`❌ Bucket '${bucket}' not found. Check bucket name.`);
            return [];
        }
        throw err;
    }
}

async function runCleanup() {
    // Default to dry-run unless execute is explicitly passed
    const isExecute = process.argv.includes('--execute');
    const isDryRun = process.argv.includes('--dry-run') || !isExecute;

    if (isDryRun) {
        console.log('🛡️  Running in DRY RUN mode (no files will be deleted)');
    } else {
        console.log('⚠️  Running in EXECUTE mode (files WILL be deleted)');
    }

    try {
        const validUrls = await getAllDatabaseImageUrls();
        const files = await getAllStorageFiles(BUCKET_NAME);

        const orphans = [];
        const now = new Date();
        const thresholdDate = new Date(now - RETENTION_HOURS * 60 * 60 * 1000);

        for (const file of files) {
            // Construct the public URL to match DB format logic
            // CAUTION: This construction logic MUST match exactly how your app saves URLs.
            // Usually: https://[project].supabase.co/storage/v1/object/public/[bucket]/[filename]
            const fileUrlSuffix = `/storage/v1/object/public/${BUCKET_NAME}/${file.name}`;

            // We check if any valid URL ends with this suffix to be safer against domain variations
            let isReferenced = false;
            for (const validUrl of validUrls) {
                if (validUrl.endsWith(fileUrlSuffix)) {
                    isReferenced = true;
                    break;
                }
            }

            // Check age
            const fileDate = new Date(file.created_at || file.updated_at); // Fallback
            const isOldEnough = fileDate < thresholdDate;

            if (!isReferenced) {
                if (isOldEnough) {
                    orphans.push(file);
                } else {
                    console.log(`⏳ Skipping recent orphan: ${file.name} (Created: ${fileDate.toISOString()})`);
                }
            }
        }

        console.log(`\n🔍 Analysis Complete:`);
        console.log(`   Total Files in Storage: ${files.length}`);
        console.log(`   Orphan Files Detected: ${orphans.length}`);

        if (orphans.length === 0) {
            console.log('✨ System is clean. No orphans found.');
            return;
        }

        if (isDryRun) {
            console.log('\n[DRY RUN] The following files WOULD be deleted:');
            orphans.forEach(f => {
                const sizeKB = f.metadata ? (f.metadata.size / 1024).toFixed(2) : '?';
                console.log(`   - ${f.name} (${sizeKB} KB)`);
            });
            console.log('\nrun with --execute to perform deletion.');
        } else if (isExecute) {
            console.log('\n🗑️  Deleting orphan files...');
            const pathsToDelete = orphans.map(f => f.name);

            const { error } = await supabase
                .storage
                .from(BUCKET_NAME)
                .remove(pathsToDelete);

            if (error) {
                console.error('❌ Error deleting files:', error);
            } else {
                console.log(`✅ Successfully removed ${orphans.length} files.`);
            }
        }

    } catch (err) {
        console.error('🔥 Fatal Error:', err);
    }
}

runCleanup();

/**
 * Utility to generate consistent avatar URLs across the application.
 * Centrally managed to allow easy style changes (e.g., switching from Bottts to Notionists).
 */

export const getAvatarUrl = (seed: string | null | undefined, forceShow: boolean = false): string => {
    // Check if user wants to hide public avatar
    // forceShow is used for settings page/preview
    const isHidden = !forceShow && typeof window !== 'undefined' && localStorage.getItem('safespot_hide_avatar') === 'true';

    if (isHidden) {
        // Return a generic neutral avatar
        return `https://api.dicebear.com/9.x/notionists/svg?seed=hidden-user&backgroundColor=d1d5db&backgroundType=solid`;
    }

    // Fallback for missing seed
    const safeSeed = seed || 'default-avatar';

    // DOCUMENTATION: https://www.dicebear.com/styles/notionists/
    // Style: Notionists (Professional, sketch-style, illustrative)
    // We use version 9.x which is the latest stable.

    // Options:
    // - seed: Unique identifier
    // - backgroundColor: transparent (so we can control bg in CSS) or pastel
    // In our dark mode UI, transparent often works best inside our circular Avatars 
    // which might have their own bg-muted or similar.
    // However, Notionists often look better with a solid background. 
    // Let's try a subtle set of backgrounds that match the "Professional" vibe.

    const baseUrl = 'https://api.dicebear.com/9.x/notionists/svg';

    // Using a curated list of background colors (slate, zinc, stone) to feel "Civic/Pro"
    // Avoiding neon or crazy colors in the avatar itself to keep it clean.
    const params = new URLSearchParams({
        seed: safeSeed,
        backgroundColor: 'e5e7eb,d1d5db,9ca3af,f3f4f6', // Greys/Silvers
        backgroundType: 'solid',
    });

    return `${baseUrl}?${params.toString()}`;
};

/**
 * ENTERPRISE RUNTIME SAFETY: Avatar Fallback Generator
 * 
 * Generates a 2-character uppercase fallback for avatar display.
 * Prevents crashes from undefined/null/empty strings.
 * 
 * RULE #1: Defensive Access
 * NEVER access string methods (.substring, .slice, .toUpperCase) without validation.
 * 
 * @param value - The string to extract fallback from (typically anonymous_id or alias)
 * @returns Always returns a valid 2-character string, never undefined
 * 
 * @example
 * getAvatarFallback('user123')     // 'US'
 * getAvatarFallback('a')           // '??'
 * getAvatarFallback(undefined)     // '??'
 * getAvatarFallback(null)          // '??'
 * getAvatarFallback('')            // '??'
 */
export function getAvatarFallback(value: string | null | undefined): string {
    // Defensive validation: ensure value exists and has sufficient length
    if (!value || value.length < 2) {
        return '??';
    }

    // Safe extraction and transformation
    return value.substring(0, 2).toUpperCase();
}

/**
 * 🏛️ SAFE MODE: Avatar URL Resolver
 * 
 * Normaliza el acceso al avatar URL independientemente de si el backend
 * retorna snake_case (avatar_url) o camelCase (avatarUrl).
 * 
 * SSOT: Este helper centraliza la lógica de fallback de avatares.
 * 
 * @param user - Objeto usuario con posibles campos avatar_url o avatarUrl
 * @param seed - Seed para generar avatar determinístico si no hay URL
 * @returns URL del avatar o avatar determinístico
 * 
 * @example
 * resolveAvatarUrl({ avatar_url: 'https://...' }, 'user123')     // 'https://...'
 * resolveAvatarUrl({ avatarUrl: 'https://...' }, 'user123')      // 'https://...'
 * resolveAvatarUrl({}, 'user123')                                // 'https://api.dicebear.com/...'
 */
/**
 * 🏛️ DEFENSIVE: Check if URL is from Google (needs migration)
 * Google avatars are blocked by Tracking Prevention
 */
export function isGoogleAvatar(url: string): boolean {
    return url.includes('lh3.googleusercontent.com') || 
           url.includes('googleusercontent.com');
}

/**
 * 🏛️ DEFENSIVE: Check if URL is from broken Supabase storage
 * Detects URLs pointing to non-existent 'avatars' bucket
 */
function isBrokenSupabaseUrl(url: string): boolean {
    // If URL contains supabase storage but bucket was deleted
    if (url.includes('supabase.co/storage/v1/object') && url.includes('/avatars/')) {
        // These URLs will 404 - bucket doesn't exist
        return true
    }
    return false
}

/**
 * 🏛️ MIGRATE: Download Google avatar and upload via API
 * This prevents Tracking Prevention blocking
 */
export async function migrateGoogleAvatar(
    googleAvatarUrl: string,
    userId: string,
    authToken: string
): Promise<string | null> {
    try {
        // 1. Download image from Google
        const response = await fetch(googleAvatarUrl, {
            mode: 'cors',
            credentials: 'omit'
        });
        
        if (!response.ok) {
            console.warn('[Avatar] Failed to download Google avatar:', response.status);
            return null;
        }
        
        // 2. Convert to blob
        const blob = await response.blob();
        
        // 3. Create file from blob
        const fileExt = blob.type.includes('png') ? 'png' : 'jpg';
        const fileName = `google-${userId}-${Date.now()}.${fileExt}`;
        const file = new File([blob], fileName, { type: blob.type });
        
        // 4. Upload via API (backend handles Supabase)
        const { API_BASE_URL } = await import('./api');
        const formData = new FormData();
        formData.append('avatar', file);
        
        const uploadRes = await fetch(`${API_BASE_URL}/users/avatar`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        if (!uploadRes.ok) {
            console.warn('[Avatar] Failed to upload via API:', uploadRes.status);
            return null;
        }
        
        const uploadData = await uploadRes.json();
        console.log('[Avatar] Successfully migrated Google avatar:', uploadData.avatar_url);
        return uploadData.avatar_url;
        
    } catch (err) {
        console.warn('[Avatar] Migration failed:', err);
        return null;
    }
}

export function resolveAvatarUrl(
    user: { avatar_url?: string | null; avatarUrl?: string | null },
    seed: string | null | undefined
): string {
    const avatarUrl = user.avatar_url || user.avatarUrl;
    
    // 🏛️ DEFENSIVE: Skip broken Supabase URLs (missing bucket)
    if (avatarUrl && isBrokenSupabaseUrl(avatarUrl)) {
        console.warn('[Avatar] Skipping broken Supabase URL, using fallback:', avatarUrl.substring(0, 50))
        return getAvatarUrl(seed)
    }
    
    return avatarUrl || getAvatarUrl(seed);
}


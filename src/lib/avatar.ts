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


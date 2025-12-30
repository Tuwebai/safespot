/**
 * Centralized Date Utilities
 * 
 * Provides robust date formatting with BCP 47 compliance and catch-all fallbacks.
 * Prevents RangeError in production due to invalid locale tags.
 */

const DEFAULT_LOCALE = 'es-AR';

/**
 * Safely formats a date string or object.
 * 
 * @param date - Date object, ISO string, or timestamp
 * @param options - Intl.DateTimeFormatOptions
 * @param locale - BCP 47 language tag (e.g., 'es-AR')
 * @returns Formatted string or fallback formatted string
 */
export function formatDate(
    date: Date | string | number | undefined | null,
    options: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    },
    locale: string = DEFAULT_LOCALE
): string {
    if (!date) return 'N/A';

    try {
        const dateObj = date instanceof Date ? date : new Date(date);

        // Check if date is valid
        if (isNaN(dateObj.getTime())) {
            return 'Fecha inválida';
        }

        // We use a try-catch specifically for the locale tag to handle
        // environments with strict BCP 47 validation (e.g., node, modern browsers)
        try {
            return dateObj.toLocaleDateString(locale, options);
        } catch (innerError) {
            // Fallback 1: Use system default locale
            console.warn(`Locale '${locale}' failed, falling back to system default.`, innerError);
            return dateObj.toLocaleDateString(undefined, options);
        }
    } catch (outerError) {
        console.error('Fatal error in formatDate:', outerError);
        return '—'; // Final silent fallback to prevent UI crash
    }
}

/**
 * Format date for reports (includes time)
 */
export function formatReportDate(date: Date | string | number | undefined | null): string {
    return formatDate(date, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

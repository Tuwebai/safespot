
/**
 * Mentions Utility
 * Helper functions for handling @mentions in TipTap JSON content
 */

/**
 * Extract array of mentioned anonymous IDs from TipTap JSON content
 * @param {string|object} content - TipTap JSON content (string or object)
 * @returns {string[]} Array of unique anonymous IDs mentioned
 */
export function extractMentions(content) {
    if (!content) return [];

    let jsonContent = content;

    // Parse if string
    if (typeof content === 'string') {
        try {
            jsonContent = JSON.parse(content);
        } catch {
            // Not a JSON string, likely plain text or invalid
            return [];
        }
    }

    if (!jsonContent || !jsonContent.type || !jsonContent.content) {
        return [];
    }

    const mentions = new Set();

    // Recursive function to traverse TipTap node tree
    function traverse(node) {
        if (node.type === 'mention' && node.attrs && node.attrs.id) {
            mentions.add(node.attrs.id);
        }

        if (node.content && Array.isArray(node.content)) {
            node.content.forEach(child => traverse(child));
        }
    }

    traverse(jsonContent);

    return Array.from(mentions);
}

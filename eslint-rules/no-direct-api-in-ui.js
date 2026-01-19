/**
 * ESLint Custom Rule: no-direct-api-in-ui
 * 
 * OBJETIVO:
 * Prohibir imports de @/lib/api en componentes UI.
 * 
 * REGLA:
 * Archivos dentro de /components o /pages NO pueden importar de @/lib/api
 * 
 * RAZÓN:
 * Las llamadas a API deben hacerse exclusivamente vía hooks useXXXMutation,
 * que ya tienen auth guards integrados.
 * 
 * ENFORCEMENT:
 * Build debe FALLAR si se viola esta regla.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prohibit direct API imports in UI components',
            category: 'Security',
            recommended: true,
        },
        messages: {
            noDirectApiInUI:
                '🔴 SECURITY BYPASS: No podés importar API directamente en componentes UI. ' +
                'Usá hooks como useXXXMutation desde /hooks/queries/. ' +
                'Esto previene bypasses de Auth Guards. Ver README_AUTH_GUARDS.md',
        },
        schema: [],
    },

    create(context) {
        return {
            ImportDeclaration(node) {
                const source = node.source.value;
                const filename = context.getFilename();

                // Detectar si estamos en /components o /pages
                const isUIFile =
                    filename.includes('/components/') ||
                    filename.includes('\\components\\') ||
                    filename.includes('/pages/') ||
                    filename.includes('\\pages\\');

                // Detectar import de @/lib/api
                const isApiImport =
                    source === '@/lib/api' ||
                    source.startsWith('@/lib/api/');

                // Si es archivo UI y importa API → ERROR
                if (isUIFile && isApiImport) {
                    context.report({
                        node,
                        messageId: 'noDirectApiInUI',
                    });
                }
            },
        };
    },
};

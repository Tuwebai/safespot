/**
 * ESLint Custom Rule: no-unguarded-mutation
 * 
 * OBJETIVO:
 * Detectar useMutation sin useAuthGuard en el mismo archivo.
 * 
 * REGLA:
 * Si un archivo importa useMutation pero NO importa useAuthGuard,
 * debe mostrar un error de lint.
 * 
 * ENFORCEMENT:
 * Build debe FALLAR si se viola esta regla.
 */

module.exports = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Enforce useAuthGuard in files that use useMutation',
            category: 'Security',
            recommended: true,
        },
        messages: {
            missingAuthGuard:
                '🔴 SECURITY: Esta mutation DEBE usar useAuthGuard(). ' +
                'Importá "import { useAuthGuard } from \'@/hooks/useAuthGuard\'" ' +
                'y llamá checkAuth() en mutationFn. Ver README_AUTH_GUARDS.md',
        },
        schema: [],
    },

    create(context) {
        let hasUseMutation = false;
        let hasUseAuthGuard = false;
        let useMutationNode = null;

        return {
            ImportDeclaration(node) {
                const source = node.source.value;

                // Detectar import de useMutation
                if (
                    source === '@tanstack/react-query' ||
                    source === 'react-query'
                ) {
                    const hasUseMutationSpecifier = node.specifiers.some(
                        (spec) =>
                            spec.type === 'ImportSpecifier' &&
                            spec.imported.name === 'useMutation'
                    );

                    if (hasUseMutationSpecifier) {
                        hasUseMutation = true;
                        useMutationNode = node;
                    }
                }

                // Detectar import de useAuthGuard
                if (source === '@/hooks/useAuthGuard') {
                    const hasUseAuthGuardSpecifier = node.specifiers.some(
                        (spec) =>
                            spec.type === 'ImportSpecifier' &&
                            spec.imported.name === 'useAuthGuard'
                    );

                    if (hasUseAuthGuardSpecifier) {
                        hasUseAuthGuard = true;
                    }
                }
            },

            'Program:exit'() {
                // Al final del archivo, verificar
                if (hasUseMutation && !hasUseAuthGuard) {
                    // EXCEPCIÓN: Queries hooks de solo lectura (useQuery solamente)
                    // Solo reportar si es un archivo de mutations
                    const filename = context.getFilename();

                    // Si el archivo está en /hooks/queries, es probable que tenga mutations
                    // Si importa useMutation, DEBE tener useAuthGuard
                    if (filename.includes('/hooks/queries/') || filename.includes('\\hooks\\queries\\')) {
                        context.report({
                            node: useMutationNode,
                            messageId: 'missingAuthGuard',
                        });
                    }
                }
            },
        };
    },
};

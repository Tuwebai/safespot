/**
 * ESLint Plugin: local-rules
 * 
 * Carga las custom rules de seguridad para Auth Guards
 */

const noUnguardedMutation = require('./no-unguarded-mutation');
const noDirectApiInUi = require('./no-direct-api-in-ui');

module.exports = {
    rules: {
        'no-unguarded-mutation': noUnguardedMutation,
        'no-direct-api-in-ui': noDirectApiInUi,
    },
};

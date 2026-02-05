import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../src');

const PROHIBITED_PATTERNS = [
    /SELECT\s+\*/i,
    /SELECT\s+[a-z_]+\.\*/i
];

const EXCLUDED_FILES = [
    'audit_db.js',
    'check_reports_structure.sql',
    'debug_direct_db.js'
];

function scanDirectory(dir) {
    let violations = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            violations = violations.concat(scanDirectory(fullPath));
        } else if (file.endsWith('.js') && !EXCLUDED_FILES.includes(file)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                PROHIBITED_PATTERNS.forEach(pattern => {
                    if (pattern.test(line)) {
                        // Special exclusion for spreads that are authorized (e.g. state management)
                        if (line.includes('// authorized-spread')) return;

                        violations.push({
                            file: path.relative(rootDir, fullPath),
                            line: index + 1,
                            content: line.trim(),
                            pattern: pattern.toString()
                        });
                    }
                });
            });
        }
    }
    return violations;
}

console.log('🔍 Starting Architectural Blindaje Scan (SELECT * Prohibition)...');
const violations = scanDirectory(rootDir);

if (violations.length > 0) {
    console.error(`\n❌ ARCHITECTURAL VIOLATION: Prohibited patterns detected in ${violations.length} locations!`);
    violations.forEach(v => {
        console.error(`   - ${v.file}:${v.line} [${v.pattern}] -> ${v.content}`);
    });
    console.error('\n💡 Enterprise Clean Rule: Selective projections are mandatory. Do not use SELECT *.');
    process.exit(1);
} else {
    console.log('✅ Blindaje level: ENTERPRISE CLEAN. No wildcard projections found.');
    process.exit(0);
}

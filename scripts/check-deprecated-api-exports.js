#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const DEPRECATED_EXPORTS = [
  'Badge',
  'CategoryStats',
  'CreateVoteData',
  'GamificationBadge',
  'GamificationSummary',
  'GeocodeResult',
  'NewBadge',
  'NotificationMetadata',
  'PaginatedComments',
  'TransparencyAction',
  'UserZoneData',
  'Vote',
  'ZoneSafetyData',
  'ChatRoom',
  'votesApi',
];

const MODULE_MATCHER = /^@\/lib\/api(?:\/index)?$/;
const ROOT = process.cwd();

function getCandidateFiles() {
  const rg = spawnSync(
    'rg',
    ['-n', '--files-with-matches', 'from\\s+[\'"]@/lib/api(?:/index)?[\'"]', 'src', 'tests'],
    { encoding: 'utf8', cwd: ROOT }
  );

  // rg returns 1 when no matches. That's not an error for this check.
  if (rg.status !== 0 && rg.status !== 1) {
    console.error('[check:api-exports] Error ejecutando rg:', rg.stderr || rg.stdout);
    process.exit(2);
  }

  return (rg.stdout || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function inspectImports(filePath) {
  const fullPath = path.join(ROOT, filePath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const sf = ts.createSourceFile(fullPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const findings = [];

  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !st.importClause || !ts.isStringLiteral(st.moduleSpecifier)) {
      continue;
    }

    if (!MODULE_MATCHER.test(st.moduleSpecifier.text)) continue;

    const clause = st.importClause;
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const el of clause.namedBindings.elements) {
        const imported = el.propertyName ? el.propertyName.text : el.name.text;
        if (!DEPRECATED_EXPORTS.includes(imported)) continue;
        const line = sf.getLineAndCharacterOfPosition(el.getStart()).line + 1;
        findings.push({ file: filePath, line, name: imported });
      }
    }
  }

  return findings;
}

const candidates = getCandidateFiles();
const violations = candidates.flatMap(inspectImports);

if (violations.length > 0) {
  console.error('[check:api-exports] Imports prohibidos de exports deprecated detectados:');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} -> ${v.name}`);
  }
  process.exit(1);
}

console.log('[check:api-exports] OK - no hay imports de deprecated exports desde @/lib/api');

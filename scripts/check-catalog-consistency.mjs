#!/usr/bin/env node
'use strict';

// Consistency checker for the canonical code catalog (issue #69).
//
// One source of truth: schema/code-catalog.json, the id -> {family, judgment, title,
// severity} map extracted from reference.md by scripts/build-code-catalog.mjs
// (reference.md is the catalog superset, ADR 0002). This script fails CI when:
//
//   1. code-catalog.json is stale: re-extracting from reference.md yields a different
//      map than the committed file (fix: run `node scripts/build-code-catalog.mjs`).
//   2. SKILL.md disagrees with the map: a code in SKILL.md's family tables is absent
//      from the map, or - in the Python Step 2 table - is placed under a different
//      letter family than reference.md declares.
//
// "family" is the letter A-E reference.md declares per code (or Diagnostic / catalog-sync
// / null where reference.md assigns no single letter). The docs F1-F8 taxonomy is a
// coarser conceptual axis, NOT 1:1 with these letter families, so the letter is the
// verifiable per-code fact this map records; the F-mapping lives in the docs taxonomy.
//
// CROSS-REPO SCOPE (issue #69, ADR 0002): the sibling scanners falsegreen,
// falsegreen-js, and robotframework-falsegreen live in other repositories and are NOT
// present at this repo's CI time, so this script cannot diff their emitted codes here.
// schema/code-catalog.json is the canonical id -> family -> title -> severity source
// those repos should validate their own code sets against; per-repo enforcement is a
// documented follow-up, not automated by this checker.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalog } from './build-code-catalog.mjs';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (f) => fs.readFileSync(path.join(PKG_ROOT, f), 'utf8');

const errors = [];
const fail = (m) => errors.push(m);

// 1. code-catalog.json in sync with reference.md.
const committed = JSON.parse(read('schema/code-catalog.json')).codes;
const fresh = buildCatalog(read('reference.md'));
const allIds = new Set([...Object.keys(committed), ...Object.keys(fresh)]);
for (const id of [...allIds].sort()) {
  const a = committed[id];
  const b = fresh[id];
  if (!a) { fail(`schema/code-catalog.json: missing ${id} (reference.md defines it) - run build-code-catalog.mjs`); continue; }
  if (!b) { fail(`schema/code-catalog.json: ${id} no longer in reference.md - run build-code-catalog.mjs`); continue; }
  for (const field of ['family', 'judgment', 'title', 'severity']) {
    if (a[field] !== b[field]) {
      fail(`schema/code-catalog.json: ${id}.${field} = ${JSON.stringify(a[field])} but reference.md says ${JSON.stringify(b[field])} - run build-code-catalog.mjs`);
    }
  }
}

// 2. SKILL.md family tables agree with the map.
// Rows: `| A — never checks | C1, C2, ... | what to look for |`. First cell = letter
// before an em-dash/hyphen; second cell = comma-separated codes. Every listed code must
// exist in the map. Letter equality is enforced ONLY in the Python Step 2 table (its A-E
// letters ARE the reference.md families); the Step 2b TS/JS table uses its own ad-hoc
// letter grouping ("D - duplicate", "F - query without assert"), so existence is checked
// there, not the letter. Codes with no reference.md letter are existence-checked only.
const skillLines = read('SKILL.md').split(/\r?\n/);
const pyStart = skillLines.findIndex((l) => /^###\s+Step 2:\s+Apply the full Python/.test(l));
const tsStart = skillLines.findIndex((l) => /^###\s+Step 2b:/.test(l));
const ROW_RE = /^\|\s*([A-Z])\s*[—-]\s*[^|]*\|\s*([^|]+)\|/;
const CODE_TOKEN = /\b(CC|C\d+[a-z]?|JS\d+|D\d+|M\d+)\b/g;
skillLines.forEach((line, idx) => {
  const m = line.match(ROW_RE);
  if (!m) return;
  const letter = m[1];
  const codes = m[2].match(CODE_TOKEN) || [];
  const inPythonTable = pyStart >= 0 && idx > pyStart && (tsStart < 0 || idx < tsStart);
  for (const id of codes) {
    const entry = committed[id];
    if (!entry) {
      fail(`SKILL.md: family table lists ${id}, absent from schema/code-catalog.json (reference.md superset)`);
      continue;
    }
    if (inPythonTable && /^[A-E]$/.test(entry.family) && entry.family !== letter) {
      fail(`SKILL.md Step 2 (Python): places ${id} in family ${letter}, but reference.md declares family ${entry.family}`);
    }
  }
});

if (errors.length > 0) {
  process.stderr.write(errors.map((e) => `error: ${e}`).join('\n') + '\n');
  process.exit(1);
}
process.stdout.write(`catalog consistency OK (${Object.keys(committed).length} codes; reference.md == code-catalog.json; SKILL.md agrees)\n`);

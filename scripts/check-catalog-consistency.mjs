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

// 3. The documented load path reaches the semantic catalog.
// The S-series is language-agnostic and defined only in the reference.md section that sits
// BEFORE the per-language sections. An instruction that says "load the matching language
// section" therefore routes past all of it, and the tight-budget fallback fragment only
// carried 6 of the 19 codes (issue #168). Assertions 1 and 2 above answer "is the catalog
// self-consistent"; this one answers "does the documented reading path reach it".
const SEMANTIC_SECTION = 'Patterns only the semantic pass can catch';
const HOSTS = [
  'SKILL.md',
  'skills/falsegreen-skill/SKILL.md',
  'AGENTS.md',
  'GEMINI.md',
  'llm.md',
  'contexts/codex.md',
  'contexts/cursor.md',
];
const semantic = Object.keys(committed).filter((id) => committed[id].family === 'Semantic');
if (semantic.length === 0) fail('schema/code-catalog.json has no family="Semantic" codes - extraction broke');

// 3a. The tight-budget path must carry every semantic code, since it replaces the prose.
const floor = read('fragments/semantic-cases-compact.md');
const missing = semantic.filter((id) => !new RegExp(`^\\|\\s*${id}\\s*\\|`, 'm').test(floor));
if (missing.length > 0) {
  fail(`fragments/semantic-cases-compact.md is the documented tight-budget load but omits ${missing.length} of ${semantic.length} semantic codes: ${missing.join(', ')}`);
}

// 3b. reference.md must still define the whole S-series in that one shared section, so a
// language-agnostic load can reach it.
const refSections = read('reference.md').split(/^## /m);
const semanticBody = refSections.find((s) => s.startsWith(SEMANTIC_SECTION));
if (!semanticBody) {
  fail(`reference.md no longer has a "## ${SEMANTIC_SECTION}" section - update SEMANTIC_SECTION here`);
} else {
  const strayed = semantic.filter((id) => !new RegExp(`\\*\\*${id}\\s`).test(semanticBody));
  if (strayed.length > 0) {
    fail(`reference.md "${SEMANTIC_SECTION}" no longer defines ${strayed.join(', ')} - a semantic code moved into a language section and is now unreachable language-agnostically`);
  }
}

// Markdown formatting hides the tokens the two assertions below match on: `S1`-`S21`,
// **S1**-**S21**, and a soft wrap between S1 and the dash all read as plain S1-S21 to a human
// and as a non-match to a regex. Normalize a working copy once instead of special-casing
// backticks, which would only shrink the same blind spot.
const flatten = (s) => s.replace(/[`*_]/g, '').replace(/\s+/g, ' ');
// Normalizes internally so no caller can pass raw text and silently lose the normalization.
const hasEverySemanticRow = (text) => {
  const flat = flatten(text);
  return semantic.every((id) => new RegExp(`\\|\\s*${id}\\s*\\|`).test(flat));
};

// 3c. Every host that routes through reference.md must reach the S-series by one of the two
// sanctioned paths: carry the rows inline, or name the shared section so the load lands on it.
// ponytail: this proves the definition is REACHABLE, not that the surrounding sentence is
// imperative. "The S-series lives in reference.md" passes here and still leaves a host that
// never tells the model to load it. No static check reaches that; a reviewer confirms the
// sentence commands rather than describes (see .github/pull_request_template.md).
for (const host of HOSTS) {
  let text;
  try {
    text = read(host);
  } catch {
    fail(`${host}: missing host doc - update HOSTS here`);
    continue;
  }
  if (!/reference\.md/.test(text)) continue;
  const flat = flatten(text);
  if (!flat.includes(SEMANTIC_SECTION) && !hasEverySemanticRow(text)) {
    fail(`${host}: does not reach the S-series by either path - it neither names the "${SEMANTIC_SECTION}" section nor carries a row for all ${semantic.length} codes, so a run following it never sees ${semantic.join('/')}`);
  }
}

// 3d. No doc may advertise an S-range that implies codes the catalog does not define. The
// catalog is not contiguous (it ends S18, then S21), so only a range closing a contiguous
// run from S1 is honest: "S1-S18 and S21" is legal, a bare "S1-S21" is not.
const sNums = semantic.map((id) => Number(id.slice(1))).sort((x, y) => x - y);
let contiguousEnd = 0;
for (const n of sNums) {
  if (n === contiguousEnd + 1) contiguousEnd = n;
  else break;
}
// CHANGELOG.md is deliberately absent: it is history, and its entries quote the retired
// `S1-S16`/`S1-S21` forms on purpose while describing the releases that carried them.
// .cursor/rules/*.mdc and dist/ are absent too - both are generated verbatim from sources
// already in this list, and sync-cursor-mdc --check / build:targets keep them honest.
for (const doc of [...HOSTS, 'README.md', 'STATUS.md', 'reference.md', 'models.yaml', 'docs/architecture.md']) {
  let text;
  try {
    text = flatten(read(doc));
  } catch {
    continue;
  }
  for (const m of text.matchAll(/\bS1\s*[-–—]\s*S?(\d+)\b/g)) {
    if (Number(m[1]) !== contiguousEnd) {
      fail(`${doc}: advertises "${m[0]}", which implies codes the catalog does not define - the contiguous run ends at S${contiguousEnd}, so spell the rest out (for example "S1-S${contiguousEnd} and S${sNums[sNums.length - 1]}")`);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(errors.map((e) => `error: ${e}`).join('\n') + '\n');
  process.exit(1);
}
process.stdout.write(`catalog consistency OK (${Object.keys(committed).length} codes; reference.md == code-catalog.json; SKILL.md agrees; all ${semantic.length} semantic codes reachable from every host, by inline rows or by the named shared section)\n`);

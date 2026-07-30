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

// 2b. The family tables are COMPLETE, in every host that carries one.
// Assertion 2 above checks the other direction: every code a table lists exists in the
// catalog. It never checked that every catalog code reaches a table, and it only looked at
// SKILL.md, so GEMINI.md's table drifted 12 codes behind (C2c, C6c, C8b, C41, C49-C52,
// C55-C57, C59) while its own text promised "scan against all falsegreen families". Nothing
// caught it: not CI, not the review, not a reader. A host that claims the full Python pass
// has to list every letter-family code the catalog defines.
//
// Two tables carry that promise, not one. A default-pass code belongs in the letter-family
// rows; an opt-in code (severity=OFF, or the Diagnostic family) belongs in the "Optional /
// diagnostic (opt-in)" row, whose first cell is prose and so never matches ROW_RE. Requiring
// OFF codes in the family rows reported C22 missing from all three hosts when every host
// documents it, in the row meant for it. Both destinations are checked, so neither table can
// quietly drop a code.
//
// The required set is every code the Python pass owns, NOT every code carrying a letter.
// reference.md declares letters under "#### Family <Letter>" only; the 16 codes under
// "#### Family additions (catalog sync)" get family="catalog-sync", so a letter-only set
// silently excused them - and with them C48, absent from all three hosts, plus D7/D8 absent
// from two. The letter-placement assertion above stays restricted to A-E, since reference.md
// declares no letter for the additions: presence is checkable there, placement is not.
const FAMILY_HOSTS = ['SKILL.md', 'GEMINI.md', 'AGENTS.md'];
const OPT_IN_RE = /^\|[^|]*opt-in[^|]*\|\s*([^|]+)\|/i;
const PYTHON_PASS_FAMILY = /^([A-E]|catalog-sync)$/;
const isOptIn = (id) => committed[id].severity === 'OFF' || committed[id].family === 'Diagnostic';
const letterCodes = Object.keys(committed).filter((id) => PYTHON_PASS_FAMILY.test(committed[id].family || '') && !isOptIn(id));
const optInCodes = Object.keys(committed).filter((id) => isOptIn(id));
for (const host of FAMILY_HOSTS) {
  let text;
  try {
    text = read(host);
  } catch {
    fail(`${host}: missing host doc - update FAMILY_HOSTS here`);
    continue;
  }
  const listed = new Set();
  const optInListed = new Set();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ROW_RE);
    if (m) for (const id of m[2].match(CODE_TOKEN) || []) listed.add(id);
    const o = line.match(OPT_IN_RE);
    if (o) for (const id of o[1].match(CODE_TOKEN) || []) optInListed.add(id);
  }
  if (listed.size === 0) continue; // host carries no family table at all
  const absent = letterCodes.filter((id) => !listed.has(id));
  if (absent.length > 0) {
    fail(`${host}: family tables omit ${absent.length} of ${letterCodes.length} default-pass Python codes (${absent.join(', ')}), so a Python run following this host misses them`);
  }
  const absentOptIn = optInCodes.filter((id) => !optInListed.has(id) && !listed.has(id));
  if (absentOptIn.length > 0) {
    fail(`${host}: omits ${absentOptIn.length} opt-in code(s) (${absentOptIn.join(', ')}) from both the family tables and the opt-in row, so a diagnostic pass following this host misses them`);
  }
}

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

// Severity is part of the finding, not decoration: reference.md fixes S17 at HIGH and S15,
// S16, S18 and S21 at LOW. The compact table is hand-maintained, so without this a
// compact-only host could promote a LOW code or demote a HIGH one and still follow every
// documented instruction. Column 3 of each row must match the catalog.
for (const id of semantic) {
  const row = floor.match(new RegExp(`^\\|\\s*${id}\\s*\\|([^|]*)\\|([^|]*)\\|`, 'm'));
  if (!row) continue; // already reported by the omission check above
  const stated = row[2].trim();
  const expected = committed[id].severity || '-';
  if (stated !== expected) {
    fail(`fragments/semantic-cases-compact.md: ${id} is severity "${stated}" but reference.md fixes it at "${expected}" - a compact-only host would emit the wrong severity`);
  }
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
  // No `mentions reference.md` guard: a host that drops the mention while also
  // omitting the rows is the regression this asserts against, and a guard on the
  // mention would skip exactly that case.
  const flat = flatten(text);
  if (!flat.includes(SEMANTIC_SECTION) && !hasEverySemanticRow(text)) {
    fail(`${host}: does not reach the S-series by either path - it neither names the "${SEMANTIC_SECTION}" section nor carries a row for all ${semantic.length} codes, so a run following it never sees ${semantic.join('/')}`);
  }
}

// 3e. The S-series has to live INSIDE the ordered step sequence, not beside it.
// This is the narrow, checkable half of mandate-versus-mention. It cannot tell an imperative
// from a description - nothing static can - but it can tell WHERE the S-series sits, and
// location was the actual defect both times a reviewer caught this: four hosts named the
// S-codes in a preamble or scoped them to a language-specific step, so an agent could follow
// every numbered step without ever screening them. Step 4 is where J1-J6 runs, so an S-code
// mention has to appear between the Step 4 heading and the Step 5 heading.
// ponytail: a host with no Step 4 heading is skipped rather than guessed at; those route to
// another host's protocol (contexts/codex.md -> AGENTS.md).
const STEP4 = /^\**#*\s*\**Step 4\b/m;
const STEP5 = /^\**#*\s*\**Step 5\b/m;
for (const host of HOSTS) {
  let text;
  try {
    text = read(host);
  } catch {
    continue;
  }
  const open = text.match(STEP4);
  if (!open) continue;
  const body = text.slice(open.index);
  const close = body.slice(1).match(STEP5);
  const step4 = close ? body.slice(0, close.index + 1) : body;
  if (!/\bS1\b|\bS-series\b|\bS-code/.test(step4)) {
    fail(`${host}: Step 4 never mentions the S-series, so an agent can follow every numbered step without screening S1-S18 and S21 - the semantic codes belong inside Step 4, not in a preamble or a language-scoped step`);
  }
}

// 3d. A doc may not advertise a range that implies codes the catalog does not define. The
// invariant is per-id, not per-series: every id in the inclusive range has to exist. That
// keeps an honest subset range legal ("D1-D6" when D1..D6 all exist) and rejects a range
// that spans a hole, whatever the series. No series here is gap-free: S skips 19 and 20, C
// skips ten ids below C59, JS skips seven below JS31. A range is the wrong shape for those,
// so the docs state a count or enumerate.
//
// This is not cosmetic. Codex's review of this very PR reported "the TS/JS summary lacks
// JS14-JS31" - JS14 does not exist. It read the repo's own false range and inherited the
// error, so a stale range corrupts a reader's model of the catalog, human or machine.
//
// CHANGELOG.md is deliberately absent: it is history, and its entries quote the retired
// forms on purpose while describing the releases that carried them. .cursor/rules/*.mdc and
// dist/ are absent too - both are generated verbatim from sources already in this list, and
// sync-cursor-mdc --check / build:targets keep them honest.
// The endpoint prefix is captured, not discarded. It used to be a non-capturing group, so
// `S1-C18` consumed the C, threw it away, and then validated S1..S18 as a clean range: a
// cross-series typo passed the gate that exists to reject impossible ranges.
// Endpoints may carry a lowercase suffix. Without `[a-z]?` the trailing \b refuses to match
// before a letter, so `C1-C11a` and `R1-R8b` were skipped entirely - the two shapes most
// likely to be written, and the ones the gap check below explicitly knows how to handle.
const SERIES = /\b([A-Z]{1,2})(\d+)[a-z]?\s*[-–—]\s*([A-Z]{1,2})?(\d+)[a-z]?\b/g;
for (const doc of [...HOSTS, 'README.md', 'STATUS.md', 'reference.md', 'models.yaml', 'docs/architecture.md']) {
  let text;
  try {
    text = flatten(read(doc));
  } catch {
    continue;
  }
  for (const [range, prefix, fromRaw, endPrefix, toRaw] of text.matchAll(SERIES)) {
    const from = Number(fromRaw);
    const to = Number(toRaw);
    if (endPrefix && endPrefix !== prefix) {
      fail(`${doc}: advertises "${range}", whose endpoints are in different series - a range cannot start in ${prefix} and end in ${endPrefix}`);
      continue;
    }
    // A suffixed id counts as the number being defined: the catalog spells C11a and R8b
    // with no bare C11 or R8, and a range covering 11 is not lying about C11a.
    const defines = (n) => Object.hasOwn(committed, `${prefix}${n}`) || Object.keys(committed).some((id) => new RegExp(`^${prefix}${n}[a-z]$`).test(id));
    // Only ranges over a series the catalog actually owns, and only ascending ones.
    if (to <= from || !defines(from)) continue;
    const absent = [];
    for (let n = from; n <= to; n++) if (!defines(n)) absent.push(`${prefix}${n}`);
    if (absent.length > 0) {
      fail(`${doc}: advertises "${range}" but the catalog does not define ${absent.join(', ')} - state a count or enumerate instead of spanning the gap`);
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(errors.map((e) => `error: ${e}`).join('\n') + '\n');
  process.exit(1);
}
process.stdout.write(`catalog consistency OK (${Object.keys(committed).length} codes; reference.md == code-catalog.json; SKILL.md agrees; all ${semantic.length} semantic codes reachable from every host, by inline rows or by the named shared section)\n`);

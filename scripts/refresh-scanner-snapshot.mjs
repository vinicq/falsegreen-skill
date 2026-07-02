#!/usr/bin/env node
'use strict';

// Regenerates schema/scanner-codes.json (the pinned sibling-scanner snapshot that
// check-scanner-coverage.mjs diffs the catalog against) from live checkouts of the
// three sibling repos, so the refresh stops being a hand-edit that silently lags
// (issue #118). It reads each sibling's version and its emitted code set straight
// from the source of truth:
//
//   falsegreen        src/falsegreen/scanner.py         CASES = { "C1": (...), ... }  + __version__ / pyproject
//   falsegreen-robot  src/falsegreen_robot/scanner.py   CASES = { ... }               + pyproject
//   falsegreen-js     src/cases.ts                      export const CASES = { C2: {...}, ... } + package.json
//
// Paths are configurable, never hardcoded absolute. Resolution order per sibling:
//   1. --falsegreen=PATH / --falsegreen-robot=PATH / --falsegreen-js=PATH
//   2. env FALSEGREEN_PY_PATH / FALSEGREEN_ROBOT_PATH / FALSEGREEN_JS_PATH
//   3. ../<repo> next to this repo (the common local checkout layout)
//
// Usage:
//   node scripts/refresh-scanner-snapshot.mjs                 # write the snapshot from ../ siblings
//   node scripts/refresh-scanner-snapshot.mjs --check         # exit 1 if the snapshot is stale (CI-friendly, no write)
//   node scripts/refresh-scanner-snapshot.mjs --falsegreen-js=/path/to/falsegreen-js
//   FALSEGREEN_PY_PATH=/path node scripts/refresh-scanner-snapshot.mjs
//
// A sibling absent on disk is skipped with a warning and its existing snapshot entry
// is kept as-is, so the script degrades gracefully off local checkouts and never
// blanks a scanner just because you did not clone it. --check ignores skipped siblings.
// After a refresh, run `npm run validate` so check-scanner-coverage confirms the
// catalog still covers every emitted code.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SNAPSHOT = path.join(PKG_ROOT, 'schema', 'scanner-codes.json');
const SIBLINGS_ROOT = path.resolve(PKG_ROOT, '..');

const SIBLINGS = [
  {
    key: 'falsegreen',
    arg: 'falsegreen',
    env: 'FALSEGREEN_PY_PATH',
    dir: 'falsegreen',
    source: 'src/falsegreen/scanner.py',
    kind: 'py',
    versionFrom: ['pyproject.toml'],
  },
  {
    key: 'falsegreen-robot',
    arg: 'falsegreen-robot',
    env: 'FALSEGREEN_ROBOT_PATH',
    dir: 'falsegreen-robot',
    source: 'src/falsegreen_robot/scanner.py',
    kind: 'py',
    versionFrom: ['pyproject.toml'],
  },
  {
    key: 'falsegreen-js',
    arg: 'falsegreen-js',
    env: 'FALSEGREEN_JS_PATH',
    dir: 'falsegreen-js',
    source: 'src/cases.ts',
    kind: 'js',
    versionFrom: ['package.json'],
  },
];

function parseArgs(argv) {
  const out = { check: false, paths: {} };
  for (const a of argv) {
    if (a === '--check') out.check = true;
    else {
      const m = a.match(/^--([a-z-]+)=(.+)$/);
      if (m) out.paths[m[1]] = m[2];
    }
  }
  return out;
}

function resolveRepoDir(sib, cliPaths) {
  return cliPaths[sib.arg] || process.env[sib.env] || path.join(SIBLINGS_ROOT, sib.dir);
}

function readVersion(repoDir, files) {
  for (const f of files) {
    const p = path.join(repoDir, f);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    if (f.endsWith('.json')) return JSON.parse(text).version;
    // pyproject.toml: `version = "0.9.1"` under [project] or [tool.poetry]
    const m = text.match(/^\s*version\s*=\s*["']([^"']+)["']/m);
    if (m) return m[1];
  }
  return null;
}

// Slice the balanced {...} block that follows the first occurrence of `CASES`.
function casesBlock(src) {
  const at = src.indexOf('CASES');
  if (at < 0) throw new Error('no CASES table found');
  const open = src.indexOf('{', at);
  if (open < 0) throw new Error('no opening brace after CASES');
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i);
  }
  throw new Error('unbalanced CASES braces');
}

// Python/Robot dict: keys are quoted, `  "C2b": (`. In-order, deduped.
function extractPy(src) {
  const block = casesBlock(src);
  const re = /^\s*"([A-Za-z0-9_]+)"\s*:/gm;
  return dedupe(block, re);
}

// TS map: `export const CASES: Record<...> = {`, top-level keys are bare idents at
// 2-space indent, `  C2b: {`. Nested object keys are deeper, so anchor on 2 spaces.
function extractJs(src) {
  const block = casesBlock(src);
  const re = /^ {2}([A-Za-z0-9_]+)\s*:\s*\{/gm;
  return dedupe(block, re);
}

function dedupe(block, re) {
  const seen = new Set();
  const codes = [];
  let m;
  while ((m = re.exec(block))) {
    if (!seen.has(m[1])) { seen.add(m[1]); codes.push(m[1]); }
  }
  return codes;
}

function extractCodes(sib, repoDir) {
  const src = fs.readFileSync(path.join(repoDir, sib.source), 'utf8');
  return sib.kind === 'js' ? extractJs(src) : extractPy(src);
}

function main() {
  const { check, paths } = parseArgs(process.argv.slice(2));
  const current = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  const next = { $comment: current.$comment };

  const warnings = [];
  let changed = false;

  for (const sib of SIBLINGS) {
    const repoDir = resolveRepoDir(sib, paths);
    const sourcePath = path.join(repoDir, sib.source);
    if (!fs.existsSync(sourcePath)) {
      warnings.push(`skipped ${sib.key}: ${sib.source} not found under ${repoDir} (kept existing snapshot entry)`);
      next[sib.key] = current[sib.key];
      continue;
    }
    const version = readVersion(repoDir, sib.versionFrom) || current[sib.key]?.version || null;
    const codes = extractCodes(sib, repoDir);
    next[sib.key] = { version, codes };

    const prev = current[sib.key] || {};
    if (prev.version !== version || JSON.stringify(prev.codes) !== JSON.stringify(codes)) {
      changed = true;
    }
  }

  for (const w of warnings) process.stderr.write(`warning: ${w}\n`);

  const serialized = JSON.stringify(next, null, 2) + '\n';

  if (check) {
    const currentSerialized = fs.readFileSync(SNAPSHOT, 'utf8');
    if (serialized !== currentSerialized) {
      process.stderr.write(
        'error: schema/scanner-codes.json is stale vs the live sibling checkouts. ' +
        'Run: node scripts/refresh-scanner-snapshot.mjs\n'
      );
      process.exit(1);
    }
    process.stdout.write('scanner snapshot is in sync with the sibling checkouts\n');
    return;
  }

  fs.writeFileSync(SNAPSHOT, serialized);
  const summary = SIBLINGS.map((s) => `${s.key}@${next[s.key]?.version} (${next[s.key]?.codes?.length ?? 0} codes)`).join(', ');
  process.stdout.write(`${changed ? 'updated' : 'unchanged'} schema/scanner-codes.json: ${summary}\n`);
}

main();

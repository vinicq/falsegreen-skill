#!/usr/bin/env node
'use strict';

// Scanner-coverage guard (issue #105). The skill catalog must be a SUPERSET of every
// sibling scanner's emitted code set. The siblings (falsegreen, falsegreen-robot,
// falsegreen-js) live in other repos and are absent at this repo's CI time, so we pin
// their emitted ids + version in schema/scanner-codes.json (a committed snapshot) and
// diff that against schema/code-catalog.json (built from reference.md). Fail if any
// scanner code is missing from the catalog, naming which scanner emits the orphan.
//
// This catches the exact regression behind #105: a scanner shipped C56/C57/C59/PL1 but
// reference.md never gained the entries, so the catalog silently fell out of superset.
// When a scanner ships a new code, update scanner-codes.json AND add the reference.md
// entry before tagging (see RELEASE.md).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (f) => JSON.parse(fs.readFileSync(path.join(PKG_ROOT, f), 'utf8'));

const catalog = read('schema/code-catalog.json').codes;
const scanners = read('schema/scanner-codes.json');

const errors = [];
for (const [pkg, info] of Object.entries(scanners)) {
  if (pkg.startsWith('$')) continue;
  for (const code of info.codes) {
    if (!catalog[code]) {
      errors.push(`${pkg} (v${info.version}) emits ${code}, absent from schema/code-catalog.json (add the reference.md entry, then run build-code-catalog.mjs)`);
    }
  }
}

// Self-containment. A host that advertises "works with no other file" has to name every
// code the scanners emit, or a standalone paste silently runs a subset. `llm.md:3` makes
// exactly that claim, and it was false: a paste-only review ran no TS/JS or Robot structural
// code at all and missed 16 Python codes. Hosts that ship alongside reference.md make no
// such claim and are deliberately not listed.
// ponytail: presence is "the id appears in the file", not "the id has a table row". A
// stricter parse is a bigger checker; upgrade only if a code gets named in prose alone.
const STANDALONE = ['llm.md'];
const emitted = [...new Set(
  Object.entries(scanners)
    .filter(([pkg, v]) => !pkg.startsWith('$') && v && Array.isArray(v.codes))
    .flatMap(([, v]) => v.codes)
)].sort();
for (const file of STANDALONE) {
  const text = fs.readFileSync(path.join(PKG_ROOT, file), 'utf8');
  const missing = emitted.filter((code) => !new RegExp(`(^|[^A-Za-z0-9])${code}([^A-Za-z0-9]|$)`).test(text));
  if (missing.length > 0) {
    errors.push(`${file} claims to work standalone but never names ${missing.length} emitted code(s): ${missing.join(', ')}`);
  }
}

if (errors.length > 0) {
  process.stderr.write(errors.map((e) => `error: ${e}`).join('\n') + '\n');
  process.exit(1);
}

const total = Object.values(scanners)
  .filter((v) => v && Array.isArray(v.codes))
  .reduce((n, v) => n + v.codes.length, 0);
process.stdout.write(`scanner coverage OK (${total} scanner code refs across ${Object.keys(scanners).filter((k) => !k.startsWith('$')).length} scanners; all present in code-catalog.json)\n`);

#!/usr/bin/env node
'use strict';

// Extracts the canonical id -> {family, judgment, title, severity} map from
// reference.md (the catalog superset, ADR 0002) and writes schema/code-catalog.json.
//
// Sources inside reference.md:
//
//   A) Python "#### Family X" prose (the title may wrap onto the next line):
//        - **C42 — Title (J2, HIGH):** ...   (false-green code, carries a J-judgment)
//        - **D1 — Title (LOW):** ...         (diagnostic code, no J-judgment)
//      The enclosing "#### Family <Letter>" header gives the family letter; the
//      "#### Diagnostic codes" / "#### Family additions (catalog sync)" headers set the
//      family to "Diagnostic" / "catalog-sync".
//
//   B) The TS/JS code table "| Code | Conf | Pattern |": JS-series and shared codes. No
//      letter family (family null); the title is the pattern cell.
//
//   C) The S-series ("## Patterns only the semantic pass can catch"): AI-only semantic
//      codes, format `- **S17 — Title (J4, HIGH).**` (code at start, closes on a period;
//      severity optional). family = "Semantic".
//
//   D) Robot ("## Robot Framework") and project layer ("## Project layer (config-audit)"):
//      bullets that name the code at the END of the title parens,
//      `- **Verification only in Setup (J4, R8):** ...`. Trailing token is the code; severity
//      not stated (severity null). family = "Robot" / "PL". A bullet that re-references an
//      already-defined shared id (C44/C23/C5/C2) does NOT overwrite the earlier entry -
//      add() is first-write-wins.
//
// "family" is what reference.md declares per code (letter A-E, Diagnostic, catalog-sync,
// Semantic, Robot, PL, or null for the TS/JS table). The docs F1-F8 taxonomy is a coarser
// conceptual axis, NOT 1:1 with these families. Cross-repo enforcement against the sibling
// scanners is a documented follow-up, not automated here (ADR 0002).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const REFERENCE = path.join(PKG_ROOT, 'reference.md');
const OUT = path.join(PKG_ROOT, 'schema', 'code-catalog.json');

const FAMILY_RE = /^####\s+Family\s+([A-E])\b/;
const DIAG_RE = /^####\s+Diagnostic codes\b/;
const ADDITIONS_RE = /^####\s+Family additions\b/;
const SEMANTIC_SEC_RE = /^##\s+Patterns only the semantic pass\b/;
const ROBOT_SEC_RE = /^##\s+Robot Framework\b/;
const PL_SEC_RE = /^##\s+Project layer\b/;
const TOP_SEC_RE = /^##\s+/;

const PROSE_START_RE = /^- \*\*([A-Za-z0-9]+)\s+—\s+(.*)$/;
const PROSE_CLOSE_RE = /^(.*?)\s*\((?:(J[0-9](?:\/J[0-9])?),\s*)?(HIGH|LOW|OFF|INFO|MEDIUM)\b[^)]*\):\*\*/;
const S_START_RE = /^- \*\*(S[0-9]+)\s+—\s+(.*)$/;
const S_CLOSE_RE = /^(.*?)\s*\((J[0-9](?:\/J[0-9])?)(?:,\s*(HIGH|LOW|OFF|INFO|MEDIUM)\b[^)]*)?\)\.\*\*/;
const TRAIL_RE = /^- \*\*(.*?)\s*\((J[0-9](?:\/J[0-9])?),\s*((?:R|PL|JS|D|C)\d+[a-z]?)(?:,[^)]*)?\):\*\*/;
const JS_ROW_RE = /^\|\s*([A-Za-z0-9]+)\s*\|\s*(HIGH|LOW|OFF|INFO|MEDIUM)\s*\|\s*(.+?)\s*\|/;
const JS_HEADER_RE = /^\|\s*Code\s*\|\s*Conf\s*\|\s*Pattern\s*\|/;

export function buildCatalog(text) {
  const lines = text.split(/\r?\n/);
  let family = null;
  let section = null;
  let inJsTable = false;
  let pending = null;
  let sPending = null;
  const map = {};

  const add = (id, entry) => { if (!map[id]) map[id] = entry; };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SEMANTIC_SEC_RE.test(line)) { section = 'semantic'; family = null; pending = null; sPending = null; continue; }
    if (ROBOT_SEC_RE.test(line)) { section = 'robot'; family = null; pending = null; sPending = null; continue; }
    if (PL_SEC_RE.test(line)) { section = 'pl'; family = null; pending = null; sPending = null; continue; }
    if (TOP_SEC_RE.test(line)) { section = null; pending = null; sPending = null; }

    const fam = line.match(FAMILY_RE);
    if (fam) { family = fam[1]; pending = null; continue; }
    if (DIAG_RE.test(line)) { family = 'Diagnostic'; pending = null; continue; }
    if (ADDITIONS_RE.test(line)) { family = 'catalog-sync'; pending = null; continue; }

    if (JS_HEADER_RE.test(line)) { inJsTable = true; pending = null; continue; }
    if (inJsTable) {
      if (!line.trim().startsWith('|')) { inJsTable = false; }
      else {
        const r = line.match(JS_ROW_RE);
        if (r && !/^---/.test(r[1])) add(r[1], { family: null, judgment: null, title: r[3].trim(), severity: r[2] });
        continue;
      }
    }

    if (section === 'semantic') {
      if (sPending) {
        const c = (sPending.buf + ' ' + line.trim()).match(S_CLOSE_RE);
        if (c) {
          add(sPending.id, { family: 'Semantic', judgment: c[2], title: c[1].trim(), severity: c[3] || null });
          sPending = null;
        } else {
          sPending.buf = sPending.buf + ' ' + line.trim();
          if (line.trim() === '') sPending = null;
        }
        continue;
      }
      const sm = line.match(S_START_RE);
      if (sm) {
        const c = sm[2].match(S_CLOSE_RE);
        if (c) add(sm[1], { family: 'Semantic', judgment: c[2], title: c[1].trim(), severity: c[3] || null });
        else sPending = { id: sm[1], buf: sm[2] };
        continue;
      }
    }

    if (section === 'robot' || section === 'pl') {
      const tm = line.match(TRAIL_RE);
      if (tm) {
        const famName = section === 'robot' ? 'Robot' : 'PL';
        add(tm[3], { family: famName, judgment: tm[2], title: tm[1].trim(), severity: null });
        continue;
      }
    }

    if (pending) {
      const c = (pending.buf + ' ' + line.trim()).match(PROSE_CLOSE_RE);
      if (c) {
        add(pending.id, { family, judgment: c[2] || null, title: c[1].trim(), severity: c[3] });
        pending = null;
      } else {
        pending.buf = pending.buf + ' ' + line.trim();
        if (line.trim() === '') pending = null;
      }
      continue;
    }
    const sp = line.match(PROSE_START_RE);
    if (sp) {
      const c = sp[2].match(PROSE_CLOSE_RE);
      if (c) add(sp[1], { family, judgment: c[2] || null, title: c[1].trim(), severity: c[3] });
      else pending = { id: sp[1], buf: sp[2] };
    }
  }
  return map;
}

function main() {
  const map = buildCatalog(fs.readFileSync(REFERENCE, 'utf8'));
  const out = {
    $comment: 'Generated by scripts/build-code-catalog.mjs from reference.md. Canonical id->family->title->severity. Run: node scripts/build-code-catalog.mjs',
    source: 'reference.md',
    codes: map,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  process.stdout.write(`wrote ${Object.keys(map).length} codes to schema/code-catalog.json\n`);
}

if (process.argv[1] && (import.meta.url === `file://${process.argv[1]}` || process.argv[1] === fileURLToPath(import.meta.url))) {
  main();
}

#!/usr/bin/env node
'use strict';

// Single source of truth for the INVARIANT blocks shared across the host files
// (SKILL.md, llm.md, AGENTS.md, GEMINI.md). These blocks must read identically
// in every host or the protocol drifts; they did drift once (the precision
// rules diverged into four different wordings, with different counts and even
// different code numbers). The canonical text lives in fragments/, and this
// script injects each fragment between anchor comments in the host files.
//
// What is single-sourced (here): the precision-first rules (all four hosts), the
// compact semantic-case lookup table, and the S-series look-alike exemptions.
// The exemptions list reference.md itself as a target, so the fragment is the one
// copy and reference.md consumes it like any host; the AGENTS.md-only and
// Cursor-only installs carry both blocks inline, because on those paths
// reference.md is not on disk and an unreachable exemption turns a correct test
// into a reported false-green. What is deliberately NOT single-sourced: the per-host
// framing (headers, "how to invoke"), and the full-vs-compact rendering of the
// Protocol and the J1-J6 judgments. SKILL.md/llm.md carry full prose; AGENTS.md
// and GEMINI.md stay compact on purpose (Codex 32 KiB budget, Gemini long
// context). Flattening those would defeat the compaction, so they stay by hand.
//
// Mirrors scripts/sync-cursor-mdc.mjs: run with no args to write the host files,
// run with --check (wired into `npm run validate`) to fail CI on any drift.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function readFragment(name) {
  const text = fs.readFileSync(path.join(PKG_ROOT, 'fragments', name), 'utf8');
  return text.replace(/\r\n/g, '\n').replace(/\s*$/, '');
}

// Each managed region is identified by a key. The host file must contain:
//   <!-- fg:KEY:start -->
//   ...generated content...
//   <!-- fg:KEY:end -->
// and the script replaces everything between the markers with the fragment.
const FRAGMENTS = {
  'precision-rules': readFragment('precision-rules.md'),
  'semantic-cases-compact': readFragment('semantic-cases-compact.md'),
  'semantic-exemptions': readFragment('semantic-exemptions.md'),
};

// Which managed regions each host file is expected to carry.
const TARGETS = {
  'reference.md': ['semantic-exemptions'],
  'SKILL.md': ['precision-rules'],
  'llm.md': ['precision-rules'],
  'AGENTS.md': ['precision-rules', 'semantic-cases-compact', 'semantic-exemptions'],
  'GEMINI.md': ['precision-rules', 'semantic-cases-compact', 'semantic-exemptions'],
  'contexts/cursor.md': ['precision-rules', 'semantic-cases-compact', 'semantic-exemptions'],
};

function markers(key) {
  return {
    start: `<!-- fg:${key}:start -->`,
    end: `<!-- fg:${key}:end -->`,
  };
}

// Build the expected content of a host file by replacing each managed region.
// Comparison and fragment text are normalized to LF, but the file's native EOL
// style and a leading BOM are preserved on write so the generator only ever
// touches the managed regions - everything outside the markers (line endings
// included) stays byte-identical to what the maintainer authored.
// Returns { normalized, eol, bom, error }. The host file must already contain
// the marker pair for every region it carries (markers are placed by hand once
// when a region is converted to a managed block).
function render(file, keys) {
  const abs = path.join(PKG_ROOT, file);
  const raw = fs.readFileSync(abs, 'utf8');
  const bom = raw.charCodeAt(0) === 0xfeff ? '﻿' : '';
  const eol = /\r\n/.test(raw) ? '\r\n' : '\n';
  let text = raw.slice(bom.length).replace(/\r\n/g, '\n');
  for (const key of keys) {
    const { start, end } = markers(key);
    const startIdx = text.indexOf(start);
    const endIdx = text.indexOf(end);
    if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
      return {
        error: `${file}: missing or malformed markers for "${key}" (expected "${start}" ... "${end}")`,
      };
    }
    const before = text.slice(0, startIdx + start.length);
    const after = text.slice(endIdx);
    text = `${before}\n${FRAGMENTS[key]}\n${after}`;
  }
  return { normalized: text, eol, bom };
}

const check = process.argv.includes('--check');
const problems = [];
const writes = [];

for (const [file, keys] of Object.entries(TARGETS)) {
  const abs = path.join(PKG_ROOT, file);
  if (!fs.existsSync(abs)) {
    problems.push(`${file}: missing host file`);
    continue;
  }
  const raw = fs.readFileSync(abs, 'utf8');
  const actual = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const { normalized: expected, eol, bom, error } = render(file, keys);
  if (error) {
    problems.push(error);
    continue;
  }
  if (actual !== expected) {
    if (check) {
      problems.push(`${file}: managed block(s) out of sync with fragments/`);
    } else {
      const onDisk = bom + expected.replace(/\n/g, eol);
      writes.push({ abs, file, content: onDisk });
    }
  }
}

if (check) {
  if (problems.length > 0) {
    process.stderr.write(
      problems.map((p) => `error: ${p}`).join('\n') +
        '\nRun `npm run sync:hosts` and commit the result.\n'
    );
    process.exit(1);
  }
  process.stdout.write('host files are in sync with fragments/\n');
} else {
  if (problems.length > 0) {
    process.stderr.write(problems.map((p) => `error: ${p}`).join('\n') + '\n');
    process.exit(1);
  }
  for (const { abs, file, content } of writes) {
    fs.writeFileSync(abs, content, 'utf8');
    process.stdout.write(`wrote managed blocks into ${file}\n`);
  }
  if (writes.length === 0) {
    process.stdout.write('host files already up to date\n');
  }
}

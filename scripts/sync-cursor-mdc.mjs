#!/usr/bin/env node
'use strict';

// Single source of truth for the Cursor rule: the fenced template in
// contexts/cursor.md. This script extracts that block and writes
// .cursor/rules/falsegreen-skill.mdc verbatim. A hand-extracted .mdc drifted
// once (truncated at "For each finding:"), so the file is generated, and CI
// runs this with --check to fail on any drift.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SOURCE = path.join(PKG_ROOT, 'contexts/cursor.md');
const TARGET = path.join(PKG_ROOT, '.cursor/rules/falsegreen-skill.mdc');

function extractTemplate() {
  const text = fs.readFileSync(SOURCE, 'utf8');
  // The template lives in a four-backtick fence so its inner three-backtick
  // code blocks do not close it. Grab the first such fence.
  const match = text.match(/^````\r?\n([\s\S]*?)\r?\n````$/m);
  if (!match) {
    throw new Error('contexts/cursor.md: could not find the ```` mdc template fence');
  }
  // The .mdc must start with its YAML frontmatter and end with a trailing newline.
  const body = match[1];
  if (!body.startsWith('---')) {
    throw new Error('contexts/cursor.md: the mdc template must start with YAML frontmatter (---)');
  }
  return body.replace(/\r\n/g, '\n').replace(/\s*$/, '') + '\n';
}

const expected = extractTemplate();
const check = process.argv.includes('--check');

if (check) {
  const actual = fs.existsSync(TARGET)
    ? fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n')
    : null;
  if (actual !== expected) {
    process.stderr.write(
      'error: .cursor/rules/falsegreen-skill.mdc is out of sync with the template in ' +
        'contexts/cursor.md. Run `npm run sync:cursor` and commit the result.\n'
    );
    process.exit(1);
  }
  process.stdout.write('.cursor/rules/falsegreen-skill.mdc is in sync with contexts/cursor.md\n');
} else {
  fs.mkdirSync(path.dirname(TARGET), { recursive: true });
  fs.writeFileSync(TARGET, expected, 'utf8');
  process.stdout.write('wrote .cursor/rules/falsegreen-skill.mdc from contexts/cursor.md\n');
}

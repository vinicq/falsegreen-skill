#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = path.join(PKG_ROOT, 'dist');

function read(file) {
  return fs.readFileSync(path.join(PKG_ROOT, file), 'utf8');
}

function write(file, content) {
  const abs = path.join(PKG_ROOT, file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

function copy(from, to) {
  const src = path.join(PKG_ROOT, from);
  const dest = path.join(PKG_ROOT, to);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

// Every path the generated protocol names has to exist inside the target that
// ships it. rootProtocol() is a verbatim copy of SKILL.md, so a path SKILL.md
// names and build-targets does not copy is an instruction pointing at nothing.
// That shipped once: the tight-budget floor (fragments/*) and CREDITS.md were
// named by the protocol and absent from all three packages.
const SHARED = [
  'CREDITS.md',
  'fragments/precision-rules.md',
  'fragments/semantic-cases-compact.md',
  'fragments/semantic-exemptions.md',
  'schema/finding.json',
  'schema/report.json',
  'schema/test-spec.json',
  'schema/fix-validation.json',
];

function copyShared(root) {
  for (const f of SHARED) copy(f, `${root}/${f}`);
}

function stripFrontmatter(text) {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
}

function rootProtocol() {
  return stripFrontmatter(read('SKILL.md')).trim();
}

function cleanDist() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
}

function buildClaudeAgentSkill() {
  const dir = 'dist/claude-agent-skill';
  const frontmatter = [
    '---',
    'name: falsegreen-skill',
    'description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when reviewing Python, TypeScript, JavaScript, or Robot Framework tests for weak assertions, vacuous passes, mock misuse, async assertion gaps, or whether a test can actually fail.',
    '---',
    '',
  ].join('\n');

  write(`${dir}/SKILL.md`, frontmatter + rootProtocol() + '\n');
  copy('reference.md', `${dir}/reference.md`);
  copyShared(dir);
}

function buildGeminiSkill() {
  const dir = 'dist/gemini-skill/falsegreen-skill';
  const skill = [
    '---',
    'name: falsegreen-skill',
    'description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when reviewing Python, TypeScript, JavaScript, or Robot Framework tests for weak assertions, vacuous passes, mock misuse, async assertion gaps, or whether a test can actually fail.',
    '---',
    '',
    '# falsegreen-skill for Gemini',
    '',
    'Read `references/protocol.md` before judging any test. Read',
    '`references/reference.md` before reporting a HIGH finding.',
    '',
    'Use Gemini long context for whole-suite analysis when the user provides a',
    'directory. For JSON output, conform to `schema/report.json` exactly.',
    '',
  ].join('\n');

  write(`${dir}/SKILL.md`, skill);
  write(`${dir}/references/protocol.md`, rootProtocol() + '\n');
  copy('reference.md', `${dir}/references/reference.md`);
  copyShared(dir);
}

function buildAntigravityPlugin() {
  const root = 'dist/antigravity-plugin';
  const skillDir = `${root}/skills/falsegreen-skill`;
  write(`${root}/plugin.json`, read('.antigravity-plugin/plugin.json'));
  const skill = [
    '---',
    'name: falsegreen-skill',
    'description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when reviewing Python, TypeScript, JavaScript, or Robot Framework tests for weak assertions, vacuous passes, mock misuse, async assertion gaps, or whether a test can actually fail.',
    '---',
    '',
    '# falsegreen-skill (Antigravity CLI plugin)',
    '',
    'Read `references/protocol.md` before judging any test. Read',
    '`references/reference.md` before reporting a HIGH finding.',
    '',
    'Use the model long context for whole-suite analysis when the user provides a',
    'directory. For JSON output, conform to `schema/report.json` exactly.',
    '',
  ].join('\n');
  write(`${skillDir}/SKILL.md`, skill);
  write(`${skillDir}/references/protocol.md`, rootProtocol() + '\n');
  copy('reference.md', `${skillDir}/references/reference.md`);
  copyShared(skillDir);
}

cleanDist();
buildClaudeAgentSkill();
buildGeminiSkill();
buildAntigravityPlugin();

// Root-cause check for the class above: every `path.md` / `path.json` the generated
// protocol names must resolve inside the target that ships it, either next to the file
// that names it or at the package root. No allowlist on purpose: an exception here is
// how a dangling path gets waved through. This lives in build-targets rather than in
// npm run validate because dist/ is gitignored and validate never builds it, so this
// is the only place the paths exist. CI runs this script.
const NAMED_PATH = /`([A-Za-z0-9_][A-Za-z0-9_./-]*\.(?:md|json))`/g;

function verifyTarget(root, files) {
  const problems = [];
  for (const file of files) {
    const abs = path.join(PKG_ROOT, root, file);
    const here = path.dirname(abs);
    const seen = new Set();
    for (const [, named] of fs.readFileSync(abs, 'utf8').matchAll(NAMED_PATH)) {
      if (seen.has(named)) continue;
      seen.add(named);
      if (fs.existsSync(path.join(here, named))) continue;
      if (fs.existsSync(path.join(PKG_ROOT, root, named))) continue;
      problems.push(`${root}/${file} names \`${named}\`, absent from the built target`);
    }
  }
  return problems;
}

const dangling = [
  ...verifyTarget('dist/claude-agent-skill', ['SKILL.md']),
  ...verifyTarget('dist/gemini-skill/falsegreen-skill', ['SKILL.md', 'references/protocol.md']),
  ...verifyTarget('dist/antigravity-plugin/skills/falsegreen-skill', ['SKILL.md', 'references/protocol.md']),
];
if (dangling.length > 0) {
  process.stderr.write(dangling.map((d) => `error: ${d}`).join('\n') + '\n');
  process.exit(1);
}


process.stdout.write('built targets in dist/\n');

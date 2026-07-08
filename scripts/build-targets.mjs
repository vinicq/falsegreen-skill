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
    'name: falsegreen-llm',
    'description: Analyze test files for false-positive smells, meaning tests that pass even when the code breaks. Use when reviewing Python, TypeScript, JavaScript, or Robot Framework tests for weak assertions, vacuous passes, mock misuse, async assertion gaps, or whether a test can actually fail.',
    '---',
    '',
  ].join('\n');

  write(`${dir}/SKILL.md`, frontmatter + rootProtocol() + '\n');
  copy('reference.md', `${dir}/reference.md`);
  copy('schema/finding.json', `${dir}/schema/finding.json`);
  copy('schema/report.json', `${dir}/schema/report.json`);
  copy('schema/test-spec.json', `${dir}/schema/test-spec.json`);
  copy('schema/fix-validation.json', `${dir}/schema/fix-validation.json`);
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
  copy('schema/finding.json', `${dir}/schema/finding.json`);
  copy('schema/report.json', `${dir}/schema/report.json`);
  copy('schema/test-spec.json', `${dir}/schema/test-spec.json`);
  copy('schema/fix-validation.json', `${dir}/schema/fix-validation.json`);
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
  copy('schema/finding.json', `${skillDir}/schema/finding.json`);
  copy('schema/report.json', `${skillDir}/schema/report.json`);
  copy('schema/test-spec.json', `${skillDir}/schema/test-spec.json`);
  copy('schema/fix-validation.json', `${skillDir}/schema/fix-validation.json`);
}

cleanDist();
buildClaudeAgentSkill();
buildGeminiSkill();
buildAntigravityPlugin();

process.stdout.write('built targets in dist/\n');

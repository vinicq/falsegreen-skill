#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const errors = [];

function rel(file) {
  return file.replace(PKG_ROOT + path.sep, '').replaceAll(path.sep, '/');
}

function fail(message) {
  errors.push(message);
}

function readText(file) {
  return fs.readFileSync(path.join(PKG_ROOT, file), 'utf8');
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (err) {
    fail(`${file}: invalid JSON (${err.message})`);
    return null;
  }
}

function exists(file) {
  if (!fs.existsSync(path.join(PKG_ROOT, file))) {
    fail(`${file}: missing required file`);
    return false;
  }
  return true;
}

function parseFrontmatter(file) {
  const text = readText(file);
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    fail(`${file}: missing YAML frontmatter`);
    return {};
  }
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) fields[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim();
  }
  return fields;
}

function validateSkill(file, expectedName) {
  if (!exists(file)) return;
  const fm = parseFrontmatter(file);
  if (fm.name !== expectedName) {
    fail(`${file}: expected name "${expectedName}", got "${fm.name || ''}"`);
  }
  if (!fm.description || fm.description.length < 40) {
    fail(`${file}: description must explain when to use the skill`);
  }
}

function findFiles(dir, predicate, acc = []) {
  const abs = path.join(PKG_ROOT, dir);
  if (!fs.existsSync(abs)) return acc;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const child = path.join(abs, entry.name);
    const relative = rel(child);
    if (entry.isDirectory()) {
      findFiles(relative, predicate, acc);
    } else if (predicate(relative)) {
      acc.push(relative);
    }
  }
  return acc;
}

function assertNotContains(files, pattern, message) {
  for (const file of files) {
    const text = readText(file);
    if (pattern.test(text)) fail(`${file}: ${message}`);
  }
}

exists('SKILL.md');
exists('reference.md');
exists('schema/finding.json');
exists('schema/report.json');
validateSkill('skills/falsegreen-llm/SKILL.md', 'falsegreen-llm');
validateSkill('.gemini/skills/falsegreen-skill/SKILL.md', 'falsegreen-skill');

const codexPlugin = readJson('.codex-plugin/plugin.json');
if (codexPlugin && codexPlugin.skills !== './skills/') {
  fail('.codex-plugin/plugin.json: expected "skills": "./skills/"');
}

const geminiExtension = readJson('gemini-extension.json');
if (geminiExtension && geminiExtension.contextFileName !== 'GEMINI.md') {
  fail('gemini-extension.json: expected contextFileName "GEMINI.md"');
}

const findingSchema = readJson('schema/finding.json');
if (findingSchema) {
  const required = findingSchema.required || [];
  for (const key of ['case', 'judgment', 'confidence', 'language', 'intent', 'test', 'finding', 'evidence', 'fix_hint']) {
    if (!required.includes(key)) fail(`schema/finding.json: missing required field "${key}"`);
  }
}

const reportSchema = readJson('schema/report.json');
if (reportSchema) {
  const required = reportSchema.required || [];
  for (const key of ['findings', 'summary', 'language', 'framework']) {
    if (!required.includes(key)) fail(`schema/report.json: missing required field "${key}"`);
  }
}

const publicDocs = [
  ...findFiles('contexts', (f) => f.endsWith('.md')),
  'providers.md',
  'README.md',
  'GEMINI.md',
  'SKILL.md',
  'llm.md',
].filter((f) => fs.existsSync(path.join(PKG_ROOT, f)));

assertNotContains(publicDocs, /\bcase_id\b|\bjudgment_failed\b|\btest_name\b/, 'uses legacy JSON field names; use schema/finding.json fields');
assertNotContains(['providers.md'], /Python\/TS\/JS\/Java\/C#\/PHP\/Ruby\/C\+\+/, 'claims unsupported languages; limit catalog support to Python/TypeScript/JavaScript');

if (errors.length > 0) {
  process.stderr.write(errors.map((e) => `error: ${e}`).join('\n') + '\n');
  process.exit(1);
}

process.stdout.write('falsegreen-skill package validation passed\n');

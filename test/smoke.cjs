#!/usr/bin/env node
'use strict';

// Smoke test for the package: no live API calls. Verifies the CLI parses and
// runs its offline paths, every shipped JSON is valid, and the CLI advertises
// the languages the package claims (Python/TypeScript/JavaScript/Robot). This is
// the test that backs the Robot-in-CLI fix; a live-provider smoke test is #8.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'bin', 'falsegreen-llm.js');
let failures = 0;
const ok = (m) => process.stdout.write(`  ok - ${m}\n`);
const bad = (m) => { failures++; process.stdout.write(`  FAIL - ${m}\n`); };

function run(args) {
  return execFileSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });
}

// 1. The CLI file is syntactically valid (node --check).
try { execFileSync(process.execPath, ['--check', CLI]); ok('node --check bin/falsegreen-llm.js'); }
catch (e) { bad('node --check failed: ' + e.message); }

// 2. --version prints the package version.
try {
  const v = run(['--version']).trim();
  const pkgV = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  v.includes(pkgV) ? ok(`--version reports ${pkgV}`) : bad(`--version "${v}" != ${pkgV}`);
} catch (e) { bad('--version failed: ' + e.message); }

// 3. --help exits 0 and mentions the providers.
try {
  const h = run(['--help']);
  /provider/i.test(h) ? ok('--help renders') : bad('--help missing provider info');
} catch (e) { bad('--help failed: ' + e.message); }

// 4. Every shipped JSON parses.
for (const rel of [
  'schema/finding.json', 'schema/report.json', 'schema/test-spec.json', 'schema/fix-validation.json',
  '.claude-plugin/plugin.json', '.claude-plugin/marketplace.json',
  '.codex-plugin/plugin.json', 'gemini-extension.json', '.agents/plugins/marketplace.json',
  'package.json',
]) {
  try { JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); ok(`valid JSON: ${rel}`); }
  catch (e) { bad(`invalid JSON ${rel}: ${e.message}`); }
}

// 5. finding.json requires `level` and its language enum includes Robot.
try {
  const f = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/finding.json'), 'utf8'));
  f.required.includes('level') ? ok('finding.json requires level') : bad('finding.json missing required level');
  const langEnum = f.properties.language.enum || [];
  langEnum.includes('Robot') ? ok('finding.json language enum includes Robot') : bad('finding.json language enum missing Robot');
} catch (e) { bad('finding.json checks failed: ' + e.message); }

// 6. The CLI --json validator accepts the schema-required `level` field and
// validates its enum (regression guard for the P1 Codex fix).
try {
  const src = fs.readFileSync(CLI, 'utf8');
  /findingKeys\s*=\s*new Set\(\[[\s\S]*?'level'[\s\S]*?\]\)/.test(src)
    ? ok('CLI validator allows the level field')
    : bad('CLI validateReport findingKeys is missing level');
  /levels\s*=\s*new Set\(\['unit', 'integration', 'e2e'\]\)/.test(src)
    ? ok('CLI validates the level enum')
    : bad('CLI is missing the level enum check');
} catch (e) { bad('CLI level checks failed: ' + e.message); }

// 7. fix-validation.json enforces the accept matrix in-schema, not just in prose:
// verdict=accept must imply clean_replica=pass AND mutated_replica=fail (Codex P2).
try {
  const g = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema/fix-validation.json'), 'utf8'));
  const accept = (g.allOf || []).find(
    (s) => s.if && s.if.properties && s.if.properties.verdict && s.if.properties.verdict.const === 'accept');
  const then = accept && accept.then && accept.then.properties;
  then && then.clean_replica && then.clean_replica.const === 'pass'
       && then.mutated_replica && then.mutated_replica.const === 'fail'
    ? ok('fix-validation.json enforces accept => clean=pass and mutated=fail')
    : bad('fix-validation.json does not enforce the accept matrix');
} catch (e) { bad('fix-validation.json matrix check failed: ' + e.message); }

// 8. extractJson recovers JSON that reasoning models wrap in thinking blocks,
// markdown fences, or surrounding prose, and normalizes the "/findings" key
// quirk; a malformed/truncated response yields null (clean failure, no crash). #102
try {
  const { extractJson } = require(CLI);
  const obj = { findings: [], summary: { tests_reviewed: 0, high: 0, low: 0, clean: 0 }, language: 'Python', framework: 'pytest' };
  const body = JSON.stringify(obj);

  // thinking-wrapped + json fence
  const thinkFenced = `<think>let me reason about the file...</think>\nHere is the report:\n\`\`\`json\n${body}\n\`\`\``;
  deepEq(extractJson(thinkFenced), obj, 'extractJson recovers <think> + ```json fence');

  // bare fence, no language tag
  const bareFence = `\`\`\`\n${body}\n\`\`\``;
  deepEq(extractJson(bareFence), obj, 'extractJson recovers a bare ``` fence');

  // <think> prefix, no fence, prose around a bare object
  const thinkPrefix = `<think>analysis here</think>\nFinal answer:\n${body}\nDone.`;
  deepEq(extractJson(thinkPrefix), obj, 'extractJson brace-matches a bare object after <think>');

  // Nvidia qwen "/findings" leading-slash key quirk
  const slashed = JSON.stringify({ '/findings': [], summary: obj.summary, language: 'Python', framework: 'pytest' });
  const fixed = extractJson(slashed);
  fixed && Array.isArray(fixed.findings) && !('/findings' in fixed)
    ? ok('extractJson normalizes the "/findings" leading-slash key')
    : bad('extractJson did not normalize "/findings"');

  // malformed / truncated -> null (caller fails cleanly, never throws)
  extractJson('not json at all, just prose') === null
    ? ok('extractJson returns null on prose (clean failure path)')
    : bad('extractJson should return null on non-JSON');
  extractJson('{"findings": [ {"case": "C5"') === null
    ? ok('extractJson returns null on truncated JSON')
    : bad('extractJson should return null on truncated JSON');
} catch (e) { bad('extractJson tests failed: ' + e.message); }

function deepEq(actual, expected, label) {
  JSON.stringify(actual) === JSON.stringify(expected) ? ok(label) : bad(`${label} (got ${JSON.stringify(actual)})`);
}

if (failures) { process.stdout.write(`\n${failures} smoke failure(s)\n`); process.exit(1); }
process.stdout.write('\nsmoke ok\n');

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
  /levels\s*=\s*new Set\(\['unit', 'integration', 'e2e', 'fixture'\]\)/.test(src)
    ? ok('CLI validates the level enum (incl. fixture)')
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

// 9. REGRESSION #111.2: validateReport accepts level:fixture and intent:scaffold
// (SKILL.md documents both; the closed enum used to abort the whole --json run).
try {
  const { validateReport } = require(CLI);
  const report = {
    findings: [{
      case: 'C5', judgment: 'J2', confidence: 'LOW', language: 'Python',
      level: 'fixture', intent: 'scaffold', test: { name: 'test_stub' },
      finding: 'placeholder', evidence: ['pass'], fix_hint: 'implement it',
    }],
    summary: { tests_reviewed: 1, high: 0, low: 1, clean: 0 },
    language: 'Python', framework: 'pytest',
  };
  const errs = validateReport(report, 'stub');
  errs.length === 0
    ? ok('#111.2: validateReport accepts level:fixture and intent:scaffold')
    : bad(`#111.2: fixture/scaffold rejected: ${errs.join('; ')}`);
} catch (e) { bad('#111.2 test failed: ' + e.message); }

// 10. REGRESSION #111.3/#111.4: a degenerate 200 body (safety block / empty /
// truncated) must fail() with a useful message per provider, NOT a bare
// TypeError. fetch is stubbed; no live API. Env keys set so getApiKey passes.
async function providerParsingTests() {
  const mod = require(CLI);
  const savedFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  process.env.ANTHROPIC_API_KEY = 'test';
  process.env.OPENAI_API_KEY = 'test';
  process.env.GEMINI_API_KEY = 'test';
  const stub = (payload) => { globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => payload, text: async () => '' }); };

  async function expectFail(label, fn, matcher) {
    try {
      await fn();
      bad(`${label}: expected fail(), no error thrown`);
    } catch (e) {
      e instanceof mod.FailError && matcher.test(e.message)
        ? ok(label)
        : bad(`${label}: wrong error (${e && e.message})`);
    }
  }

  const opts = { model: 'x', maxTokens: 10, temperature: 0.2, json: true, baseUrl: 'http://x' };

  // Anthropic safety block: stop_reason set, empty content array.
  stub({ stop_reason: 'refusal', content: [] });
  await expectFail('#111.3 anthropic: no text -> fail with stop_reason',
    () => mod.callAnthropic({ ...opts }, 'sys', 'user'), /no text.*refusal/i);

  // OpenAI-style content filter: choice with no message content.
  stub({ choices: [{ finish_reason: 'content_filter', message: { content: '' } }] });
  await expectFail('#111.3 openai: no text -> fail with finish_reason',
    () => mod.callOpenAIStyle('http://x', 'k', { ...opts }, 'sys', 'user'), /no text.*content_filter/i);

  // Gemini prompt block: no candidates, promptFeedback.blockReason.
  stub({ promptFeedback: { blockReason: 'SAFETY' } });
  await expectFail('#111.3 gemini: blocked -> fail with blockReason',
    () => mod.callGemini({ ...opts }, 'sys', 'user'), /blockReason=SAFETY/i);

  // #111.4: Anthropic max_tokens populates _finishReason so the --json hint fires.
  stub({ stop_reason: 'max_tokens', content: [] });
  const o4 = { ...opts };
  try { await mod.callAnthropic(o4, 'sys', 'user'); } catch (_) { /* expected */ }
  o4._finishReason === 'max_tokens'
    ? ok('#111.4: anthropic sets _finishReason=max_tokens for the truncation hint')
    : bad(`#111.4: anthropic _finishReason not set (${o4._finishReason})`);

  globalThis.fetch = savedFetch;
  process.env = savedEnv;
  // fail() sets process.exitCode=1 as a side effect on each EXPECTED failure;
  // reset it so the harness reports on the `failures` counter, not the stub.
  process.exitCode = 0;
}

function deepEq(actual, expected, label) {
  JSON.stringify(actual) === JSON.stringify(expected) ? ok(label) : bad(`${label} (got ${JSON.stringify(actual)})`);
}

// Provider tests are async (stubbed fetch); await them before the final tally so
// their pass/fail counts and never race the exit.
providerParsingTests()
  .catch((e) => bad('#111.3/4 provider tests threw: ' + e.message))
  .finally(() => {
    if (failures) { process.stdout.write(`\n${failures} smoke failure(s)\n`); process.exit(1); }
    process.stdout.write('\nsmoke ok\n');
  });

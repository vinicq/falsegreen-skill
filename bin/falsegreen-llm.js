#!/usr/bin/env node
'use strict';

// falsegreen-skill CLI: sends test files to an LLM provider with the
// falsegreen J1-J6 protocol (llm.md) as system prompt and prints the report.
// Zero dependencies. Node >= 18 (built-in fetch).

const fs = require('fs');
const path = require('path');
const { runFixGate, isV1Fixable } = require('./fix-gate');

const PKG_ROOT = path.join(__dirname, '..');

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-5',
  openai: 'gpt-5',
  gemini: 'gemini-2.5-flash',
  'openai-compatible': null, // must be passed via --model
};

const FENCE_BY_EXT = {
  '.py': 'python',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.robot': 'robotframework',
  '.resource': 'robotframework',
};

// Authoring mode (Mode B) targets. ext drives the synthetic filename the Mode A
// self-check sees (so it picks the right catalog); fence is what the model tags
// its output with and what we extract.
const LANG_SPEC = {
  python: { ext: '.py', fence: 'python', label: 'Python' },
  typescript: { ext: '.ts', fence: 'typescript', label: 'TypeScript' },
  javascript: { ext: '.js', fence: 'javascript', label: 'JavaScript' },
  robot: { ext: '.robot', fence: 'robotframework', label: 'Robot Framework' },
};

// ---------------------------------------------------------------- helpers

function readPackageVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'));
  return pkg.version;
}

function printHelp() {
  process.stdout.write(`falsegreen-skill - LLM-based false-positive test detection (J1-J6 protocol)

Usage:
  falsegreen-skill analyze <file...> [options]
  falsegreen-skill generate <spec-file> [--lang <language>] [options]
  falsegreen-skill fix <test-file> --case <code> --line <n> [options]
  falsegreen-skill --help
  falsegreen-skill --version

Commands:
  analyze   Review a test file for false-positive smells (Mode A).
  generate  Author a test from a language-neutral spec (Mode B). Renders the spec
            into one language, then runs Mode A on the result so the test cannot
            be false-green by construction. The spec MUST carry an oracle (the
            expected value's independent source); without it the command refuses,
            because a test generated from current output only freezes the bug.
            One language per run - re-run with --lang to render another stack from
            the same spec. See examples/authoring/ for a spec and its renders.
  fix       PROPOSE-ONLY AI-fix (Mode C, V1: Python/pytest). The LLM proposes a
            test-file-only patch for a mechanical finding (C2b/C20/C21/C5/C7); a
            local gate then proves it: parse -> preserve (passes on the real SUT)
            -> mutation (FAILS on a line-scoped mutant of the SUT). Never auto-
            applies, never edits the SUT. Without a runnable SUT it degrades to
            propose-only/unvalidated and says so.

Options:
  --provider <name>     anthropic (default) | openai | gemini | openai-compatible
  --model <model>       Override the provider default model
                        (anthropic: claude-sonnet-5, openai: gpt-5, gemini: gemini-2.5-flash)
  --base-url <url>      Base URL for the openai-compatible provider
                        (Groq, Ollama, OpenRouter, Kimi, Mistral, DeepSeek)
  --json                Validate and output JSON conforming to schema/report.json
  --conventions <file>  Path to a conventions YAML/text block (SKILL.md Step 0)
  --temperature <n>     Sampling temperature 0.0-1.0 (default 0.2). Ignored for OpenAI o-series.
  --max-tokens <n>      Max output tokens (default 4096)
  --fail-on-high        Exit 2 when any HIGH finding is present (requires --json)

generate options (in addition to the provider options above):
  --lang <language>     Target stack: python (default) | typescript | javascript | robot.
                        One language per run; the spec is the single source, re-run
                        to render another stack.

fix options (in addition to the provider options above):
  --case <code>         Catalog code of the finding to fix (C2b, C20, C21, C5, C7).
  --line <n>            Line of the finding in the test file (1-indexed).
  --sut <file>          Production file the test protects. Required for a validated
                        fix; without it the gate degrades to propose-only.
  --sut-line <n>        Line in the SUT to mutate (the behavioural line the finding
                        names). Required for the mutation gate; without it the
                        gate stays unvalidated (it must not mutate the test line).
  --sut-rel <path>      Package-relative path for the SUT in the replica (e.g.
                        src/discount.py), so imports like "import src.discount"
                        resolve. Defaults to the SUT path relative to cwd.
  --target-test <name>  Restrict preserve/mutation to this test (pytest -k), so the
                        kill is attributed to the finding's test, not a sibling.
  --cheap               Validation tier: parse + preserve only (no mutation gate).
                        Default tier is strong (parse + preserve + mutation).

Environment:
  ANTHROPIC_API_KEY     for --provider anthropic
  OPENAI_API_KEY        for --provider openai
  GEMINI_API_KEY        for --provider gemini
  FALSEGREEN_API_KEY    for --provider openai-compatible (falls back to OPENAI_API_KEY)
`);
}

// Sentinel so main().catch can tell an already-reported fail() from an
// unexpected throw and avoid printing the message twice.
class FailError extends Error {}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exitCode = 1;
  // Throw instead of process.exit: an abrupt exit while a fetch/undici socket
  // handle is still closing aborts libuv on Windows (UV_HANDLE_CLOSING assert,
  // #102). Throwing unwinds to main(), the loop drains, node exits cleanly.
  throw new FailError(message);
}

// ------------------------------------------------------------- arg parsing

function parseArgs(argv) {
  const opts = {
    command: null,
    files: [],
    provider: 'anthropic',
    model: null,
    baseUrl: null,
    json: false,
    conventions: null,
    maxTokens: 4096,
    failOnHigh: false,
    temperature: 0.2,
    // generate mode
    lang: null,
    // fix mode
    case: null,
    line: null,
    sut: null,
    sutLine: null,
    sutRel: null,
    targetTest: null,
    tier: 'strong',
  };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    switch (arg) {
      case '--help':
      case '-h':
        opts.command = 'help';
        return opts;
      case '--version':
      case '-v':
        opts.command = 'version';
        return opts;
      case '--provider':
        opts.provider = requireValue(argv, ++i, arg);
        break;
      case '--model':
        opts.model = requireValue(argv, ++i, arg);
        break;
      case '--base-url':
        opts.baseUrl = requireValue(argv, ++i, arg);
        break;
      case '--json':
        opts.json = true;
        break;
      case '--conventions':
        opts.conventions = requireValue(argv, ++i, arg);
        break;
      case '--max-tokens': {
        const raw = requireValue(argv, ++i, arg);
        const n = parseInt(raw, 10);
        if (!Number.isFinite(n) || n <= 0) fail(`--max-tokens expects a positive integer, got "${raw}"`);
        opts.maxTokens = n;
        break;
      }
      case '--temperature': {
        const raw = requireValue(argv, ++i, arg);
        const t = parseFloat(raw);
        if (!Number.isFinite(t) || t < 0 || t > 1) fail(`--temperature expects a float between 0 and 1, got "${raw}"`);
        opts.temperature = t;
        break;
      }
      case '--fail-on-high':
        opts.failOnHigh = true;
        break;
      case '--lang':
        opts.lang = requireValue(argv, ++i, arg);
        break;
      case '--case':
        opts.case = requireValue(argv, ++i, arg);
        break;
      case '--line': {
        const raw = requireValue(argv, ++i, arg);
        const n = parseInt(raw, 10);
        if (!Number.isInteger(n) || n <= 0) fail(`--line expects a positive integer, got "${raw}"`);
        opts.line = n;
        break;
      }
      case '--sut':
        opts.sut = requireValue(argv, ++i, arg);
        break;
      case '--sut-line': {
        const raw = requireValue(argv, ++i, arg);
        const n = parseInt(raw, 10);
        if (!Number.isInteger(n) || n <= 0) fail(`--sut-line expects a positive integer, got "${raw}"`);
        opts.sutLine = n;
        break;
      }
      case '--sut-rel':
        opts.sutRel = requireValue(argv, ++i, arg);
        break;
      case '--target-test':
        opts.targetTest = requireValue(argv, ++i, arg);
        break;
      case '--cheap':
        opts.tier = 'cheap';
        break;
      default:
        if (arg.startsWith('-')) fail(`unknown option: ${arg}`);
        if (!opts.command) {
          opts.command = arg;
        } else {
          opts.files.push(arg);
        }
    }
    i++;
  }
  return opts;
}

function requireValue(argv, i, flag) {
  if (i >= argv.length || argv[i].startsWith('--')) fail(`${flag} requires a value`);
  return argv[i];
}

function isReasoningModel(model) {
  return /^o[134]/.test(model);
}

// ------------------------------------------------------------ prompt build

function buildSystemPrompt(opts) {
  const llmPath = path.join(PKG_ROOT, 'llm.md');
  if (!fs.existsSync(llmPath)) fail(`protocol file not found: ${llmPath}`);
  let prompt = fs.readFileSync(llmPath, 'utf8');

  // Append the full per-language catalog so the prompt actually carries the
  // JS/Robot codes and the AI-only S-series (llm.md only inlines the Python
  // catalog and points here for the rest). Without this the CLI could not apply
  // the Robot/TS catalogs it advertises.
  const refPath = path.join(PKG_ROOT, 'reference.md');
  if (fs.existsSync(refPath)) {
    prompt += '\n\n---\n\n# Full detection reference (all languages)\n\n' + fs.readFileSync(refPath, 'utf8');
  }

  if (opts.json) {
    const reportSchema = fs.readFileSync(path.join(PKG_ROOT, 'schema', 'report.json'), 'utf8');
    const findingSchema = fs.readFileSync(path.join(PKG_ROOT, 'schema', 'finding.json'), 'utf8');
    prompt += [
      '',
      '---',
      '',
      '## Output format override (machine-readable mode)',
      '',
      'Output ONLY a single JSON object conforming to the report schema below.',
      'No prose, no markdown fences, no explanation before or after the JSON.',
      'Each entry in "findings" must conform to the finding schema.',
      '',
      '### report.json',
      '```json',
      reportSchema.trim(),
      '```',
      '',
      '### finding.json',
      '```json',
      findingSchema.trim(),
      '```',
      '',
    ].join('\n');
  }
  return prompt;
}

function guessFence(filename) {
  return FENCE_BY_EXT[path.extname(filename).toLowerCase()] || '';
}

function buildUserMessage(filename, content, conventionsText) {
  const parts = [];
  if (conventionsText) {
    // SKILL.md Step 0: project conventions block, incorporated before judgments.
    parts.push('Project conventions (apply per Step 0 of the protocol):');
    parts.push('```yaml');
    parts.push(conventionsText.trim());
    parts.push('```');
    parts.push('');
  }
  parts.push('Analyze the following test file for false-positive smells. Apply the full protocol.');
  parts.push('');
  parts.push(`File: ${filename}`);
  parts.push('');
  parts.push('```' + guessFence(filename));
  parts.push(content);
  parts.push('```');
  return parts.join('\n');
}

// -------------------------------------------------------------- providers

function getApiKey(provider) {
  const lookup = {
    anthropic: ['ANTHROPIC_API_KEY'],
    openai: ['OPENAI_API_KEY'],
    gemini: ['GEMINI_API_KEY'],
    'openai-compatible': ['FALSEGREEN_API_KEY', 'OPENAI_API_KEY'],
  };
  const names = lookup[provider];
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  fail(`missing API key for provider "${provider}". Set ${names.join(' or ')}.`);
}

async function postJson(url, headers, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, headers),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    fail(`API request failed with HTTP ${res.status}\n${text.slice(0, 800)}`);
  }
  return res.json();
}

async function callAnthropic(opts, system, user) {
  const data = await postJson(
    'https://api.anthropic.com/v1/messages',
    {
      'x-api-key': getApiKey('anthropic'),
      'anthropic-version': '2023-06-01',
    },
    {
      model: opts.model,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature,
      system,
      messages: [{ role: 'user', content: user }],
    }
  );
  // HTTP 200 does not mean text: a safety block returns stop_reason "refusal"
  // or an empty content array. Guard before indexing so we fail() with the real
  // reason instead of a bare "Cannot read properties of undefined" (#111.3).
  const block = Array.isArray(data.content) ? data.content.find((b) => b && typeof b.text === 'string') : null;
  opts._finishReason = data.stop_reason; // so --json can spot max_tokens (#111.4)
  if (!block || !block.text) {
    fail(`model returned no text (stop_reason=${data.stop_reason || 'unknown'})`);
  }
  return block.text;
}

async function callOpenAIStyle(baseUrl, apiKey, opts, system, user) {
  const reasoning = isReasoningModel(opts.model);
  const body = {
    model: opts.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (reasoning) {
    body.max_completion_tokens = opts.maxTokens;
  } else {
    body.max_tokens = opts.maxTokens;
    body.temperature = opts.temperature;
  }
  // In --json mode, ask for native JSON output. Reasoning models otherwise
  // ignore the buried prompt override and emit the prose report, which the
  // JSON path then cannot parse (#102).
  if (opts.json) {
    body.response_format = { type: 'json_object' };
  }
  const data = await postJson(
    `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    { authorization: `Bearer ${apiKey}` },
    body
  );
  // Guard the shape before indexing: a content filter returns choices: [] or a
  // choice with finish_reason "content_filter" and no message content, which
  // otherwise throws a bare TypeError and hides the block (#111.3).
  const choice = Array.isArray(data.choices) ? data.choices[0] : null;
  if (!choice) {
    fail(`model returned no choices (${data.error ? data.error.message : 'empty response'})`);
  }
  // Stash the stop reason so the JSON path can tell "model emitted garbage"
  // from "model ran out of tokens mid-JSON" and give a useful hint (#102).
  opts._finishReason = choice.finish_reason;
  const content = pickContent(choice.message);
  if (!content || !content.trim()) {
    fail(`model returned no text (finish_reason=${choice.finish_reason || 'unknown'})`);
  }
  return content;
}

async function callGemini(opts, system, user) {
  // Key goes in a header, not the URL query string, so it cannot leak into
  // proxy or shell history logs.
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(opts.model)}:generateContent`;
  const data = await postJson(url, { 'x-goog-api-key': getApiKey('gemini') }, {
    system_instruction: { parts: [{ text: system }] },
    contents: [{ parts: [{ text: user }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens, temperature: opts.temperature },
  });
  // A safety block returns no candidates and a promptFeedback.blockReason; a
  // MAX_TOKENS/RECITATION stop returns a candidate with finishReason but no
  // parts. Guard both before indexing so the reason surfaces (#111.3).
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    fail(`model returned no text (blockReason=${data.promptFeedback.blockReason})`);
  }
  const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
  opts._finishReason = candidate && candidate.finishReason; // so --json spots MAX_TOKENS (#111.4)
  const part =
    candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts.find((p) => p && typeof p.text === 'string')
      : null;
  if (!part || !part.text) {
    fail(`model returned no text (finishReason=${(candidate && candidate.finishReason) || 'unknown'})`);
  }
  return part.text;
}

function analyzeOne(opts, system, user) {
  switch (opts.provider) {
    case 'anthropic':
      return callAnthropic(opts, system, user);
    case 'openai':
      return callOpenAIStyle('https://api.openai.com/v1', getApiKey('openai'), opts, system, user);
    case 'openai-compatible':
      return callOpenAIStyle(opts.baseUrl, getApiKey('openai-compatible'), opts, system, user);
    case 'gemini':
      return callGemini(opts, system, user);
    default:
      fail(`unknown provider: ${opts.provider}. Use anthropic, openai, gemini, or openai-compatible.`);
  }
}

// ------------------------------------------------------------ json output

function tryParse(candidate) {
  if (typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (e) {
    return null;
  }
}

// Find the outermost balanced { ... } object, ignoring braces inside strings.
function balancedObject(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function extractJson(text) {
  // Reasoning models wrap the JSON in <think>/<reasoning> blocks, markdown
  // fences, or surrounding prose. Recover defensively and never throw: strip
  // thinking, prefer a fenced block, else brace-match the outermost object.
  if (typeof text !== 'string') return null;
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '');

  // Prefer a ```json fence, then any fence.
  const jsonFence = cleaned.match(/```json\s*([\s\S]*?)```/i);
  const anyFence = cleaned.match(/```\s*([\s\S]*?)```/);
  for (const candidate of [jsonFence && jsonFence[1], anyFence && anyFence[1], cleaned]) {
    const parsed = tryParse(candidate);
    if (parsed !== null) return normalizeReportKeys(parsed);
  }

  // Last resort: the outermost balanced object found anywhere in the text.
  const fallback = tryParse(balancedObject(cleaned));
  return fallback === null ? null : normalizeReportKeys(fallback);
}

// Schema-guided decoding on some providers (seen on Nvidia qwen3.5) leaks the
// JSON-pointer leading slash into top-level keys, e.g. "/findings" instead of
// "findings". Rename the known report keys back when only the slashed form is
// present, so a correct analysis is not rejected as malformed (#102).
function normalizeReportKeys(obj) {
  if (!isPlainObject(obj)) return obj;
  for (const key of ['findings', 'summary', 'language', 'framework', 'scan_date']) {
    if (!(key in obj) && `/${key}` in obj) {
      obj[key] = obj[`/${key}`];
      delete obj[`/${key}`];
    }
  }
  return obj;
}

// Reasoning providers sometimes leave message.content empty and put the answer
// in reasoning_content / message.reasoning. Pick whichever holds text.
function pickContent(message) {
  if (!message) return '';
  if (typeof message.content === 'string' && message.content.trim()) return message.content;
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) return message.reasoning_content;
  if (typeof message.reasoning === 'string' && message.reasoning.trim()) return message.reasoning;
  return message.content || '';
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateReport(report, label) {
  const errors = [];
  const judgments = new Set(['J1', 'J2', 'J3', 'J4', 'J5', 'J6']);
  const confidences = new Set(['HIGH', 'LOW']);
  const languages = new Set(['Python', 'TypeScript', 'JavaScript', 'Robot']);
  // fixture/scaffold: non-behavioral axes documented in SKILL.md for findings on
  // data/example/perf files and unimplemented placeholders (#111.2).
  const levels = new Set(['unit', 'integration', 'e2e', 'fixture']);
  const intents = new Set(['spec', 'char', 'regression', 'behavior', 'scaffold']);
  const findingKeys = new Set([
    'case',
    'judgment',
    'confidence',
    'language',
    'level',
    'intent',
    'test',
    'finding',
    'evidence',
    'oracle',
    'fix_hint',
  ]);

  function add(pathName, message) {
    errors.push(`${pathName}: ${message}`);
  }

  if (!isPlainObject(report)) {
    return [`${label}: report must be a JSON object`];
  }
  if (!Array.isArray(report.findings)) add('findings', 'must be an array');
  if (!isPlainObject(report.summary)) add('summary', 'must be an object');
  if (typeof report.language !== 'string') add('language', 'must be a string');
  if (typeof report.framework !== 'string') add('framework', 'must be a string');

  if (isPlainObject(report.summary)) {
    for (const key of ['tests_reviewed', 'high', 'low', 'clean']) {
      if (!Number.isInteger(report.summary[key]) || report.summary[key] < 0) {
        add(`summary.${key}`, 'must be a non-negative integer');
      }
    }
  }

  if (Array.isArray(report.findings)) {
    report.findings.forEach((finding, index) => {
      const prefix = `findings[${index}]`;
      if (!isPlainObject(finding)) {
        add(prefix, 'must be an object');
        return;
      }
      for (const key of Object.keys(finding)) {
        if (!findingKeys.has(key)) add(`${prefix}.${key}`, 'is not allowed by schema/finding.json');
      }
      if (!(typeof finding.case === 'string' || Number.isInteger(finding.case))) add(`${prefix}.case`, 'must be a string or integer');
      if (!judgments.has(finding.judgment)) add(`${prefix}.judgment`, 'must be one of J1-J6');
      if (!confidences.has(finding.confidence)) add(`${prefix}.confidence`, 'must be HIGH or LOW');
      if (!languages.has(finding.language)) add(`${prefix}.language`, 'must be Python, TypeScript, JavaScript, or Robot');
      if (!levels.has(finding.level)) add(`${prefix}.level`, 'must be unit, integration, e2e, or fixture');
      if (!intents.has(finding.intent)) add(`${prefix}.intent`, 'must be spec, char, regression, behavior, or scaffold');
      if (!isPlainObject(finding.test) || typeof finding.test.name !== 'string') {
        add(`${prefix}.test.name`, 'must be a string');
      }
      if (typeof finding.finding !== 'string') add(`${prefix}.finding`, 'must be a string');
      if (!Array.isArray(finding.evidence) || finding.evidence.some((line) => typeof line !== 'string')) {
        add(`${prefix}.evidence`, 'must be an array of strings');
      }
      if (typeof finding.fix_hint !== 'string') add(`${prefix}.fix_hint`, 'must be a string');
      if ((finding.case === 18 || finding.case === '18') && typeof finding.oracle !== 'string') {
        add(`${prefix}.oracle`, 'is required for case 18');
      }
    });
  }

  return errors.map((error) => `${label}: ${error}`);
}

function hasHighFinding(report) {
  if (!report || !Array.isArray(report.findings)) return false;
  return report.findings.some((f) => f && f.confidence === 'HIGH');
}

function aggregateReports(reports) {
  const languages = new Set(reports.map((report) => report.language).filter(Boolean));
  const frameworks = new Set(reports.map((report) => report.framework).filter(Boolean));
  return {
    findings: reports.flatMap((report) => report.findings),
    summary: {
      tests_reviewed: reports.reduce((sum, report) => sum + report.summary.tests_reviewed, 0),
      high: reports.reduce((sum, report) => sum + report.summary.high, 0),
      low: reports.reduce((sum, report) => sum + report.summary.low, 0),
      clean: reports.reduce((sum, report) => sum + report.summary.clean, 0),
    },
    language: languages.size === 1 ? [...languages][0] : 'mixed',
    framework: frameworks.size === 1 ? [...frameworks][0] : 'mixed',
    scan_date: new Date().toISOString(),
  };
}

// ----------------------------------------------------------------- fix mode

// Mode C V1: build the system prompt that asks the LLM for a test-file-only
// strengthening patch. The trust is the gate, not the prompt: a weak proposal
// is caught by parse/preserve/mutation downstream.
function buildFixSystemPrompt() {
  const llmPath = path.join(PKG_ROOT, 'llm.md');
  let prompt = fs.existsSync(llmPath) ? fs.readFileSync(llmPath, 'utf8') : '';
  prompt += [
    '',
    '---',
    '',
    '## AI-fix mode (Mode C) - propose a test-file-only patch',
    '',
    'You are given a Python/pytest test file and one false-green finding on it.',
    'Propose a STRENGTHENED version of the WHOLE test file that closes the finding:',
    'add the missing assertion / prune the dead guard / replace the tautology with a',
    'real comparison, at the judgment that failed.',
    '',
    'Hard rules:',
    '- Edit the TEST FILE ONLY. Never edit production code.',
    '- The expected value must come from an independent oracle (spec/contract), never',
    '  lifted from current output - that just re-freezes the bug.',
    '- Keep the rest of the file intact; change only what the finding requires.',
    '',
    'Output ONLY the full patched test file inside a single fenced code block:',
    '```python',
    '<the complete strengthened test file>',
    '```',
    'No prose before or after.',
  ].join('\n');
  return prompt;
}

function buildFixUserMessage(filename, content, code, line) {
  return [
    `Finding to fix: case ${code} at line ${line} of ${filename}.`,
    '',
    'Current test file:',
    '```python',
    content,
    '```',
    '',
    'Propose the full strengthened test file (test-file-only patch).',
  ].join('\n');
}

// Pull the first fenced code block out of the model output (the proposed patch).
function extractCodeBlock(text) {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1].trim()) return fenced[1].replace(/\n$/, '');
  // No fence: if it looks like Python source, take it whole.
  return text.trim() ? text.trim() : null;
}

async function runFix(opts) {
  const file = opts.files[0] || null;
  if (!file) fail('fix requires a test file. See --help.');
  if (!fs.existsSync(file)) fail(`file not found: ${file}`);
  if (path.extname(file).toLowerCase() !== '.py') {
    fail('fix V1 supports Python/pytest only. JS/TS/Robot fix paths are v2 (see SKILL.md).');
  }
  if (!opts.case) fail('fix requires --case <code> (the finding to fix).');
  if (!isV1Fixable(opts.case)) {
    fail(`case ${opts.case} is not fixable in V1. Fixable: C2b, C20, C21, C5, C7. ` +
      'Deep semantic cases (10/11/12/18) and JS/TS/Robot are v2.');
  }
  if (!opts.line) fail('fix requires --line <n> (the finding line in the test file).');

  if (opts.provider === 'openai-compatible') {
    if (!opts.baseUrl) fail('--base-url is required for --provider openai-compatible');
    if (!opts.model) fail('--model is required for --provider openai-compatible');
  }
  if (!(opts.provider in DEFAULT_MODELS)) {
    fail(`unknown provider: ${opts.provider}. Use anthropic, openai, gemini, or openai-compatible.`);
  }
  if (!opts.model) opts.model = DEFAULT_MODELS[opts.provider];

  const content = fs.readFileSync(file, 'utf8');
  const system = buildFixSystemPrompt();
  const user = buildFixUserMessage(path.basename(file), content, opts.case, opts.line);

  // The LLM proposes; everything after this is the deterministic gate.
  const raw = await analyzeOne(opts, system, user);
  const patchedTestSource = extractCodeBlock(raw);
  if (!patchedTestSource) fail('the model returned no usable patch (no code block).');

  const cheap = opts.tier === 'cheap';
  const out = runFixGate({
    patchedTestSource,
    testFile: file,
    sutFile: opts.sut || null,
    // Do NOT fall back to opts.line: that is the TEST file's line, not the SUT's.
    // Mutating it targets the wrong behaviour (#110.1). Left null, the gate stays
    // unvalidated and tells the user to pass --sut-line.
    sutLine: opts.sutLine,
    sutRel: opts.sutRel || null,
    targetTest: opts.targetTest || null,
    finding: { code: opts.case, file, line: opts.line },
    tier: cheap ? 'suite-rerun' : 'targeted-mutation',
    mutationDisabled: cheap,
  });

  emitFix(opts, out, patchedTestSource);
}

// Print the proposed patch + the gate evidence (or the JSON validation object).
function emitFix(opts, out, patch) {
  const { validation, summary } = out;
  if (opts.json) {
    process.stdout.write(JSON.stringify(validation, null, 2) + '\n');
  } else {
    process.stdout.write('=== Proposed patch (test file only - NOT applied) ===\n');
    process.stdout.write(patch + '\n\n');
    process.stdout.write(`=== Gate verdict: ${validation.verdict.toUpperCase()} (${summary}) ===\n`);
    process.stdout.write(`  parse/preserve: clean_replica=${validation.clean_replica}\n`);
    process.stdout.write(`  mutation:       mutated_replica=${validation.mutated_replica}` +
      (validation.mutation ? ` [${validation.mutation}]` : '') + '\n');
    if (validation.notes) process.stdout.write(`  notes: ${validation.notes}\n`);
    process.stdout.write('\nHonest limit: the gate proves this fix catches the targeted mutant, ' +
      'not every possible bug. Never auto-applied - review and apply yourself.\n');
  }
  // accepted fix -> 0; rejected/unvalidated -> 1 (CI can branch on it)
  if (validation.verdict !== 'accept') process.exitCode = 1;
}

// -------------------------------------------------------------- generate

// Mode B system prompt: reuse the analysis protocol as the knowledge base (the
// catalog the generated test must NOT trip), then switch the task to authoring.
// The generation output is code, not a report, so json stays off here.
function buildGenerateSystemPrompt(opts, lang) {
  let prompt = buildSystemPrompt(Object.assign({}, opts, { json: false }));
  const specSchema = fs.readFileSync(path.join(PKG_ROOT, 'schema', 'test-spec.json'), 'utf8');
  prompt += [
    '',
    '---',
    '',
    '## Authoring mode (Mode B) - write a test, do not judge one',
    '',
    `You are given a language-neutral test spec. Render it into a single ${LANG_SPEC[lang].label}`,
    'test that is green-for-real: it must pass the J1-J6 protocol above, so it cannot',
    'be false-green by construction.',
    '',
    'Hard rules:',
    '- The expected value comes from the spec\'s `oracle`, NEVER from the code under',
    '  test. Lifting the expected value from current output is a characterization test',
    '  (false-green by design) - refuse that.',
    '- At least one assertion must run unconditionally (no dead guard, no try/except',
    '  that swallows the failure).',
    '- Assert at the spec\'s `level`: unit asserts the return value/state with boundaries',
    '  doubled; integration asserts status AND body, or the persisted row read back;',
    '  e2e asserts the visible page state. Do not over-mock the unit under test.',
    '- The assertion checks the specific behaviour in `scenario`, not a weak truthiness',
    '  or self-comparison.',
    '- Robot Framework: emit a `*** Test Cases ***` test; keep it runnable as a single',
    '  file (do not split into a `.resource`).',
    '',
    'The spec conforms to this schema:',
    '```json',
    specSchema.trim(),
    '```',
    '',
    `Output ONLY the ${LANG_SPEC[lang].label} test inside a single fenced code block`,
    `(\`\`\`${LANG_SPEC[lang].fence}). No prose before or after.`,
  ].join('\n');
  return prompt;
}

function buildGenerateUserMessage(specText, lang, specFile) {
  return [
    `Write a ${LANG_SPEC[lang].label} test from this spec (Mode B authoring).`,
    `Spec file: ${path.basename(specFile)}`,
    '',
    '```yaml',
    specText.trim(),
    '```',
    '',
    `Emit ONLY the ${LANG_SPEC[lang].label} test, in one fenced code block. No prose.`,
  ].join('\n');
}

// Prefer a fence tagged with the target language, then any fence, then the raw
// text (a model that skips the fence but returns only source).
function extractCodeBlockLang(text, fence) {
  if (typeof text !== 'string') return null;
  const tagged = text.match(new RegExp('```' + fence + '\\s*([\\s\\S]*?)```', 'i'));
  if (tagged && tagged[1].trim()) return tagged[1].replace(/\n$/, '');
  const any = text.match(/```[a-z]*\s*([\s\S]*?)```/i);
  if (any && any[1].trim()) return any[1].replace(/\n$/, '');
  return text.trim() ? text.trim() : null;
}

// Step A4: run Mode A (JSON) on the freshly generated test, as if a developer
// handed it over for review. Returns the report + whether it trips any HIGH
// false-green finding. Never throws on a bad report - the caller degrades to
// UNVERIFIED so a self-check hiccup does not lose the generated test.
async function selfCheck(opts, testSource, lang) {
  const jsonOpts = Object.assign({}, opts, { json: true });
  const system = buildSystemPrompt(jsonOpts);
  const filename = `generated_test${LANG_SPEC[lang].ext}`;
  const user = buildUserMessage(filename, testSource, null);
  let raw;
  try {
    raw = await analyzeOne(jsonOpts, system, user);
  } catch (e) {
    if (e instanceof FailError) return { report: null, high: false, error: e.message };
    throw e;
  }
  const report = extractJson(raw);
  if (report === null) return { report: null, high: false, error: 'self-check produced no parseable report' };
  const errors = validateReport(report, filename);
  if (errors.length > 0) return { report: null, high: false, error: errors.join('; ') };
  return { report, high: hasHighFinding(report) };
}

async function runGenerate(opts) {
  // Offline guards first (no API key needed): language, spec file, oracle. These
  // are the paths the smoke test exercises without a live provider.
  const lang = (opts.lang || 'python').toLowerCase();
  if (!(lang in LANG_SPEC)) {
    fail(`unknown --lang "${opts.lang}". Use python, typescript, javascript, or robot.`);
  }
  const specFile = opts.files[0] || null;
  if (!specFile) {
    fail('generate requires a test-spec file. See --help. ' +
      'Example: examples/authoring/apply-discount.spec.yaml');
  }
  if (!fs.existsSync(specFile)) fail(`spec file not found: ${specFile}`);
  const specText = fs.readFileSync(specFile, 'utf8');

  // The one thing the CLI enforces structurally. The oracle's *correctness*
  // (is expected actually spec-derived, not code-derived?) is a judgment; that
  // is what the Mode A self-check below is for. Here we only refuse a spec that
  // names no oracle at all - the most common way to ask for a false-green test.
  if (!/\boracle\b/i.test(specText) || !/\bexpected\b/i.test(specText)) {
    fail('spec has no oracle.expected. Without an independent oracle the generated ' +
      'test can only freeze current behaviour (a characterization test, false-green ' +
      'by construction). Add an oracle block - see schema/test-spec.json.');
  }

  if (opts.provider === 'openai-compatible') {
    if (!opts.baseUrl) fail('--base-url is required for --provider openai-compatible');
    if (!opts.model) fail('--model is required for --provider openai-compatible');
  }
  if (!(opts.provider in DEFAULT_MODELS)) {
    fail(`unknown provider: ${opts.provider}. Use anthropic, openai, gemini, or openai-compatible.`);
  }
  if (!opts.model) opts.model = DEFAULT_MODELS[opts.provider];

  const genSystem = buildGenerateSystemPrompt(opts, lang);
  const genUser = buildGenerateUserMessage(specText, lang, specFile);
  let testSource = extractCodeBlockLang(await analyzeOne(opts, genSystem, genUser), LANG_SPEC[lang].fence);
  if (!testSource) fail('the model returned no usable test (no code block).');

  // A4 says repeat-until-clean; we cap at one revision to stay a CLI, not an
  // agent loop. ponytail: 1-revision ceiling; raise the bound if false-greens
  // still slip through in practice.
  let check = await selfCheck(opts, testSource, lang);
  if (check.report && check.high) {
    const reviseUser = [
      'Your previous test tripped HIGH false-green findings in self-review. Rewrite it',
      'to pass J1-J6. Findings:',
      '```json',
      JSON.stringify(check.report.findings.filter((f) => f && f.confidence === 'HIGH'), null, 2),
      '```',
      'Previous test:',
      '```' + LANG_SPEC[lang].fence,
      testSource,
      '```',
      'Original spec:',
      '```yaml',
      specText.trim(),
      '```',
      `Emit the corrected ${LANG_SPEC[lang].label} test only, in one fenced block.`,
    ].join('\n');
    const revised = extractCodeBlockLang(await analyzeOne(opts, genSystem, reviseUser), LANG_SPEC[lang].fence);
    if (revised) {
      testSource = revised;
      check = await selfCheck(opts, testSource, lang);
    }
  }

  emitGenerate(opts, lang, testSource, check);
}

function emitGenerate(opts, lang, testSource, check) {
  const spec = LANG_SPEC[lang];
  if (opts.json) {
    process.stdout.write(JSON.stringify({
      language: spec.label,
      test: testSource,
      self_check: check.report || null,
      self_check_passed: !!(check.report && !check.high),
      self_check_error: check.error || null,
    }, null, 2) + '\n');
  } else {
    process.stdout.write(`=== Generated ${spec.label} test (Mode B) ===\n`);
    process.stdout.write('```' + spec.fence + '\n' + testSource + '\n```\n\n');
    if (!check.report) {
      process.stdout.write(`=== Self-check: UNVERIFIED (${check.error || 'no report'}) ===\n`);
    } else if (check.high) {
      process.stdout.write('=== Self-check: FAILED - the generated test still trips false-green findings ===\n');
      for (const f of check.report.findings.filter((x) => x && x.confidence === 'HIGH')) {
        process.stdout.write(`  [${f.case}/${f.judgment}] ${f.finding}\n`);
      }
      process.stdout.write('\nUsually a missing or weak oracle in the spec. Strengthen it and re-run.\n');
    } else {
      process.stdout.write('=== Self-check: PASSED - no HIGH false-green findings (Mode A on the generated test) ===\n');
    }
    process.stdout.write('\nHonest limit: the self-check proves the test is not obviously false-green, ' +
      'not that the oracle value is correct. Review the expected value against your spec.\n');
  }
  // A generated test that stays false-green is a failure the CI can branch on.
  if (check.report && check.high) process.exitCode = 1;
}

// --------------------------------------------------------------- analyze

async function runAnalyze(opts) {
  if (opts.files.length === 0) fail('analyze requires at least one file. See --help.');
  if (opts.provider === 'openai-compatible') {
    if (!opts.baseUrl) fail('--base-url is required for --provider openai-compatible');
    if (!opts.model) fail('--model is required for --provider openai-compatible');
  }
  if (!(opts.provider in DEFAULT_MODELS)) {
    fail(`unknown provider: ${opts.provider}. Use anthropic, openai, gemini, or openai-compatible.`);
  }
  if (!opts.model) opts.model = DEFAULT_MODELS[opts.provider];
  if (opts.failOnHigh && !opts.json) fail('--fail-on-high requires --json');

  let conventionsText = null;
  if (opts.conventions) {
    if (!fs.existsSync(opts.conventions)) fail(`conventions file not found: ${opts.conventions}`);
    conventionsText = fs.readFileSync(opts.conventions, 'utf8');
  }

  for (const file of opts.files) {
    if (!fs.existsSync(file)) fail(`file not found: ${file}`);
  }

  const system = buildSystemPrompt(opts);
  const multi = opts.files.length > 1;
  let anyHigh = false;
  const reports = [];

  for (const file of opts.files) {
    const content = fs.readFileSync(file, 'utf8');
    const user = buildUserMessage(path.basename(file), content, conventionsText);
    const output = await analyzeOne(opts, system, user);

    if (opts.json) {
      const report = extractJson(output);
      if (report === null) {
        // A reasoning model that spends its token budget on chain-of-thought in
        // `content` gets cut off mid-JSON; the recovered text looks like a report
        // but never closes. Point at --max-tokens instead of a generic parse error.
        // OpenAI: "length"; Anthropic: "max_tokens"; Gemini: "MAX_TOKENS" (#111.4).
        const truncatedReasons = new Set(['length', 'max_tokens', 'MAX_TOKENS']);
        const truncated = truncatedReasons.has(opts._finishReason) ||
          (output.lastIndexOf('}') < output.lastIndexOf('{') && output.includes('{'));
        const hint = truncated
          ? ' (response was cut off, likely by --max-tokens; retry with a higher --max-tokens. Reasoning models spend output budget on chain-of-thought)'
          : '';
        fail(`could not parse JSON output for ${file}${hint}`);
      }
      const validationErrors = validateReport(report, file);
      if (validationErrors.length > 0) fail(validationErrors.join('\n'));
      reports.push(report);
      if (hasHighFinding(report)) anyHigh = true;
    } else {
      if (multi) process.stdout.write(`=== ${file} ===\n`);
      process.stdout.write(output.trim() + '\n');
      if (multi) process.stdout.write('\n');
    }
  }

  if (opts.json) {
    const report = reports.length === 1 ? reports[0] : aggregateReports(reports);
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }

  // exitCode (not process.exit): exit after the loop drains the closing fetch
  // socket, so node does not assert on a still-closing handle (#102).
  if (anyHigh) process.exitCode = 2;
}

// ------------------------------------------------------------------ main

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.command === 'help' || opts.command === null) {
    printHelp();
    return;
  }
  if (opts.command === 'version') {
    process.stdout.write(readPackageVersion() + '\n');
    return;
  }
  if (opts.command === 'generate') {
    await runGenerate(opts);
    return;
  }
  if (opts.command === 'fix') {
    await runFix(opts);
    return;
  }
  if (opts.command !== 'analyze') {
    fail(`unknown command: ${opts.command}. See --help.`);
  }
  await runAnalyze(opts);
}

// Export internals for unit tests; only run the CLI when invoked directly.
module.exports = {
  extractJson, validateReport, balancedObject, normalizeReportKeys, pickContent, extractCodeBlock, extractCodeBlockLang,
  // exported for the provider-parsing regression tests (#111.3): stubbed fetch,
  // no live API.
  callAnthropic, callOpenAIStyle, callGemini, FailError,
};

if (require.main === module) {
  main().catch((err) => {
    // fail() already reported and set exitCode; just let the process wind down.
    if (err instanceof FailError) return;
    process.stderr.write(`error: ${err && err.message ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}

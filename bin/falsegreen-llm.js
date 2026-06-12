#!/usr/bin/env node
'use strict';

// falsegreen-skill CLI: sends test files to an LLM provider with the
// falsegreen J1-J6 protocol (llm.md) as system prompt and prints the report.
// Zero dependencies. Node >= 18 (built-in fetch).

const fs = require('fs');
const path = require('path');

const PKG_ROOT = path.join(__dirname, '..');

const DEFAULT_MODELS = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-pro',
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
  falsegreen-skill --help
  falsegreen-skill --version

Options:
  --provider <name>     anthropic (default) | openai | gemini | openai-compatible
  --model <model>       Override the provider default model
                        (anthropic: claude-sonnet-4-6, openai: gpt-4o, gemini: gemini-2.5-pro)
  --base-url <url>      Base URL for the openai-compatible provider
                        (Groq, Ollama, OpenRouter, Kimi, Mistral, DeepSeek)
  --json                Validate and output JSON conforming to schema/report.json
  --conventions <file>  Path to a conventions YAML/text block (SKILL.md Step 0)
  --temperature <n>     Sampling temperature 0.0-1.0 (default 0.2). Ignored for OpenAI o-series.
  --max-tokens <n>      Max output tokens (default 4096)
  --fail-on-high        Exit 2 when any HIGH finding is present (requires --json)

Environment:
  ANTHROPIC_API_KEY     for --provider anthropic
  OPENAI_API_KEY        for --provider openai
  GEMINI_API_KEY        for --provider gemini
  FALSEGREEN_API_KEY    for --provider openai-compatible (falls back to OPENAI_API_KEY)
`);
}

function fail(message) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
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
  return data.content[0].text;
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
  const data = await postJson(
    `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    { authorization: `Bearer ${apiKey}` },
    body
  );
  return data.choices[0].message.content;
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
  return data.candidates[0].content.parts[0].text;
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

function extractJson(text) {
  // Models sometimes wrap JSON in markdown fences despite instructions.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate.trim());
  } catch (e) {
    return null;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateReport(report, label) {
  const errors = [];
  const judgments = new Set(['J1', 'J2', 'J3', 'J4', 'J5', 'J6']);
  const confidences = new Set(['HIGH', 'LOW']);
  const languages = new Set(['Python', 'TypeScript', 'JavaScript']);
  const intents = new Set(['spec', 'char', 'regression', 'behavior']);
  const findingKeys = new Set([
    'case',
    'judgment',
    'confidence',
    'language',
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
      if (!languages.has(finding.language)) add(`${prefix}.language`, 'must be Python, TypeScript, or JavaScript');
      if (!intents.has(finding.intent)) add(`${prefix}.intent`, 'must be spec, char, regression, or behavior');
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
        fail(`could not parse JSON output for ${file}`);
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

  if (anyHigh) process.exit(2);
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
  if (opts.command !== 'analyze') {
    fail(`unknown command: ${opts.command}. See --help.`);
  }
  await runAnalyze(opts);
}

main().catch((err) => {
  fail(err && err.message ? err.message : String(err));
});

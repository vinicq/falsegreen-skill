'use strict';

// falsegreen-skill AI-fix gate (issue #1, V1: Python/pytest only).
//
// PROPOSE-ONLY. This module never auto-applies a patch and never edits the SUT.
// It takes a proposed test-file-only patch from the LLM and runs the bidirectional
// gate from shared/PROTOCOL.md (SENTINEL / Pizzini 2024) against a clean replica:
//
//   1. parse gate     - the patched test file parses (python -m py_compile)
//   2. preserve gate  - the patched test PASSES against the unmodified SUT
//   3. mutation gate  - a line-scoped mutation is applied to the SUT and the
//                       patched test must FAIL on at least one mutant (defeats the
//                       silent tautology: an assertion that does not go red on a
//                       wrong SUT did not add an oracle).
//
// The mutation is a built-in, line-scoped operator on the finding's SUT line - a
// minimal, deterministic set (the design doc's fallback table). Driving mutmut is
// deferred to a later version: `mutmut run` cannot reliably report a per-line kill
// (it exits 0 even when every mutant survives) and is not line-scoped, so for V1 the
// built-in operator is both safer and the guarantee. If no runnable SUT is present,
// the gate degrades to propose-only/unvalidated with a clear message, never accept.
//
// The deterministic gate is the trust. The LLM only proposes; a weak proposal is
// caught here, not shipped. Honest limit: the gate proves the fix catches the
// targeted mutant, not every possible bug.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// V1 scope: the mechanical findings where the oracle is clear and the fix is a
// test-file-only strengthening (design doc, "Feasible now (v1)").
const V1_FIXABLE_CODES = new Set(['C2b', 'C20', 'C21', 'C5', 'C7']);

function isV1Fixable(code) {
  return V1_FIXABLE_CODES.has(String(code));
}

// ---- default runners (shell out; injectable so tests need no python) ----

function pythonExe() {
  // py_compile and pytest run under the same interpreter on PATH.
  return process.env.FALSEGREEN_PYTHON || 'python';
}

function defaultRunners() {
  const py = pythonExe();
  return {
    // parse gate: returns { ok, output }
    parse(testFile) {
      const r = spawnSync(py, ['-m', 'py_compile', testFile], { encoding: 'utf8' });
      return { ok: r.status === 0, output: (r.stderr || r.stdout || '').trim() };
    },
    // run the patched test against whatever SUT is on disk now. ok = tests passed.
    // When targetTest is given, scope the run to that one test (pytest -k) so the
    // kill is attributed to the finding's target test, not a pre-existing sibling
    // that happens to catch the mutant (#110.4).
    pytest(testFile, cwd, targetTest) {
      // Clear stale bytecode and disable writing it: between the clean and mutated
      // runs the SUT file changes but Python would import the cached .pyc of the
      // clean version, so the mutant would silently "pass". This is the bug the
      // whole mutation gate depends on not having.
      clearPycache(cwd);
      const args = ['-B', '-m', 'pytest', '-q', '-x', '-p', 'no:cacheprovider'];
      if (targetTest) args.push('-k', targetTest);
      args.push(testFile);
      const r = spawnSync(py, args, {
        cwd,
        encoding: 'utf8',
        env: Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: '1' }),
      });
      // pytest exits 5 when -k matches no test. Treat that as a failed run (the
      // target test does not exist in the patch), not a silent pass.
      return { ok: r.status === 0, output: ((r.stdout || '') + (r.stderr || '')).trim() };
    },
  };
}

// ---- helpers ----------------------------------------------------------------

function clearPycache(dir) {
  try {
    const pc = path.join(dir, '__pycache__');
    if (fs.existsSync(pc)) fs.rmSync(pc, { recursive: true, force: true });
  } catch (_) { /* best effort */ }
}

function copyFileSafe(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// Where the SUT should live inside the replica, preserving its package layout so
// imports like `import src.discount` still resolve (#110.2). Prefer an explicit
// --sut-rel, then a path relative to cwd (or the given base) that stays inside
// the tree; otherwise fall back to the basename.
function sutReplicaPath(opts) {
  if (opts.sutRel) return opts.sutRel.split(/[\\/]/).join(path.sep);
  const base = opts.projectRoot || process.cwd();
  const rel = path.relative(base, path.resolve(opts.sutFile));
  if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  return path.basename(opts.sutFile);
}

// Split a Python source line into [code, comment], where comment starts at the
// first `#` that is not inside a string literal. A comment-only or blank line
// yields an empty code part. This keeps mutation off comments/strings (#111.1):
// a `+` in `# was price + 10` is not a real operator and mutating it is a no-op
// that a strengthened test cannot catch, which then falsely rejects a good fix.
function splitCodeComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\') { i++; continue; } // skip escaped char
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === '#') {
      return [line.slice(0, i), line.slice(i)];
    }
  }
  return [line, ''];
}

// Apply one line-scoped mutation operator to the SUT source. Returns the mutated
// source, or null if no operator applied to that line. This is the design doc's
// fallback operator table. This is the V1 mutation engine (mutmut deferred), so the
// gate gives a real, line-scoped mutation signal without a third-party tool.
//
// Only the CODE part of the line is mutated (comments/strings are left alone,
// #111.1): mutating an operator inside a comment produces a no-op mutant that a
// correctly strengthened test passes, which the gate then misreads as "tautology
// not defeated" and rejects a legitimate fix. If nothing matches in the code,
// return null (the gate treats it as "no mutant"/unvalidated, honest over false).
function mutateLine(source, lineNo) {
  const lines = source.split('\n');
  const idx = lineNo - 1;
  if (idx < 0 || idx >= lines.length) return null;
  const original = lines[idx];
  const [code, comment] = splitCodeComment(original);
  const ops = [
    // comparison flip
    [/==/, '!='], [/!=/, '=='], [/<=/, '<'], [/>=/, '>'],
    // arithmetic perturbation. The `*` operator matches `/\*\*/` (power) and
    // degrades it to `*`, so it can never split a `**` into invalid `a +* b`
    // the way the old `/\*/`/`+` pair did (#110.3). A bare `*` (multiply) is
    // caught by the negative-lookaround star below.
    [/\+/, '-'], [/\*\*/, '*'], [/(?<![*\d.])\*(?!\*)/, '+'],
    // boolean flip
    [/\breturn\s+True\b/, 'return False'], [/\breturn\s+False\b/, 'return True'],
  ];
  for (const [re, rep] of ops) {
    if (re.test(code)) {
      const mutatedCode = code.replace(re, rep);
      if (mutatedCode !== code) {
        lines[idx] = mutatedCode + comment;
        return { source: lines.join('\n'), operator: `${lines[idx].trim()} (was ${original.trim()})` };
      }
    }
  }
  // constant bump on the targeted line (numeric literal N -> N+1), code only.
  const bumpedCode = code.replace(/\b(\d+)\b/, (m) => String(Number(m) + 1));
  if (bumpedCode !== code) {
    lines[idx] = bumpedCode + comment;
    return { source: lines.join('\n'), operator: `${lines[idx].trim()} (was ${original.trim()}, constant bump)` };
  }
  return null;
}

// ---- the gate ---------------------------------------------------------------

// runFixGate: run the bidirectional gate over a proposed patch on a clean replica.
//
//   opts.patchedTestSource - full content of the strengthened test file (LLM output)
//   opts.testFile          - path of the original test file (for naming the replica)
//   opts.sutFile           - path of the SUT file the finding names (or null)
//   opts.sutLine           - line in the SUT to mutate (or null)
//   opts.finding           - { code, file, line } for the fix-validation object
//   opts.tier              - 'targeted-mutation' (default) | 'suite-rerun'
//   opts.runners           - injectable { parse, pytest } (tests)
//
// Returns a schema/fix-validation.json-conforming object plus a human `report`.
function runFixGate(opts) {
  const runners = opts.runners || defaultRunners();
  const tier = opts.tier || 'targeted-mutation';
  const finding = opts.finding || {};

  const result = {
    finding: {
      code: finding.code,
      file: finding.file || opts.testFile,
      line: finding.line || 1,
    },
    tier,
    clean_replica: 'fail',
    mutated_replica: 'pass',
    verdict: 'reject',
    mutation: undefined,
    notes: '',
  };
  const gates = { parse: null, preserve: null, mutation: null };

  // Work in an isolated temp replica so we never touch the user's tree or SUT.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'falsegreen-fix-'));
  const testBase = path.basename(opts.testFile || 'test_fix.py');
  const replicaTest = path.join(work, testBase);

  try {
    fs.writeFileSync(replicaTest, opts.patchedTestSource, 'utf8');

    let replicaSut = null;
    if (opts.sutFile && fs.existsSync(opts.sutFile)) {
      // Preserve the package layout in the replica so `import src.discount` still
      // resolves; flattening to the basename breaks packaged SUTs and the
      // preserve gate then rejects correct fixes before mutating (#110.2). Honor
      // an explicit --sut-rel; else derive a relative path under cwd; fall back
      // to the basename only for an absolute path outside the tree.
      const rel = sutReplicaPath(opts);
      replicaSut = path.join(work, rel);
      copyFileSafe(opts.sutFile, replicaSut);
    }

    // --- gate 1: parse ---
    const parse = runners.parse(replicaTest);
    gates.parse = parse.ok;
    if (!parse.ok) {
      result.verdict = 'reject';
      result.notes = `parse gate failed: the patched test does not compile.\n${parse.output}`;
      return finalize(result, gates, work, 'rejected (parse)');
    }

    // No runnable SUT -> propose-only / unvalidated (design doc precondition L17).
    if (!replicaSut) {
      result.clean_replica = 'pass'; // best we can claim: it parses
      result.mutated_replica = 'pass';
      result.verdict = 'reject';
      result.tier = 'suite-rerun';
      result.notes =
        'unvalidated: no runnable SUT was supplied (pass --sut <file>), so the ' +
        'preserve and mutation gates could not run. The patch is PROPOSED, not PROVEN. ' +
        'Run the gate in an environment with the production code.';
      return finalize(result, gates, work, 'unvalidated (no SUT)');
    }

    // --- gate 2: preserve (test must PASS on the clean SUT) ---
    // Scope to the target test so the same test carries both the preserve and the
    // kill (#110.4): a passing sibling must not stand in for the target.
    const preserve = runners.pytest(replicaTest, work, opts.targetTest);
    gates.preserve = preserve.ok;
    result.clean_replica = preserve.ok ? 'pass' : 'fail';
    if (!preserve.ok) {
      result.verdict = 'reject';
      result.notes =
        'preserve gate failed: the strengthened test does not pass on correct ' +
        `production code (over-strengthened or wrong oracle).\n${preserve.output.slice(0, 600)}`;
      return finalize(result, gates, work, 'rejected (preserve)');
    }

    // cheap tier: parse + preserve only. An unvalidated fix is barely better
    // than the original false-green, so we say so plainly (design doc tiering).
    if (opts.mutationDisabled) {
      result.mutated_replica = 'pass';
      result.verdict = 'reject';
      result.tier = 'suite-rerun';
      result.notes =
        'cheap tier: parse + preserve passed, but the mutation gate was skipped, so ' +
        'the fix is PROPOSED, not PROVEN. It may still be a tautology. Run the strong ' +
        'tier (default) to prove it catches a mutant.';
      return finalize(result, gates, work, 'unvalidated (cheap tier)');
    }

    // --- gate 3: mutation (test must FAIL on the line-scoped mutant) ---
    // V1 uses a built-in line-scoped operator (mutateLine), not mutmut. mutmut's
    // `mutmut run` exit code does not reliably signal a kill (it exits 0 even when
    // every mutant survives), and pointing it at a file mutates the whole file,
    // not the finding's line - both break the gate's central invariant. mutmut
    // integration is deferred to a later version, done via `mutmut results`
    // parsing + true line scoping.
    const sutSource = fs.readFileSync(replicaSut, 'utf8');
    // The line to mutate is the SUT's behavioural line, NOT the finding's test
    // line. Falling back to finding.line mutated the wrong file's line and made
    // the verdict about a different behaviour (#110.1). Require an explicit
    // sutLine; without it the gate stays unvalidated rather than guessing.
    if (!Number.isInteger(opts.sutLine) || opts.sutLine <= 0) {
      result.mutated_replica = 'pass';
      result.verdict = 'reject';
      result.tier = 'suite-rerun';
      result.notes =
        'unvalidated: --sut-line was not supplied, so the mutation gate could not ' +
        'target the SUT behaviour (the test-file line is not the SUT line). Pass ' +
        '--sut-line <n> pointing at the production line under test. Fix is PROPOSED, not PROVEN.';
      return finalize(result, gates, work, 'unvalidated (no sut-line)');
    }
    const m = mutateLine(sutSource, opts.sutLine);
    if (!m) {
      result.mutated_replica = 'pass';
      result.verdict = 'reject';
      result.notes =
        'mutation gate could not run: no operator applied to the targeted SUT ' +
        'line. Point --sut-line at the behavioural line. Fix is PROPOSED, not PROVEN.';
      return finalize(result, gates, work, 'unvalidated (no mutant)');
    }
    fs.writeFileSync(replicaSut, m.source, 'utf8');
    // Validate the mutant compiles before running: a syntactically invalid
    // mutant makes pytest exit non-zero for a parse error, which :236 would
    // misread as "the test caught the mutant" (#110.3). Discard it instead.
    const mutantParse = runners.parse(replicaSut);
    if (!mutantParse.ok) {
      fs.writeFileSync(replicaSut, sutSource, 'utf8');
      result.mutated_replica = 'pass';
      result.verdict = 'reject';
      result.notes =
        'mutation gate could not run: the generated mutant did not compile, so it ' +
        `was discarded (a parse error is not a kill).\n${mutantParse.output.slice(0, 400)}\n` +
        'Point --sut-line at a behavioural line the operators can mutate cleanly. ' +
        'Fix is PROPOSED, not PROVEN.';
      return finalize(result, gates, work, 'unvalidated (invalid mutant)');
    }
    const mutated = runners.pytest(replicaTest, work, opts.targetTest);
    // restore so the replica reflects the clean SUT again
    fs.writeFileSync(replicaSut, sutSource, 'utf8');
    gates.mutation = !mutated.ok; // test FAILED on the mutant == caught
    result.mutated_replica = mutated.ok ? 'pass' : 'fail';
    result.mutation = m.operator;
    result.notes = mutated.ok
      ? 'mutation survived: the test still passed on the mutated SUT line (tautology not defeated).'
      : `mutation caught: the test failed on the mutated SUT line (${m.operator}).`;

    // accept iff clean=pass AND mutated=fail (the fixed schema rule)
    if (result.clean_replica === 'pass' && result.mutated_replica === 'fail') {
      result.verdict = 'accept';
      return finalize(result, gates, work, 'accepted (caught a mutant)');
    }
    result.verdict = 'reject';
    if (!result.notes) {
      result.notes = 'mutation gate failed: the test passed on every mutant - still a tautology.';
    }
    return finalize(result, gates, work, 'rejected (tautology)');
  } finally {
    try { fs.rmSync(work, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
}

function finalize(result, gates, work, summary) {
  // strip undefined optionals so the object validates clean
  if (result.mutation === undefined) delete result.mutation;
  return { validation: result, gates, summary };
}

module.exports = { runFixGate, mutateLine, isV1Fixable, V1_FIXABLE_CODES, defaultRunners };

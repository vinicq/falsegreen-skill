#!/usr/bin/env node
'use strict';

// Deterministic tests for the AI-fix gate (issue #1). No live API: the LLM
// "proposal" is a fixed string (stub), so the test only exercises the gate.
// The gate's verdict must REJECT a tautological fix and ACCEPT a real-oracle fix.
//
// Runners are mocked so the test needs no python/pytest/mutmut on PATH: each
// mock returns a deterministic pass/fail, which is exactly what the gate decides
// on. The accept rule (clean=pass AND mutated=fail) is the thing under test.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runFixGate, mutateLine, isV1Fixable, defaultRunners } = require('../bin/fix-gate');

let failures = 0;
const ok = (m) => process.stdout.write(`  ok - ${m}\n`);
const bad = (m) => { failures++; process.stdout.write(`  FAIL - ${m}\n`); };

// A throwaway SUT on disk so the gate's "runnable SUT present" branch is taken.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'fixgate-test-'));
const sut = path.join(work, 'calc.py');
fs.writeFileSync(sut, 'def add(a, b):\n    return a + b\n', 'utf8');
const testFile = path.join(work, 'test_calc.py');

const PATCH = 'from calc import add\n\ndef test_add():\n    assert add(2, 3) == 5\n';

// --- 1. ACCEPT: real-oracle fix. Clean SUT passes, mutated SUT fails. ---
{
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    // first pytest call = preserve (clean SUT) -> pass; second = mutated -> fail
    _calls: 0,
    pytest(_t, _cwd) {
      this._calls++;
      return { ok: this._calls === 1, output: this._calls === 1 ? '1 passed' : '1 failed' };
    },
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: sut, sutLine: 2,
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'accept'
    ? ok('real-oracle fix ACCEPTED (clean=pass, mutated=fail)')
    : bad(`expected accept, got ${out.validation.verdict} (${out.validation.notes})`);
  out.validation.clean_replica === 'pass' && out.validation.mutated_replica === 'fail'
    ? ok('accepted fix records clean=pass and mutated=fail as evidence')
    : bad('accepted fix did not record the bidirectional evidence');
}

// --- 2. REJECT: tautological fix. Clean SUT passes, mutated SUT ALSO passes. ---
{
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    pytest: () => ({ ok: true, output: '1 passed' }), // passes on clean AND mutant
  };
  const out = runFixGate({
    patchedTestSource: 'def test_tautology():\n    assert True\n',
    testFile, sutFile: sut, sutLine: 2,
    finding: { code: 'C5', file: testFile, line: 2 }, runners,
  });
  out.validation.verdict === 'reject'
    ? ok('tautological fix REJECTED (mutant survived)')
    : bad(`expected reject, got ${out.validation.verdict}`);
  out.validation.mutated_replica === 'pass'
    ? ok('rejected tautology records mutated_replica=pass')
    : bad('rejected tautology should record mutated=pass');
}

// --- 3. REJECT: preserve gate fails (fix breaks the correct SUT). ---
{
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    pytest: () => ({ ok: false, output: '1 failed on clean SUT' }),
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: sut, sutLine: 2,
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'reject' && out.validation.clean_replica === 'fail'
    ? ok('over-strengthened fix REJECTED at preserve gate (clean=fail)')
    : bad(`expected reject at preserve, got ${out.validation.verdict}/${out.validation.clean_replica}`);
}

// --- 4. REJECT: parse gate fails (patch does not compile). ---
{
  const runners = {
    parse: () => ({ ok: false, output: 'SyntaxError' }),
    pytest: () => { throw new Error('pytest must not run after a parse failure'); },
  };
  const out = runFixGate({
    patchedTestSource: 'def test_broken(:\n', testFile, sutFile: sut, sutLine: 2,
    finding: { code: 'C2b', file: testFile, line: 1 }, runners,
  });
  out.validation.verdict === 'reject' && out.gates.parse === false
    ? ok('non-compiling patch REJECTED at parse gate')
    : bad(`expected reject at parse, got ${out.validation.verdict}`);
}

// --- 5. UNVALIDATED: no runnable SUT -> propose-only, never claims accept. ---
{
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    pytest: () => { throw new Error('pytest must not run without a SUT'); },
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: null,
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'reject' && /unvalidated/i.test(out.validation.notes)
    ? ok('no-SUT degrades to propose-only/unvalidated (not accept)')
    : bad(`expected unvalidated reject, got ${out.validation.verdict}`);
}

// --- 6. cheap tier skips the mutation gate and says it is unproven. ---
{
  let pytestCalls = 0;
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    pytest: () => { pytestCalls++; return { ok: true, output: '1 passed' }; },
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: sut, sutLine: 2, mutationDisabled: true,
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'reject' && /cheap tier/i.test(out.validation.notes) && pytestCalls === 1
    ? ok('cheap tier runs preserve only (1 pytest call), stays unproven (not accept)')
    : bad(`expected cheap-tier unproven with 1 pytest call, got ${out.validation.verdict}/${pytestCalls}`);
}

// --- 6b. REGRESSION (P1): every mutant survives -> REJECT, never false-ACCEPT.
// The old mutmut branch inferred a kill from `mutmut run` exit 0, so an all-survived
// run was wrongly blessed as accept. The gate must REJECT when the mutated SUT still
// passes. pytest passes on BOTH the preserve run and the mutation run here.
{
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    pytest: () => ({ ok: true, output: '1 passed' }), // clean passes AND mutant survives
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: sut, sutLine: 2,
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'reject' && out.validation.mutated_replica === 'pass' && out.gates.mutation === false
    ? ok('all-mutants-survive REJECTED (no false-ACCEPT from a passing mutation run)')
    : bad(`expected reject on all-survived, got ${out.validation.verdict}/${out.validation.mutated_replica}`);
}

// --- 7. mutateLine fallback operator actually mutates the targeted line. ---
{
  const m = mutateLine('def f(x):\n    return x == 1\n', 2);
  m && m.source.includes('return x != 1')
    ? ok('mutateLine flips == to != on the targeted line')
    : bad(`mutateLine did not flip the comparison (got ${m && m.source})`);
  mutateLine('def f():\n    pass\n', 2) === null
    ? ok('mutateLine returns null when no operator applies')
    : bad('mutateLine should return null on an unmutatable line');
}

// --- 8. V1 scope guard: only the mechanical codes are fixable. ---
{
  ['C2b', 'C20', 'C21', 'C5', 'C7'].every(isV1Fixable) && !isV1Fixable(18) && !isV1Fixable('JS21')
    ? ok('isV1Fixable covers C2b/C20/C21/C5/C7 and rejects semantic/JS codes')
    : bad('isV1Fixable scope is wrong');
}

// --- 9. END-TO-END with real Python: a real-oracle fix is accepted and a
// tautology is rejected against a LIVE pytest run + fallback mutation. This is
// the only test that catches the stale-__pycache__ class of bug, where the mutant
// would silently pass because Python imported the clean .pyc (L15: synthetic
// green is not real green). Skips cleanly if python/pytest are not on PATH.
function pyOk() {
  const py = process.env.FALSEGREEN_PYTHON || 'python';
  const a = spawnSync(py, ['--version'], { encoding: 'utf8' });
  if (a.error) return false;
  const b = spawnSync(py, ['-m', 'pytest', '--version'], { encoding: 'utf8' });
  return !b.error && b.status === 0;
}
if (!pyOk()) {
  ok('e2e skipped (python/pytest not available)');
} else {
  const e2e = (patch) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixgate-e2e-'));
    fs.writeFileSync(path.join(dir, 'calc.py'), 'def add(a, b):\n    return a + b\n');
    const runners = defaultRunners();
    const out = runFixGate({
      patchedTestSource: patch, testFile: path.join(dir, 'test_calc.py'),
      sutFile: path.join(dir, 'calc.py'), sutLine: 2,
      finding: { code: 'C2b', file: 'test_calc.py', line: 4 }, runners,
    });
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    return out.validation;
  };
  const real = e2e('from calc import add\n\ndef test_add():\n    assert add(2, 3) == 5\n');
  real.verdict === 'accept' && real.mutated_replica === 'fail'
    ? ok('e2e: real-oracle fix accepted against live pytest (mutant caught, no stale .pyc)')
    : bad(`e2e: real-oracle fix should be accepted, got ${real.verdict}/${real.mutated_replica}`);
  const taut = e2e('from calc import add\n\ndef test_add():\n    assert add(2, 3) is not None\n');
  taut.verdict === 'reject' && taut.mutated_replica === 'pass'
    ? ok('e2e: tautology rejected against live pytest (mutant survived)')
    : bad(`e2e: tautology should be rejected, got ${taut.verdict}/${taut.mutated_replica}`);
}

// --- 10. REGRESSION #110.1: no --sut-line -> gate stays UNVALIDATED, does NOT
// mutate the test-file line. Old code fell back to finding.line (the test line)
// and mutated the wrong behaviour, silently returning a verdict. Now it must
// refuse to mutate without an explicit sutLine.
{
  let mutationRan = false;
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    pytest: () => { mutationRan = true; return { ok: true, output: '1 passed' }; },
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: sut, /* sutLine omitted */
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'reject' && /sut-line/i.test(out.validation.notes)
    ? ok('#110.1: missing --sut-line -> unvalidated, refuses to mutate test line')
    : bad(`#110.1: expected unvalidated on missing sut-line, got ${out.validation.verdict} (${out.validation.notes})`);
}

// --- 11. REGRESSION #110.2: package layout preserved in the replica. A SUT at
// pkg/src/mod.py must land at pkg/src/mod.py, not flattened to mod.py, or
// `import src.mod` breaks. We assert the copied path keeps the relative layout.
{
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fixgate-pkg-'));
  const pkgDir = path.join(projectRoot, 'src');
  fs.mkdirSync(pkgDir, { recursive: true });
  const pkgSut = path.join(pkgDir, 'discount.py');
  fs.writeFileSync(pkgSut, 'def price():\n    return 10\n', 'utf8');
  let replicaHadPackagePath = false;
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    pytest: (_t, cwd) => {
      // the SUT must exist at <work>/src/discount.py inside the replica
      replicaHadPackagePath = fs.existsSync(path.join(cwd, 'src', 'discount.py'));
      return { ok: true, output: '1 passed' };
    },
  };
  runFixGate({
    patchedTestSource: 'from src.discount import price\n\ndef test_price():\n    assert price() == 10\n',
    testFile: path.join(projectRoot, 'test_discount.py'),
    sutFile: pkgSut, sutLine: 2, projectRoot,
    finding: { code: 'C2b', file: 'test_discount.py', line: 4 }, runners,
  });
  replicaHadPackagePath
    ? ok('#110.2: SUT keeps its package path (src/discount.py) in the replica')
    : bad('#110.2: SUT was flattened to the basename, breaking import src.discount');
  try { fs.rmSync(projectRoot, { recursive: true, force: true }); } catch (_) { /* best effort */ }
}

// --- 12. REGRESSION #110.3: an invalid mutant is DISCARDED, not counted as a
// kill. mutateLine on `a ** b` must NOT produce `a +* b`; and if a mutant fails
// py_compile, the gate must treat it as "no mutant" (unvalidated), never accept.
{
  // the operator regex must not split `**` into invalid `+*`
  const m = mutateLine('def f(a, b):\n    return a ** b\n', 2);
  m && !/\+\*/.test(m.source) && /a \* b|a\*b/.test(m.source)
    ? ok('#110.3: mutateLine degrades a ** b to a * b (no invalid +*)')
    : bad(`#110.3: mutateLine produced a bad mutant (${m && m.source})`);

  // a mutant that fails py_compile must be discarded, not read as a kill
  const runners = {
    _parseCalls: 0,
    parse() {
      this._parseCalls++;
      // 1st parse = the test file (ok); 2nd parse = the mutant (fail to compile)
      return this._parseCalls === 1 ? { ok: true, output: '' } : { ok: false, output: 'SyntaxError: invalid syntax' };
    },
    pytest: () => ({ ok: true, output: '1 passed' }), // preserve passes; mutation would too
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: sut, sutLine: 2,
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'reject' && /discard|did not compile|invalid/i.test(out.validation.notes)
    ? ok('#110.3: invalid mutant discarded (parse error is not a kill), not accepted')
    : bad(`#110.3: invalid mutant should be discarded, got ${out.validation.verdict} (${out.validation.notes})`);
}

// --- 13. REGRESSION #110.4: the kill is attributed to the target test. When
// --target-test is set, both preserve and mutation runs must pass -k so a
// sibling test cannot stand in. We assert the runner receives the target.
{
  const seen = [];
  const runners = {
    parse: () => ({ ok: true, output: '' }),
    _calls: 0,
    pytest(_t, _cwd, targetTest) {
      this._calls++;
      seen.push(targetTest);
      return { ok: this._calls === 1, output: this._calls === 1 ? '1 passed' : '1 failed' };
    },
  };
  const out = runFixGate({
    patchedTestSource: PATCH, testFile, sutFile: sut, sutLine: 2, targetTest: 'test_add',
    finding: { code: 'C2b', file: testFile, line: 4 }, runners,
  });
  out.validation.verdict === 'accept' && seen.length === 2 && seen.every((t) => t === 'test_add')
    ? ok('#110.4: preserve and mutation runs both scoped to the target test (test_add)')
    : bad(`#110.4: kill not attributed to target test, got runs=${JSON.stringify(seen)}`);
}

try { fs.rmSync(work, { recursive: true, force: true }); } catch (_) { /* best effort */ }

if (failures) { process.stdout.write(`\n${failures} fix-gate failure(s)\n`); process.exit(1); }
process.stdout.write('\nfix-gate ok\n');

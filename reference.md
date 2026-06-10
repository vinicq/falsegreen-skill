# Detection Reference

Full case catalog with per-language patterns, framework cues, and look-alike
examples. Use alongside [SKILL.md](SKILL.md).

Supported languages: **Python, TypeScript, JavaScript.**

## Language and framework detection cues

### Python
- Imports: `import pytest`, `import unittest`, `from unittest.mock import`
- Decorators: `@pytest.mark.*`, `@patch`, `@mock.patch`
- Assertion style: `assert`, `self.assert*`
- Layer cues: `django.test`, `flask.testing`, `httpx`, `fastapi.testclient`
  imply web layer. `playwright`, `selenium` imply browser layer.

### TypeScript / JavaScript
- Imports: `import { describe, it, expect } from '@jest/globals'`,
  `import { describe, it, expect } from 'vitest'`, `require('chai')`
- Global functions: `describe()`, `it()`, `test()`, `expect()`, `beforeEach()`
- Mock cues: `jest.fn()`, `jest.spyOn()`, `jest.mock()`, `vi.fn()`,
  `vi.spyOn()`, `sinon.stub()`, `sinon.spy()`
- Layer cues: `@testing-library/react`, `@testing-library/vue`,
  `supertest`, `playwright`, `cypress` imply web/browser layer.

---

## Case catalog

### Case 10 - Mocks the unit under test (J3, HIGH)

The test patches or mocks the function/class/method that is supposed to be
under test, then asserts on the mock's return value. It is testing the mock
configuration, not the production code.

**Pattern (all languages):**
The mock target is the same symbol as the function being called in the
assertion. The test does not call the real implementation.

**Python example:**
```python
# BAD: mocks add() then asserts add() returns what we told the mock
@patch('mymodule.add')
def test_add(mock_add):
    mock_add.return_value = 5
    result = add(2, 3)
    assert result == 5          # C10 - asserting the mock's value

# CLEAN: uses a real edge mock (database), not the function under test
@patch('mymodule.db.fetch')
def test_get_user(mock_fetch):
    mock_fetch.return_value = {'id': 1, 'name': 'Alice'}
    user = get_user(1)          # real function under test
    assert user.name == 'Alice'
```

**TypeScript/Jest example:**
```typescript
// BAD
jest.mock('./calculator');
import { add } from './calculator';
(add as jest.Mock).mockReturnValue(5);
test('add', () => {
    expect(add(2, 3)).toBe(5);  // C10 - testing the mock
});

// CLEAN
jest.mock('./database');
import { fetchUser } from './userService'; // real SUT
import { db } from './database';
(db.query as jest.Mock).mockResolvedValue([{ id: 1 }]);
test('fetchUser returns user', async () => {
    const user = await fetchUser(1);      // real function
    expect(user.id).toBe(1);
});
```

---

### Case 11 - Asserts the value fed to the mock (J2/J3, HIGH)

The test stubs a dependency to return a specific value, then asserts the
test result equals that same value. The result passes through no production
logic: it is an echo.

**Pattern:** `stub.return_value = X; assert sut.method() == X`

**Python example:**
```python
# BAD: stubs price, asserts price
def test_price(mock_product):
    mock_product.price = 100
    assert get_price(mock_product) == 100  # C11 - just echoes the stub

# CLEAN: stubs price, asserts the TAX is applied
def test_price_with_tax(mock_product):
    mock_product.price = 100
    assert get_price_with_tax(mock_product) == 110  # real logic tested
```

**TypeScript/Jest example:**
```typescript
// BAD
const mockUser = { name: 'Alice' };
jest.spyOn(userService, 'getUser').mockReturnValue(mockUser);
test('name', () => {
    expect(getDisplayName(1)).toBe('Alice'); // C11 if getDisplayName just returns user.name
});
```

---

### Case 12 - Re-implements the production formula (J2, HIGH)

The test computes the expected value using the same formula as the
production code. Both sides agree on the same wrong answer. The test does
not catch errors in the formula itself.

**Pattern:** `expected = a * rate + fee; assert sut.calculate(a) == expected`
when `calculate(a)` does exactly `a * rate + fee`.

**Python example:**
```python
# BAD
def test_total():
    price, tax_rate = 100, 0.1
    expected = price + price * tax_rate   # re-implements sut
    assert calculate_total(price, tax_rate) == expected  # C12

# CLEAN: expected comes from the spec, not the formula
def test_total():
    assert calculate_total(100, 0.1) == 110.0  # from the spec: 100 + 10% = 110
```

---

### Case 15 - Passes only if another test ran first (J6, HIGH)

The test reads or modifies shared mutable state set up by a sibling test.
It passes in a specific execution order and fails when run alone.

**Pattern:** a module-level or class-level variable is modified in one test
and read in another, with no reset between them.

**Python example:**
```python
cache = {}

def test_populate():
    cache['key'] = 'value'

def test_read():
    assert cache['key'] == 'value'  # C15 - depends on test_populate
```

**TypeScript/Jest example:**
```typescript
const state: string[] = [];

test('push item', () => {
    state.push('a');
    expect(state).toHaveLength(1);
});

test('has item', () => {
    expect(state[0]).toBe('a');  // C15 - only passes after the previous test
});
```

---

### Case 18 - Expected value contradicts what the code should do (J2, HIGH)

The test asserts an expected value that contradicts the specification,
documented contract, or domain rule. The test passes - but only because
it has frozen a bug as the correct behavior.

**Requires an independent oracle.** Do not report without citing one.

**Python example:**
```python
# Spec says: apply_discount(200, 0.15) must return 170
# Bug: the function subtracts the wrong amount
def test_apply_discount():
    assert apply_discount(200, 0.15) == 200  # C18 - asserts no discount was applied
    # oracle: docstring says "returns price minus discount"
```

---

## Language-specific patterns

Paper evidence backs each entry. Abbreviations in brackets identify the
source paper; see `research/papers/` in the audit repo for full summaries.

### Python

All patterns below map directly to falsegreen scanner codes. The LLM applies
these by reading the source — no AST required. The scanner is a faster batch
alternative; results must be identical.

**Confidence levels:** HIGH = definite false positive, flag it. LOW = likely
smell, operator confirms. OFF/INFO = diagnostic only, skip unless asked.

#### Family A — test never checks anything

- **C1 — Assertion inside conditional or loop that may never run (J1, LOW):**
  An `assert` (or `self.assert*`) lives inside an `if`, `for`, or `while`
  block whose condition could evaluate to false or whose iterable could be
  empty. The test passes vacuously when the branch is never entered.
  Flag when: the assertion is not reachable from the function's top level
  without entering a conditional. Do NOT flag when the loop iterates over
  a non-empty literal (e.g. `for x in (1, 2, 3):`).
  ```python
  # BAD
  def test_items():
      for item in items:          # items could be []
          assert item.valid       # never runs if items is empty
  # CLEAN
  def test_items():
      assert len(items) > 0
      for item in items:
          assert item.valid
  ```

- **C2 — Test body contains no assertion at all (J1, HIGH):**
  The function has no `assert`, no `self.assert*`, no `pytest.raises()`, no
  fluent `.should.`, no mock assertion call. Body is only `pass`, docstring,
  `...`, or setup-only statements. Always green regardless of production code.
  Exemptions — do NOT flag: `@pytest.mark.skip`, `@pytest.mark.xfail`,
  `@hypothesis`/`@given`/`@fuzz` decorators.
  ```python
  # BAD
  def test_create_user():
      user = create_user("Alice")   # no assert — always green
  ```

- **C2b — Test calls production code but verifies nothing (J1, LOW):**
  Similar to C2 but the test has real `SUT` calls. The check is just missing.
  Different from C2 because it's easy to mistake for a delegation pattern.
  Exemption: if the test calls a helper function that itself contains the
  assertion, do NOT flag (the check executes through the helper).
  ```python
  # BAD
  def test_process():
      result = process(data)        # calls SUT but no assert follows
  ```

- **C3 — Assert inside try whose except swallows the error (J1, HIGH):**
  A `try` block contains an `assert` (or equivalent check), and the `except`
  handler catches `AssertionError`, `Exception`, or bare `except:` with a
  body that is only `pass`/`continue`. The assertion failure is silently
  eaten; the test stays green.
  Exemption: handler that re-raises (`raise`) or does meaningful work is NOT C3.
  ```python
  # BAD
  def test_value():
      try:
          assert compute() == 42
      except Exception:
          pass                      # C3 — hides the failure
  ```

- **C4 — Test function not collected by pytest (J1, HIGH):**
  A `def test_*` function is defined inside another function or class method
  (nested), takes no parameters (or only `self`/`cls`), has a real assertion
  in its body, but is never called and never decorated as a route/callback.
  pytest only collects top-level (or class-method) test functions; this one
  is invisible to the runner.
  Exemption: framework callbacks (`@app.get`, `@click.command`, coroutines
  used with `await`, web route handlers) are NOT C4.

- **C4b — Test class has `__init__` (pytest won't collect it) (J1, LOW):**
  A class whose name starts with `Test` (or is a `unittest.TestCase` subclass)
  defines an `__init__` method. pytest skips such classes entirely.

- **C20 — Assertion after unconditional return/raise/fail (J1, HIGH):**
  An `assert` appears after a `return`, `raise`, `break`, `continue`, or
  `pytest.fail()` in the same block. Dead code; never reached.
  ```python
  # BAD
  def test_flag():
      if not flag:
          return
      assert flag          # reachable, ok
      return               # unconditional return
      assert True          # C20 — dead, never runs
  ```

- **C21 — Every assertion is inside a conditional; none runs unconditionally
  (J1, LOW):**
  The function has assertions but `runs_a_check_unconditionally` is false:
  every check is inside an `if` branch, and there is no exhaustive if/else
  that guarantees at least one branch runs.

- **C22 — Async test never awaits the unit under test (J1, OFF):**
  An `async def test_*` makes calls and has assertions, but contains no
  `await`, `async with`, `async for`, and does not drive a loop
  (`asyncio.run`, `run_until_complete`, `anyio.run`). The coroutine may
  return before any I/O completes. Opt-in only.

- **CC — Commented-out assert (J1, LOW):**
  A line in the test function body is `# assert ...` — an assertion that was
  commented out and left. The check never runs. Not a blocking issue but a
  strong signal the test was weakened.
  ```python
  def test_total():
      result = total(items)
      # assert result == 42    # CC — this check is disabled
  ```

---

#### Family B — check is weak or always true

- **C5 — Always-true assertion (J2, HIGH):**
  The assertion is structurally guaranteed to pass regardless of production
  code: `assert True`, `assert (x, y)` (non-empty tuple is always truthy),
  `assert 1`, `assert x or True`. The check adds no protection.
  ```python
  # BAD
  def test_items():
      assert (item_a, item_b)   # C5 — non-empty tuple, always True
  ```

- **C6 — Weak assertion: only checks that something came back (J4, LOW):**
  Assertion checks only truthiness (`assert result`), non-empty length
  (`assert len(result) > 0`), or string containment (`assert "x" in str(y)`)
  without verifying the actual value or structure.
  Exemption: in web/browser layer tests, checking that a response or locator
  object is truthy IS the meaningful assertion (presence IS the contract).
  Do NOT flag `assert response.status_code` in HTTP tests.
  ```python
  # BAD (unit test context)
  def test_users():
      result = get_users()
      assert result            # C6 — only checks non-empty, not what users are
  # CLEAN
  def test_users():
      result = get_users()
      assert len(result) == 3
      assert result[0].name == "Alice"
  ```

- **C6b — Assertion on positional mock argument via computed index (J3, LOW):**
  The test accesses `mock.call_args.args[idx]` or `mock.call_args[0][idx]`
  where `idx` is computed (`.index()`, arithmetic, variable), rather than a
  fixed literal. The position is fragile and may silently shift.

- **C7 — Self-comparison: both sides are identical (J2, HIGH):**
  `assert x == x`, `assertEqual(x, x)`, or any comparison where left and
  right are syntactically identical and contain no function calls. Always true
  by reflexivity; catches nothing.
  Exemption: if the test also checks `x != peer` (distinct object) or
  `x in {x}` or `hash(x)`, it is testing `__eq__`/`__hash__` semantics —
  NOT C7.
  ```python
  # BAD
  def test_name():
      name = get_name()
      assert name == name    # C7 — always true
  ```

- **C8 — Float exact equality (J4, LOW):**
  Comparison with `==` against a non-sentinel float literal (anything other
  than `0.0` or `1.0`). Floating-point arithmetic makes exact equality
  unreliable. Use `pytest.approx()`.
  ```python
  # BAD
  assert compute() == 3.14159    # C8
  # CLEAN
  assert compute() == pytest.approx(3.14159, rel=1e-6)
  ```

- **C9 — pytest.raises too broad (J4, LOW):**
  `pytest.raises()` called with no exception type, or with a very broad type
  (`Exception`, `BaseException`) and no `match=` parameter. Any exception —
  including one from a typo inside the test itself — satisfies the check.
  ```python
  # BAD
  with pytest.raises(Exception):   # C9 — anything passes
      divide(a, b)
  # CLEAN
  with pytest.raises(ZeroDivisionError, match="division by zero"):
      divide(a, 0)
  ```

- **C11a — Self-confirming literal: test assigns then asserts the same value
  (J2, LOW):**
  The test body contains `obj.attr = VALUE` followed by
  `assert obj.attr == VALUE` using the same literal. The test only confirms
  Python's attribute assignment works, not the production code.
  ```python
  # BAD
  def test_price():
      product.price = 100
      assert product.price == 100   # C11a — just confirms assignment
  ```

- **C13 — Mock assertion misspelled or not called (J4, HIGH):**
  A mock assertion method is accessed as an attribute without `()`:
  `mock.assert_called_once` instead of `mock.assert_called_once_with()`.
  The attribute access returns a bound method; the check never runs.
  Also flags invented names like `assert_called_twice`, `called_once_with`.
  ```python
  # BAD
  mock_fn.assert_called_once      # C13 — missing (), does nothing
  # CLEAN
  mock_fn.assert_called_once_with(expected_arg)
  ```

- **C13b — patch() without autospec (J3, LOW):**
  `@patch('module.Thing')` or `patch.object(obj, 'method')` without
  `autospec=True`, `spec=`, or `spec_set=`. The mock accepts any call
  signature silently; typos in argument names or counts go undetected.

- **C14 — Golden file generated from the actual output (J2, LOW):**
  Pattern: `if not exists(golden_path): write(golden_path, actual_output)`.
  On the first run the test writes the current (possibly wrong) output as the
  expected value. Every subsequent run compares against that captured output.
  Exemption: in web/browser snapshot testing (Playwright, Selenium) this
  pattern is intentional. Do NOT flag in browser layer context.

- **C16 — Result depends on uncontrolled time, randomness, or sleep (J6, LOW):**
  Test uses `time.sleep(N)` (making it flaky under load), reads
  `datetime.now()` / `time.time()` without freezegun/time_machine imported,
  uses `random.*` without `random.seed()`, `torch.rand*` without
  `torch.manual_seed()`, or calls `train_test_split` without `random_state=`.
  ```python
  # BAD
  def test_expiry():
      created = datetime.now()      # C16 — not frozen
      assert is_expired(created, ttl=0) == False
  ```

- **C18 — String/repr comparison (J2, LOW):**
  Comparison with `==` where one side is `str(x)`, `repr(x)`, `format(x,...)`,
  or an f-string, and the other is a string literal. String/repr format is
  implementation detail; it changes without semantic change.
  ```python
  # BAD
  assert str(user) == "User(Alice, 30)"   # C18 — couples to str() format
  # CLEAN
  assert user.name == "Alice" and user.age == 30
  ```

- **C25 — xfail without strict=True (J1, LOW):**
  `@pytest.mark.xfail` without `strict=True`. If the test unexpectedly passes,
  pytest still reports it as `XPASS` (not a failure by default). A quietly
  passing xfail hides that the bug was fixed without removing the mark.

- **C34 — Suboptimal assertion form (J4, LOW):**
  Any of: `assert not x in y` (use `assert x not in y`),
  `assert len(x) == 0` (use `assert not x`),
  `assert x == True` (use `assert x`),
  `assert x == False` (use `assert not x`),
  `assert x == None` (use `assert x is None`),
  `assert x != None` (use `assert x is not None`).
  These weaken error messages and obscure intent.

---

#### Family C — test checks its own setup, not the program

- **C19 — pytest.raises wraps more than one call (J1, LOW):**
  A `with pytest.raises(E):` block contains more than one statement. If the
  first statement raises, the second never executes. The test may be checking
  a different line than intended.
  ```python
  # BAD
  with pytest.raises(ValueError):
      setup_data()          # this might raise, not the SUT
      sut.process(data)     # C19 — intended target
  ```

- **C28 — pytest.raises binding variable never read (J4, LOW):**
  `with pytest.raises(E) as exc:` but `exc` is never used in an assertion
  afterward. The exception type is checked but not its message or attributes.
  ```python
  # BAD
  with pytest.raises(ValueError) as exc:   # C28 — exc never read
      process(bad_input)
  # CLEAN
  with pytest.raises(ValueError) as exc:
      process(bad_input)
  assert "must be positive" in str(exc.value)
  ```

- **C29 — os.environ modified directly in test (J6, LOW):**
  `os.environ["KEY"] = value` or `os.environ.update(...)` or `os.putenv(...)`
  in a test body. The change persists across tests in the same process.
  Use `monkeypatch.setenv()` instead.

---

#### Family D — test depends on external or shared state

- **C17 — pytest.skip() inside broad except (J1, HIGH):**
  A `try` block with an assertion, where the `except` handler is broad
  (`except Exception:` or bare `except:`) and calls `pytest.skip()` or
  `skipTest()`. A real assertion failure triggers the skip instead of failing
  the test. The test is green even when the SUT is broken.
  ```python
  # BAD
  def test_api():
      try:
          assert fetch_data() == expected
      except Exception:
          pytest.skip("skipping")   # C17 — hides real failures
  ```

- **C23 — Hard-coded absolute or home-relative file path (J6, LOW):**
  `open("/home/user/data.csv")` or `Path("/tmp/fixture.json").read_text()`.
  The path does not exist in CI or on another developer's machine.
  Use `tmp_path` fixture or `Path(__file__).parent / "data.csv"`.

- **C24 — Module-level mutable state mutated by test (J6, LOW):**
  The module declares a global `list`, `dict`, or `set`. A test function
  mutates it (`append`, `update`, `[key] =`, `+=`). No autouse fixture
  resets it between tests. Test order determines test outcome.
  ```python
  _cache = {}                       # module-level mutable

  def test_fill():
      _cache["key"] = "value"       # C24 — mutates shared state

  def test_read():
      assert _cache["key"] == "value"  # passes only after test_fill
  ```

- **C27 — try/except/pass around SUT call with no assertion (J1, HIGH):**
  A `try` block calls the SUT (no assertion), and the `except` handler is
  `pass`-only. The test passes whether the call succeeds or raises. Different
  from C3: C3 wraps an assert; C27 has no assert at all in the try.
  Use `with pytest.raises(E, match=...)` instead.
  ```python
  # BAD
  def test_process():
      try:
          process(data)      # C27 — success and failure both → green
      except Exception:
          pass
  ```

- **C30 — HTTP mock not activated (J3, LOW):**
  `responses.add(...)` or `httpretty.register_uri(...)` called, but the
  corresponding activator (`@responses.activate`, `responses.RequestsMock()`,
  `responses.start()`, `httpretty.enable()`) is absent. Real HTTP requests
  go through; the mock is never used.

- **C31 — capsys.readouterr() result discarded (J4, LOW):**
  `capsys.readouterr()` called as bare expression (result ignored) or
  assigned to a variable never read in an assertion. The capture ran but
  no check was performed on it.
  ```python
  # BAD
  def test_output(capsys):
      run()
      capsys.readouterr()          # C31 — captured but never asserted
  # CLEAN
  def test_output(capsys):
      run()
      out, _ = capsys.readouterr()
      assert out == "hello\n"
  ```

- **C32 — @pytest.mark.skip without reason (J1, LOW):**
  `@pytest.mark.skip` with no `reason=` keyword. No explanation for why
  the test is disabled; may be forgotten permanently.

- **C35 — Retry/flaky decorator (J6, LOW):**
  A decorator whose name is in `{flaky, repeat, retry, rerun, flake}` on
  a test function. Masking non-determinism rather than fixing it.

---

#### Family E — passes but checks the wrong thing

- **C33 — ML metric computed but not asserted (J4, LOW):**
  Call to an sklearn metric function (`accuracy_score`, `f1_score`,
  `model.score()`, etc.) where the result is discarded (bare expression) or
  assigned to a variable never read in an assertion. The metric was computed
  but not validated against any threshold.
  ```python
  # BAD
  def test_model():
      acc = accuracy_score(y_true, y_pred)   # C33 — never asserted
  # CLEAN
  def test_model():
      acc = accuracy_score(y_true, y_pred)
      assert acc >= 0.90
  ```

- **C36 — pytest.fail() without reason (J1, LOW):**
  `pytest.fail()` with no positional argument and no `reason=` keyword.
  Calling `pytest.fail()` with no message makes the failure unintelligible
  in CI output.

- **C37 — Duplicate parametrize case (J2, LOW):**
  `@pytest.mark.parametrize` where the exact same argument set appears
  twice. The duplicate provides no additional coverage; it just confirms
  the same code path a second time.

---

#### Diagnostic codes (opt-in, OFF by default)

Apply only when the user explicitly asks for diagnostic analysis.

- **D1 — Assertion Roulette: multiple asserts, none with a message (LOW):**
  Two or more `assert` statements in the function body where every single one
  omits the message argument (`assert cond, "message"`). When any fails, the
  output says only which line failed, not which logical condition.

- **D3 — Duplicate Assert: same assertion appears twice (LOW):**
  The identical `assert expr == val` expression appears more than once in the
  same test. No additional coverage; likely a copy-paste artifact.

- **D4 — Unnamed parametrize cases (LOW):**
  `@pytest.mark.parametrize` with 3 or more cases and no `ids=` keyword.
  CI output shows `test[0]`, `test[1]`; debugging is harder than necessary.

- **D5 — Excessive inline setup (LOW):**
  More than 5 assignment/call statements before the first `assert` in the
  test body. Consider moving setup to a fixture.

- **D6 — Debug print in test (LOW):**
  `print()` call inside the test body. Output is suppressed by pytest by
  default; the print was likely left over from debugging.

- **M2 — Long test method (LOW):**
  The test function body exceeds 50 lines. Consider splitting into focused
  single-concern tests.

---

#### Look-alikes: do NOT flag these Python patterns

- `@pytest.mark.skip` or `@pytest.mark.xfail` on a test with an empty body
  → the test is explicitly disabled, not a C2.
- `@given`/`@hypothesis`/`@fuzz` decorated test with no explicit `assert`
  → hypothesis generates the assertions internally, not C2.
- A helper called from the test that contains the `assert`
  → not C2b; the assertion executes through the helper.
- `for x in (1, 2, 3): assert x` → not C1; literal is always non-empty.
- `assert response` in an HTTP test / `assert locator` in a Playwright test
  → not C6; presence IS the assertion at that layer.
- `assert x == x` where the test also checks `x != peer` or `hash(x)`
  → testing `__eq__`/`__hash__`, not C7.
- freezegun/time_machine imported → unfreeze `datetime.now()` is NOT C16.
- `patch(..., autospec=True)` → not C13b.
- `with pytest.raises(E) as exc: ...; assert "msg" in str(exc.value)`
  → exc is read, not C28.

### TypeScript / JavaScript

- **Conditional Test - assertion inside branch (J1/C1, HIGH):**
  An `if`/`switch`/ternary inside the test body where the `expect()` or
  `assert` call lives inside the branch. The branch may never fire, leaving
  the assertion unexecuted. Prevalence: 92.31% across 65 JS projects.
  [Jorge 2023, STEEL tool]

- **Unknown Test - zero `expect()` calls (J1/C2b, HIGH):**
  `it('...', () => { /* calls SUT but no expect() CallExpressions */ })`.
  Jest and Vitest do not warn when zero assertions run. Prevalence: 72.31%.
  Also covers `expect.assertions(0)`, which explicitly passes with zero checks.
  [Jorge 2023]

- **Swallowed try/catch - exception absorbed, test stays green (J1, HIGH):**
  ```javascript
  try { callUnit(); } catch (e) { console.log(e); }
  ```
  The thrown error is absorbed; the test is green regardless of whether the
  SUT threw. Flag when assertion is absent or lives inside the `catch` block
  that also absorbs the error. Prevalence: 67.69%. This is the JS equivalent
  of C3. [Jorge 2023]

- **Assertion in `.forEach`/`.map` over a possibly-empty collection (J1, HIGH):**
  ```javascript
  arr.forEach(x => expect(x).toBe(val)); // passes vacuously when arr is []
  ```
  Identical failure mode to C1/C21 in Python but expressed through array
  iterators. Look for `expect` or `assert` as the body of a `.forEach`,
  `.map`, or `.filter` callback. [Jorge 2023]

- **`var` hoisting creates hidden shared state (J6/C15, MEDIUM):**
  `var`-declared variables in a test file are hoisted to file scope. A test
  that writes to a `var` mutates state visible to sibling tests. `let`/`const`
  do not have this property. This is an instance of C15 expressed through JS
  scoping rules, not a new case. [Jorge 2023]

- **Missing `return`/`await` on Promise chain (J1/C22 analog, HIGH):**
  An `async` test without `await sut()`, or a synchronous test that creates
  a Promise without returning it. Jest resolves the test before the Promise
  settles; any assertion inside `.then()` never fires. Detect: `async` test
  where `expect` appears only inside a `.then()` callback not preceded by
  `await`, or a non-async test that creates a Promise but does not `return` it.
  [Jorge 2023, Jest docs]

- **`done()` called before assertion - Mocha/Jest done-callback style (J1, HIGH):**
  The `done()` call precedes or is at the same nesting level as the assertion.
  The runner marks the test complete and the subsequent assertion throw is
  ignored. [Jorge 2023, Mocha idiom]

- **`expect.assertions(N)` guard missing on async test (J1, MEDIUM):**
  No `expect.assertions(N)` guard means Jest passes with zero assertions
  executed if the callback never fires. `expect.assertions(0)` is even worse
  - it explicitly allows no assertions. [Jest docs]

- **Literal-vs-literal assertion (J2/C5-C7, HIGH):**
  `expect(true).toBe(true)`, `assert.equal(1, 1)`, `expect('x').toEqual('x')`.
  Both sides are literals; the check passes by construction regardless of
  production code. [Jorge 2023]

- **`it.skip` / `describe.skip` / `xit` left permanently (J1, MEDIUM):**
  Silently excluded from the run; the skip annotation is never revisited.
  Maps to the Ignored Test smell. [Jorge 2023, STEEL]

---

### Look-alikes: do NOT flag these TypeScript patterns

1. **Type guard tests with `as unknown as T`** — casting through `unknown` to
   pass bad input into a type guard without a compiler error. The purpose is
   to verify the guard correctly rejects the value. This is not C5 and not
   C7. The cast is deliberate, not a tautology.

2. **`expect(result).toMatchObject({ kind: 'error' })` on discriminated unions**
   — asserting only the discriminant field is not C6. In a discriminated union,
   the discriminant fully determines the branch. Asserting `kind` IS the
   meaningful assertion. This is the TypeScript equivalent of C6's HTTP
   response exemption.

3. **`expectTypeOf(v).toEqualTypeOf<T>()`** from vitest/expect-type — these are
   compile-time type assertions. They do nothing at runtime but fail at `tsc`
   time if the type no longer matches. They are not C5 (always-true) because
   they fail when the type changes. Do not flag `expectTypeOf` calls.

4. **`expect(result).toBeInstanceOf(SpecificError)`** when identity is the
   contract (domain errors, value objects) — not C6 even though it skips field
   inspection. When the class itself is the contract (e.g., a specific domain
   error subclass), `instanceof` IS the full assertion.

5. **`vi.mocked(fn)` or `jest.mocked(fn)` wrapping** — not C13b. These typed
   mock wrappers preserve the original function's type signature. They serve
   the same purpose as `autospec=True` in Python: preventing silent signature
   drift. Do not flag them as untyped mocks.

---

### Look-alikes: do NOT flag these JavaScript patterns

1. **`expect(fn).not.toThrow()`** after a setup call — verifies the setup
   completed without error. Not C2 when the contract is "must not throw". The
   assertion is the absence of an exception, which is meaningful.

2. **`expect(emitter).toHaveProperty('on')` on an EventEmitter or similar
   interface** — duck-typing check, not C6, when interface presence IS the
   contract. Checking that an object exposes a required API surface is a
   legitimate assertion.

3. **`done()` called once after a series of assertions inside a callback** —
   not C2 if the assertions are present and precede the `done()` call. The
   smell is `done()` called before or instead of assertions, not `done()` used
   as the callback signal after real checks have run.

---

## The oracle hierarchy

The expected value must come from a source independent of the code:

1. **Explicit spec or requirement** (spec document, ticket, RFC)
2. **Documented contract** (docstring, type annotations, API docs)
3. **Independent human judgment** (the tester's own derivation)
4. **The current code** (lowest priority - this is where bugs hide)

Promoting the current code to the top of this hierarchy is how a bug gets
frozen as "correct". The semantic pass enforces this hierarchy.

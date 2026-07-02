# Detection Reference

Full case catalog with per-language patterns, framework cues, and look-alike
examples. Use alongside [SKILL.md](SKILL.md).

This catalog is the guard for all three intents. For **authoring** (Mode B,
generating tests), see SKILL.md "Authoring mode": it opens with an architect/QA
gate (Step A0), renders from `examples/authoring/`, and self-reviews the
generated test against these same codes plus `fragments/precision-rules.md` so
the output is green-for-real, never tautological. Mode B is editor-host only (no
CLI surface).

Supported languages: **Python, TypeScript, JavaScript, Robot Framework** (Gherkin and Tavern are covered as secondary semantic passes).

## Language and framework detection cues

### Python
- Imports: `import pytest`, `import unittest`, `from unittest.mock import`
- Decorators: `@pytest.mark.*`, `@patch`, `@mock.patch`
- Assertion style: `assert`, `self.assert*`

### TypeScript / JavaScript
- Imports: `import { describe, it, expect } from '@jest/globals'`,
  `import { describe, it, expect } from 'vitest'`, `require('chai')`
- Global functions: `describe()`, `it()`, `test()`, `expect()`, `beforeEach()`
- Mock cues: `jest.fn()`, `jest.spyOn()`, `jest.mock()`, `vi.fn()`,
  `vi.spyOn()`, `sinon.stub()`, `sinon.spy()`

## Level detection cues (the full list)

Read the level from signals; do not guess. Precedence (strongest signal wins):
**(1)** a doubled/intercepted boundary keeps the test at unit/component even if a real client
is imported - the mock IS the boundary; **(2)** else a real boundary makes it integration;
**(3)** else a browser/mobile driver makes it E2E; **(4)** no signal → unit (and real I/O in
an unsignalled test is itself the smell, not the level). A `conventions:` block overrides all
of this. `smoke`/`slow`/`asyncio`/`anyio` markers are level-neutral.

### Doubles that keep a test at unit/component (rule 1 - they beat the import)
- Python: `unittest.mock`/`patch`/`MagicMock`/`AsyncMock`, `monkeypatch` (incl. `setenv`),
  `pytest-mock`, `responses`, `requests-mock`, `httpretty`, `respx`, `aioresponses`,
  `vcrpy`/`pytest-recording`, `moto`/`@mock_aws`, `fakeredis`, `mongomock`, `pyfakefs`,
  FastAPI `dependency_overrides`, Django locmem email, `celery` eager. `freezegun`/`time-machine`
  double the clock (level-neutral).
- JS/TS: `jest.mock`/`vi.mock`/`jest.fn`/`vi.spyOn`/`sinon`, `msw`/`@mswjs`, `nock`
  (`disableNetConnect`), `fetch-mock`, `axios-mock-adapter`, `jest-fetch-mock`,
  `aws-sdk-client-mock`, `nodemailer-mock`, `prismock`, fake repository, fake timers.

### Integration cues (rule 2 - real boundary, no double)
- Python API / in-process test clients: FastAPI/Starlette `TestClient` (httpx-backed),
  `httpx.AsyncClient`/`ASGITransport`, Flask `test_client`, Werkzeug `Client`, Django
  `Client`/`RequestFactory`/DRF `APIClient`, webtest `TestApp`, aiohttp `test_utils`, Tornado
  `AsyncHTTPTestCase`, Sanic/Falcon. Real network: `urllib`/`urllib3`/`http.client`. WebSocket:
  `websockets`/`websocket-client`. gRPC: real `grpc` stub (vs `grpc_testing` = double).
  GraphQL: `gql`/`schema.execute()`.
- Python DB / store: SQLAlchemy (sync + `AsyncSession`), Django ORM, `psycopg`/`asyncpg`,
  `pymysql`/`aiomysql`, `oracledb`, `sqlmodel`/`peewee`/`pony`/`tortoise`, `pymongo`/`motor`,
  `redis`/`redis.asyncio`, `alembic`/migrations, `testcontainers`, `pytest-postgresql`/`-mysql`,
  `@pytest.mark.django_db`/`transactional_db`. `sqlite :memory:` leans integration.
- Python other I/O: queues (`kombu`/`celery` real broker, `pika`, `kafka-python`/`aiokafka`),
  real `boto3` S3 - against a live endpoint or a **LocalStack**/`testcontainers` emulator (a
  real service over the wire, not moto/`@mock_aws`), real filesystem (vs pyfakefs),
  `subprocess`, real SMTP.
- JS/TS API: supertest `request(app)` in-process, Nest `Test.createTestingModule` + supertest,
  `fetch`/`undici`/`got`/`axios`/`ky` to a live URL, Apollo `executeOperation`, `graphql-request`,
  tRPC caller, `@grpc/grpc-js`, `ws`/`socket.io-client` to a started server.
- JS/TS DB / store: `pg`/`postgres`, `mysql2`, `better-sqlite3`, `mongodb`/`mongoose`,
  `ioredis`/`redis`, `cassandra-driver`; ORMs Prisma/TypeORM/Sequelize/Drizzle/Kysely/MikroORM/
  Knex/Objection; `testcontainers`. In-memory (`mongodb-memory-server`, sqlite `:memory:`,
  `pg-mem`) leans integration (real query engine), not unit.
- JS/TS other I/O: `amqplib`/`kafkajs`/`bullmq`, real `@aws-sdk/client-s3` against a live
  endpoint or a **LocalStack**/`testcontainers` emulator (a real service over the wire, not
  aws-sdk-client-mock), `nodemailer` to a real SMTP stub.

### Component layer (folds to unit for the oracle)
React/Vue/Angular/Svelte render with mocked network: `@testing-library/*` `render`/`screen`/
`userEvent`, Vue Test Utils `mount`/`shallowMount`, Angular `TestBed`+`ComponentFixture`,
Cypress component (`cy.mount`, `cypress/component/`), Playwright CT `mount`, Storybook play.
`testEnvironment: jsdom`/`happy-dom` is a component/unit signal; `node` leans unit/integration.

### E2E cues (rule 3)
Playwright `page.`/`expect(page)`/`test({ page })`, Cypress `cy.visit`/`cypress/e2e/`,
WebdriverIO `browser.`/`$()`, Puppeteer `page.`, Nightwatch, TestCafe, `selenium-webdriver`
(`driver.`/`By.`/`WebDriverWait`), pytest-playwright fixtures, Splinter, helium. Mobile: Detox
(`device.`/`element(by.id())`), Appium.

### Robot Framework
The imported Library in `*** Settings ***` is the dominant level signal; Robot suites are
rarely unit.
- E2E: `SeleniumLibrary` (`Open Browser`, `Click Element`), `Browser` (`New Page`, Playwright-based),
  `AppiumLibrary` (`Open Application`, mobile), `Selenium2Library` (legacy), `RPA.Browser.*`.
- API integration: `RequestsLibrary` (`Create Session`, `GET On Session`), `RESTinstance`/`REST`,
  `HttpLibrary.HTTP`, `RPA.HTTP`.
- DB integration: `DatabaseLibrary` (`Connect To Database`, `Query`).
- System integration: `SSHLibrary`, `FTPLibrary`, `ImapLibrary`, `Process` (subprocess),
  `OperatingSystem` (files), MQTT/Kafka libraries.
- Tags: `[Tags] e2e`/`integration`/`api` carry a level. `smoke` is level-neutral (it marks
  a fast subset, not a layer) - do not read a level from it; use the imported Library. RPA
  suites are E2E/system.

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

## Patterns only the semantic pass can catch (AI-only)

These need reading the test against its intent, the spec, and the production code. No AST or
linter sees them, and they are the reason the skill exists on top of the static scanners.
Each maps to a judgment (J1-J6). Confidence is operator-confirmed (treat as LOW/HIGH by how
clear the contradiction is); never auto-block on these without showing the reasoning.

- **S1 — Intent mismatch (J4).** The test name or docstring claims to verify X, but the
  assertion checks Y, or a trivial property. "test_applies_discount" that only asserts the
  call did not raise. Read the name and the assertion; if they disagree, flag.
- **S2 — Irrelevant oracle (J4).** The assertion checks a property unrelated to the behavior
  under test: a test of the computed total that only asserts the response is not null.
- **S3 — Plausible-but-wrong expected value (J2).** The expected constant looks reasonable
  but contradicts what the spec implies (off-by-one, wrong rounding, wrong sign). Deeper than
  C18: the AI derives the correct value from the spec and compares.
- **S4 — Oracle cannot distinguish correct from a likely bug (J4).** The assertion passes for
  both the right output and a plausible wrong one: `assert len(result) == 3` when the bug
  under suspicion also yields three items. The check is too coarse to fail on the real defect.
- **S5 — Tests the framework, not the code (J3).** The assertion exercises a language or
  library guarantee (a dict stores a key, the ORM returns what was just saved) instead of the
  user's logic. Green tells you Python works, not that the unit does.
- **S6 — Happy-path only against a stated contract (J4).** The spec/docstring promises error
  handling or boundaries, the test covers only the nominal path. A semantic coverage gap;
  static tools cannot read the contract.
- **S7 — Expected lifted from the output (J2).** Beyond C14's golden files: the AI recognizes
  that the expected value was copied from a run of the current code (a pasted dict, a captured
  response), so the test can only confirm the code matches itself.
- **S8 — Mock return reaches the assertion through an indirection (J3).** Deeper than C11:
  the stub's value flows through one or two trivial steps to the assertion, so the test still
  echoes the stub rather than verifying real behavior.
- **S9 — Self-fulfilling arrangement (J2).** The test arranges the exact state it then
  asserts, with no transformation by the unit under test (a cross-statement C11a).
- **S10 — Asserts the log, not the effect (J4).** The test checks that a message was logged
  instead of the state change the message describes.
- **S11 — Negative-only assertion on a security filter (J4).** A test of a sanitizer, redactor,
  or auth filter that asserts only the bad thing is absent (`secret not in output`,
  `assert "password" not in response`) passes for the wrong reason when the output is empty or
  the message was dropped entirely. Require a paired positive assertion that legitimate content
  survived (the safe field is still present), or treat the negative-only check as HIGH.
- **S12 — Patches core logic instead of an external edge (J3).** Deeper than case 10's static
  form: the test patches a private method or a direct collaborator on the class under test - a
  lambda or mock assigned to a private method, `patch.object` on a local instance, the receiver
  being the subject under test - so the assertion checks the stub, not the unit's own logic.
  Ask whether the patched method is an external edge (legitimate) or the unit's core behavior
  (the smell). Mocking the edge is fine; mocking the core under test is case 10.
- **S13 — Passes only via shared state a sibling set up (J6).** Beyond C15/C24/`var`-hoisting:
  the test reads or relies on module-global, fixture, or hoisted state that another test or an
  import mutates, so it passes only in a given execution order and fails when run alone. The J6
  question is per-test self-sufficiency, not assertion presence; flag order-dependence the AST
  cannot prove across files.
- **S14 — Recorded model output as the oracle (J2).** A test asserts `==`/`toEqual`/`assertEqual`
  against a snapshotted LLM/model result - a pinned completion, a captured embedding vector, a
  stored "LLM-as-judge" verdict, an agent transcript. The expected value was produced by a past
  run of the same non-deterministic model, so green means "the model still emits what it once
  emitted", not that the output is correct; a regression the model also produces is frozen as the
  truth. A specialization of S7 for the model-output case, common in agent/RAG/eval suites.
  ```python
  # BAD: expected is a captured completion from a previous run
  def test_summary():
      out = llm.complete(PROMPT)
      assert out == "The Q3 report shows revenue up 12% year over year."  # S14
  # CLEAN: assert an invariant the spec guarantees, not the exact text
  def test_summary_contract():
      out = llm.complete(PROMPT)
      assert "12%" in out and len(out) <= 280
  ```
- **S15 — Hand-rolled retry/poll loop masking flakiness (J6, LOW).** The loop-bodied equivalent of
  C35's decorator: the test wraps its action-and-assertion in a `for`/`while` retry, a
  `tenacity.retry`/`@retry`, or a poll-until-success, and passes if any iteration succeeds - the
  final failure is swallowed. Non-determinism is hidden, not fixed. J6 (does it pass
  deterministically in isolation?) cannot answer yes when the harness retries until lucky.
  Boundary: only the swallow-and-pass form is S15. A bounded retry that **re-raises on
  exhaustion** (`tenacity.retry(..., reraise=True)`, an explicit `else: raise`, an assertion
  after the loop) fails hard when every attempt fails, so it is closer to a sanctioned settle
  (`waitFor`/`Wait Until Keyword Succeeds`) than to a flakiness mask - do not flag it.
  ```python
  # BAD: retries the assertion, green if any attempt passes
  def test_balance():
      for _ in range(5):
          try:
              assert account.balance() == 100   # S15
              break
          except AssertionError:
              time.sleep(0.2)
  # CLEAN: one deterministic assertion after an explicit settle
  def test_balance():
      account.settle()
      assert account.balance() == 100
  ```
- **S16 — Call-verification as the sole oracle (J4, LOW).** The test's only check is that a
  collaborator was invoked - `assert_called_once`, `toHaveBeenCalled`, `verify(mock).method()` -
  with no assertion on the unit's own return value or state, so it goes green even when the SUT
  computes the wrong thing before delegating. Distinct from the `toHaveBeenCalled()` argument note
  below (a call assertion missing its arguments): S16 is the case where call-verification is the
  entire oracle. Pair the interaction check with an assertion on the result or state.
  ```python
  # BAD: only checks that save was called; nothing about what was computed
  def test_register(mock_repo):
      register_user("alice@example.com")
      mock_repo.save.assert_called_once()      # S16
  # CLEAN: assert the computed value, keep the call check as secondary
  def test_register(mock_repo):
      user = register_user("alice@example.com")
      assert user.normalized_email == "alice@example.com"
      mock_repo.save.assert_called_once_with(user)
  ```
- **S17 — Exception-path oracle blindness (J4, HIGH).** The test claims to verify the SUT's
  documented error contract, but `pytest.raises(Exception)` / `expect(fn).toThrow()` with no
  type or message goes green when the SUT never reaches its raise - the exception came from a typo
  in arrange, a missing import, or a None-deref before the SUT line. The semantic core of the
  "0% exception-path coverage" finding for LLM-generated tests. Distinct from S6 (error path
  omitted) and C9 (static broad-type shape): S17 is the judgment that the raise under test is the
  SUT's contract and the assertion cannot bind it to the SUT line. Pin the expected type and
  `match=`, and assert the raise originates from the call under test.
  ```python
  # BAD: a typo in arrange raises before the SUT line; the test goes green
  def test_withdraw_over_limit():
      acct = Acount(balance=10)            # typo: NameError, not the SUT's ValueError
      with pytest.raises(Exception):       # S17 — never reaches account.withdraw
          account.withdraw(50)
  # CLEAN
  def test_withdraw_over_limit():
      acct = Account(balance=10)
      with pytest.raises(InsufficientFunds, match="balance"):
          acct.withdraw(50)
  ```
- **S18 — Contract-impossible stub value (J3, LOW).** The test stubs an edge collaborator
  (legitimate, so not S12/C10) but configures its return to a value the real collaborator's
  contract can never emit - a negative price, a malformed row a typed ORM rejects, a `None` where
  the schema guarantees non-null. The SUT "handles" it and the assertion passes, but the branch is
  unreachable in production; the real defect (mishandling a VALID response) is never touched.
  Report LOW unless the contradiction is type-level and obvious. Drive the stub from a value the
  collaborator's contract can actually produce.
  ```python
  # BAD: get_price's contract returns a non-negative Decimal; -1 is impossible
  def test_apply_discount(mock_catalog):
      mock_catalog.get_price.return_value = Decimal("-1")   # S18 — unreachable branch
      assert apply_discount("sku", 0.1) == Decimal("0")
  ```
- **S21 — Self-judging LLM/agent assertion (J2, LOW).** In an LLM/agent/RAG suite the oracle
  is another model call: `assert judge_llm(f"is this correct? {out}") == "yes"`, an
  embedding-similarity threshold against a model-generated reference, or an agent asserting its own
  transcript looks reasonable. It passes whenever the judge is wrong in the same direction as the
  SUT - a circular oracle sharing the generator's failure modes. Adjacent to S14 (frozen past
  output); S21 is a LIVE model call as judgment. Replace the model verdict with a deterministic
  rubric, a structural validator, or a frozen human-labeled judge set.
  ```python
  # BAD: the grader is another model call with the same blind spots
  def test_summary_is_correct():
      out = summarize(doc)
      assert judge_llm(f"is this summary correct? {out}") == "yes"   # S21
  ```

Look-alikes - do NOT flag: a deliberately narrow unit test whose scope the spec confirms
(S6 needs a stated broader contract); a constant that the spec genuinely endorses (not S3);
a sanitizer test that already pairs the negative check with a positive one (not S11); a test
of a filter whose contract is to drop the input entirely - a blocklist sanitizer, a
guard that returns empty on a forbidden value, a redactor that suppresses the whole field -
where empty output is the correct behavior, so the negative-only assertion legitimately
passes and a positive "content survived" assertion would contradict the design (not S11); a
mock on a genuine external edge - DB, network, clock (not S12); a `jest.spyOn(instance, 'methodA')` / `vi.spyOn` that stubs a DIFFERENT method than the one under test, to isolate an orchestrator from a sibling sub-unit (the assertion is on the composed result, not the stub) - S12 fires only when the patched symbol is a method of the SUT instance itself or the assertion echoes the stub value (not S12); a constructor-injected or module-level collaborator mock - repository, db, auth, or HTTP client (a clean case-10 external edge, not S12); a stub-config call made on the very library under test - `mockingoose`, `tinyspy`, `jsdom-testing-mocks` - where the mocking library IS the SUT, so the stub setup is production code (not S5/S8/C11a); a test whose shared state is
reset by an autouse/`beforeEach` teardown (not S13); a structural or contract assertion on a
model output - valid JSON, required keys present, a cited source id matches, a refusal on a
banned prompt, a deterministic post-processing step - or a mocked/stubbed model whose return is
fixture data (not S14); a sanctioned async-settling wait - Robot `Wait Until Keyword Succeeds`,
Testing Library `waitFor`/`findBy*`, Playwright/Cypress auto-wait, `await expect(...).toPass()` -
that polls a real settle condition and still fails hard on timeout (not S15); a call-only
assertion where the interaction IS the contract - a fire-and-forget event, an audit-log or
telemetry write, a queue publish - or a `toHaveBeenCalledWith`/`assert_called_once_with` that
pins the specific arguments, or any call-verification paired with an assertion on the SUT's return value or state - S16 requires the call-verification to be the SOLE oracle (not S16); a `pytest.raises(SpecificError, match=...)` bound to the SUT line (not S17); a stub fed a value the collaborator's contract can actually return (not S18); a test under `*.problem.*` / `*.solution.*` / `exercises/` / `katas/` / `playground/` - a teaching or TDD-spec fixture whose expected value is intentional (the exercise IS the spec), not a frozen bug (not case 18, not S3); a deterministic rubric, structural validator, or frozen human-labeled judge set rather than a live model verdict (not S21).

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
  Exemptions — do NOT flag: `@pytest.mark.skip`, `@pytest.mark.xfail(strict=True)`,
  `@unittest.skip`, `@hypothesis`/`@given`/`@fuzz` decorators. A plain
  `@pytest.mark.xfail` (no `strict=`) is exempt ONLY when the project turns on strict
  xfail globally (`xfail_strict = true` in pytest.ini / `[tool.pytest.ini_options]` /
  setup.cfg, or `-o xfail_strict=true`): the marker then inherits strict and an XPASS
  fails the run. Otherwise a plain xfail still executes and an XPASS keeps exit status 0,
  so a no-assertion test stays false-green — check the pytest config first.
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

- **C2c — Empty `self.subTest(...)` block (J1, LOW):** a unittest `with self.subTest(...):`
  block that wraps work but contains no assertion — the subTest analogue of an empty test;
  each generated sub-case runs and verifies nothing. More specific than C2b (it owns this
  shape). Exemption: a subTest that asserts, raises, or delegates to a `check_*`/`verify_*`
  helper is not flagged.
  ```python
  # BAD
  for i in cases:
      with self.subTest(i=i):
          do_thing(i)               # no assertion inside the block
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

- **C6c — Mock `call_count` truthiness as the oracle (J4, LOW):** `assert m.call_count`
  (bare) passes on any count `>= 1`, so it checks only that the mock was called, not how
  many times. The receiver must be a known mock; an exact or lower-bounded count
  (`== N`, `>= 1`) is a real check. The always-true `m.call_count >= 0` form is C44.

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

- **C8b — Approximate equality with no explicit tolerance (J4, LOW):** `assertAlmostEqual`/
  `assertNotAlmostEqual` (default 7 places) or `== pytest.approx(...)` (default 1e-6 relative)
  with no `places=`/`delta=`/`rel=`/`abs=` supplied. The default tolerance can pass a meaningfully
  wrong value. Sizing the tolerance to the values (`places=2`, `rel=1e-3`) keeps it quiet.
  ```python
  # BAD
  self.assertAlmostEqual(total(), 4.2)          # default 7 places
  assert total() == pytest.approx(4.2)          # default 1e-6 rel
  # CLEAN
  self.assertAlmostEqual(total(), 4.2, places=2)
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
  passing xfail hides that the bug was fixed without removing the mark. Exempt
  when the project sets `xfail_strict = true` globally (pytest config or
  `-o xfail_strict=true`): the marker then inherits strict, so XPASS already fails
  the run — check the config before flagging.

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
  no check was performed on it. The Robot scanner reuses this same id for its
  own capture-never-used shape (`${x}= Get Text loc` never passed to a `Should`);
  see the Robot section. Documented reuse, same id, not drift (#105).
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

- **D7 — Anonymous test: empty or missing description (LOW):**
  A test with a blank title (`it('', ...)`) or registered with no name where the
  runner allows it. CI reports a blank or generated test name, so a failure is
  hard to locate. Give the test a description. (Runner-specific; see the TS/JS
  catalog - the falsegreen-js scanner emits this code.)

- **D8 — Magic number in an assertion (LOW):**
  A bare numeric literal as the expected value (`expect(x).toBe(86400)`) instead
  of a named constant that carries the meaning. Floats are C8's concern; D8 covers
  bare integers with absolute value greater than 1. Name the constant so the
  assertion reads as intent. (TS/JS catalog; emitted by the falsegreen-js scanner.)

- **M2 — Long test method (LOW):**
  The test function body exceeds 50 lines. Consider splitting into focused
  single-concern tests.

---

#### Family additions (catalog sync)

- **C38 — Two tests share a name (J1, HIGH):** two `def test_*` (module or class scope) with
  the same name. Python binds the later over the earlier, so the first never runs.
- **C39 — Returns a comparison instead of asserting (J1, HIGH):** `return x == y` in a test.
  pytest ignores the returned value (PytestReturnNotNoneWarning); nothing is checked.
- **C41 — Assertion on a None-returning mutator (J4, LOW, semantic):** `assert not lst.sort()`
  / `assertIsNone(lst.sort())`. Whether it is trivially green depends on the receiver's type,
  so this is a skill-only judgment, not a static one.
- **C42 — Assertion on a generator/lambda (J2, HIGH):** `assert (x for x in y)` / `assert
  lambda: ...`. The object is always truthy. A list/set/dict comprehension is NOT C42 (can be empty).
- **C43 — Mid-test skip (J1, LOW):** `pytest.skip()` after test logic, with checks below it
  that then never run. A skip at the top is a legitimate guard.
- **C44 — Numeric tautology (J2, HIGH):** `len(x) >= 0`, `abs(x) >= 0`, `len(x) > -1`, or a
  mock's `call_count >= 0` / `> -1`. The comparison is always true. The Robot scanner widens C44 under this same id to vacuous library assertions beyond the numeric form (`Should Contain ${EMPTY}`, `Should Not Be Empty ${TRUE}`, a `Length Should Be` tautology); see the Robot section. Same id, the Robot bucket is broader - documented, not silent drift (#96).
- **C45 — Empty parametrize (J1, HIGH):** `@pytest.mark.parametrize("...", [])`. Zero cases
  are generated, the test never runs.
- **C48 — Dark patch: flips a test-mode flag then asserts (J1, LOW):** the test forces a
  test-mode toggle into test mode (`os.environ["TESTING"] = "1"`, `settings.TESTING = True`,
  a `global`-declared `TESTING = True`) and then asserts, so it exercises the product's
  test-only branch (`if TESTING: ...`) instead of real behaviour. Cross-language: shared with
  falsegreen-js (`process.env.NODE_ENV == "test"`, `process.env.TESTING`); no idiomatic Robot
  form. Config values and product feature flags are not flagged.
- **C49 — `pytest.warns`/`assertWarns` wraps more than one call (J1, LOW):** the warning context
  spans several statements, so an unrelated earlier line may emit the warning while the target
  never does. The warns sibling of C19. Wrap only the call expected to warn.
- **C50 — Captured log never asserted (J4, LOW):** `caplog` / `assertLogs` captures log output
  but nothing reads or asserts it, so the capture has no effect on pass/fail. The logging sibling
  of C31. Assert on the captured records, or drop the capture.
- **C51 — Empty-bodied `pytest.raises`/`warns` context (J1, HIGH):** a `with pytest.raises(...)`
  or `pytest.warns(...)` block with no call inside, so the call that should raise is never made
  and the context cannot fail.
- **C52 — Membership self-confirmation (J2, LOW):** `assert x in {x}` / `assert x in [x, ...]`
  where the collection is built from the subject, so membership is true by construction. The
  membership variant of C7.
- **C55 — Assertion compares two mock-rooted values (J3, LOW):** `assert m.foo == m.bar` where
  both sides resolve to the test's own doubles, not the SUT, so the comparison says nothing about
  production behaviour.
- **C56 - Sync assert of a never-awaited coroutine (J1, LOW):** the operand of the assert is a call to a local async def, so the check runs on the coroutine object (always truthy), not its awaited value. BAD: assert fetch_user() where fetch_user is async def. CLEAN: assert await fetch_user() (or asyncio.run(...)).
- **C57 - Assertion against an unconfigured Mock attribute (J3, LOW):** the expected side is m.attr on a bare Mock()/MagicMock() with no spec; attribute access auto-creates a fresh truthy child mock, so the comparison can never meaningfully fail. BAD: m = Mock(); assert result == m.value. CLEAN: build with Mock(spec=...) or assert against a concrete value.
- **C59 - Bare comparison written as a statement (J1, HIGH):** result == expected on its own line - the boolean is computed and discarded, nothing is asserted. The loose-statement sibling of C39. BAD: result == expected. CLEAN: assert result == expected.

#### Look-alikes: do NOT flag these Python patterns

- `@pytest.mark.skip` or `@pytest.mark.xfail(strict=True)` on a test with an
  empty body → the test is explicitly disabled (skip) or fails on XPASS (strict
  xfail), not a C2. A plain `@pytest.mark.xfail` (no `strict=`) is exempt ONLY when
  the project sets strict xfail globally (`xfail_strict = true` in pytest config, or
  `-o xfail_strict=true`): it then inherits strict and an XPASS fails the run.
  Otherwise a plain xfail still executes and an XPASS keeps exit status 0, so it stays
  false-green — check the pytest config first.
- `@given`/`@hypothesis`/`@fuzz` decorated test with no explicit `assert`
  → hypothesis generates the assertions internally, not C2.
- A helper called from the test that contains the `assert`
  → not C2b; the assertion executes through the helper. Same for a fluent matcher
  whose check lives in the chained call, not the `assert` keyword: `hamcrest.assert_that(x,
  equal_to(y))`, assertpy `assert_that(x).is_equal_to(y)`, `numpy.testing.assert_allclose`/
  `assert_array_equal`, `pandas.testing.assert_frame_equal`/`assert_series_equal`. Absence of
  the bare keyword `assert` is not absence of verification.
- A pytest plugin meta-test whose oracle is the runner-result object, not an `assert`:
  `result.assert_outcomes(passed=1)`, `result.stdout.fnmatch_lines([...])` /
  `result.stdout.no_fnmatch_line(...)`, `assert_contains_lines`, or `result.ret == 0` (the
  `pytester`/`testdir`/`pytest.Pytester` API). These ARE the verification → not C2b. And the
  test source passed to `makepyfile(...)` / `makeconftest(...)` / `maketxtfile(...)` as a string
  is fixture data, not a collected test → do not apply any C-code to a `def test_*` written
  inside such a string.
- `for x in (1, 2, 3): assert x` → not C1; literal is always non-empty.
- `assert response` in an HTTP test / `assert locator` in a Playwright test
  → not C6; presence IS the assertion at that layer.
- `assert x == x` where the test also checks `x != peer` or `hash(x)`
  → testing `__eq__`/`__hash__`, not C7.
- freezegun/time_machine imported → unfreeze `datetime.now()` is NOT C16.
- `patch(..., autospec=True)` → not C13b.
- `with pytest.raises(E) as exc: ...; assert "msg" in str(exc.value)`
  → exc is read, not C28.
- `with pytest.raises(BroadException) as exc: ...; assert str(exc.value) == ...` (or any
  assertion on `exc.value.<attr>` / the bound message) → not C9 and not S17. The bound
  message assertion narrows the broad type to the SUT's contract, so it is the type-narrowing
  oracle even when the caught type is broad. Equivalent to or stronger than `match=`.

### TypeScript / JavaScript

**False-green code catalog (shared with the [falsegreen-js](https://github.com/vinicq/falsegreen-js) scanner).**
Same code id where the smell matches the Python concept; `JS*` codes are
ecosystem-specific. Runner-agnostic across Jest, Vitest, Mocha+Chai, Jasmine, AVA,
node:test, Cypress, Playwright, and Testing Library.

| Code | Conf | Pattern |
|---|---|---|
| C2 | HIGH | empty test body |
| C2b | LOW | calls the unit but never asserts |
| C5 | HIGH | always-true (`expect(true).toBe(true)`, `assert(1)`) |
| C7 | HIGH | self-compare (`expect(x).toBe(x)`) |
| C8 | LOW | exact equality on a float |
| C9 | LOW | `toThrow()` with no error type or message |
| C16 | LOW | depends on `Date.now`/`Math.random`/fixed timer |
| C18 | LOW | stringified equality (`String(x)`/`JSON.stringify`/`` `${x}` ``) |
| C21 | LOW | every assertion is conditional |
| C37 | LOW | duplicate `it.each`/`test.each` case |
| C44 | HIGH | numeric tautology on a length (`expect(x.length).toBeGreaterThanOrEqual(0)`) |
| C48 | LOW | dark patch: flips a test-mode flag (`process.env.NODE_ENV = "test"`, `process.env.TESTING`) then asserts |
| CC | LOW | commented-out assertion |
| JS1 | HIGH | focused test (`it.only`/`fit`) skips the rest of the suite |
| JS2 | HIGH | `expect(x)` with no matcher |
| JS3 | LOW | snapshot is the only assertion |
| JS4 | LOW | skipped test (`it.skip`/`xit`/`it.todo`) |
| JS5 | LOW | async query/event not awaited (`findBy*`/`waitFor`/user-event) |
| JS6 | HIGH | empty `describe`/`suite` |
| JS7 | LOW | assertion in a non-awaited `setTimeout`/`then` callback |
| JS9 | HIGH | assertion in a dead literal branch (`if(false)`) |
| JS11 | LOW | `try/catch` swallows the assertion |
| JS13 | LOW | `queryBy*`/`queryAllBy*` query (returns null when absent) as a loose statement, never asserted - `getBy*`/`getAllBy*`/`findBy*`/`findAllBy*` throw on absence and ARE the assertion |
| C6 | LOW | weak check (`toBeTruthy`/`toBeDefined`, `.length > 0`) |
| C20 | HIGH | assertion in dead code after `return`/`throw` |
| C23 | LOW | reads a real file at a literal path / hard-coded URL (mystery guest) |
| JS8 | LOW | mocks the unit under test and asserts it directly |
| JS15 | LOW | comparison wrapped in a boolean (`expect(a===b).toBe(true)`) |
| JS17 | LOW | commented-out test block (`// it(...)`) |
| JS18 | LOW | `done` callback instead of async/await |
| JS21 | HIGH | matcher referenced but never called (`expect(x).toBe` with no `()`) |
| JS22 | HIGH | empty `it.each`/`test.each` table |
| JS23 | HIGH | `expect.assertions(N)` with fewer unconditional reachable `expect()` calls than `N` |
| JS24 | LOW | Cypress `cy.get/find/contains` query statement with no `.should`/`.and`/`.then` assertion |
| JS25 | HIGH | the only assertion sits inside an array-iterator callback (`forEach`/`map`/`filter`/`some`/`every`/`flatMap`) - runs zero times on an empty collection |
| JS26 | LOW | fake timers installed but never advanced (`runAllTimers`/`advanceTimersByTime`/`tick`) - the scheduled callback never fires, so the assertion reads un-mutated state |
| JS27 | LOW | `toHaveBeenCalled*` is the sole oracle on a locally-created double - verifies wiring, not behaviour |
| JS29 | LOW | `expect(...).resolves`/`.rejects` chain is a bare statement, not awaited or returned - the test finishes green before the matcher settles |
| JS30 | HIGH | literal-vs-literal assertion (`expect(2).toBe(3)`, chai `expect(x).to.equal(y)`) - both operands are fixed at parse time |
| JS31 | LOW | `try/catch` swallows a possible throw with no assertion on the exception - a unit that stops throwing still passes green |

Note: supertest / chai-http `.expect()` (`request(app).get("/").expect(200)`) is a real
assertion at the API layer - do not flag such a test as C2b.

**Maintainability group (opt-in, default off).** Not false-green - the test still
protects. Apply only on a diagnostic pass: D1 assertion roulette, D3 duplicate
assert, D4 untitled `it.each` cases, D6 `console.*` in a test, D7 anonymous test
(empty/missing description), D8 magic number in an assertion (a bare numeric
literal instead of a named constant), M2 over-long test body.

The prose below details the higher-prevalence patterns with examples and citations.

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

- **HTTP header case sensitivity trap — supertest / node-fetch (J4, HIGH):**
  `supertest` normalizes all response header names to **lowercase** in
  `res.headers`. A PascalCase lookup like `res.headers['Content-Type']` or
  `Object.prototype.hasOwnProperty.call(res.headers, 'Content-Type')` always
  returns `undefined` / `false`, regardless of whether the server sent that
  header. Assertions that rely on PascalCase keys are vacuously true (absence
  check) or silently skipped (presence check). Use the lowercase key
  `'content-type'` or the `.expect()` helper which handles normalization.
  Evidence: koajs/koa `respond.test.js` — 12 tests across 9 describe blocks.
  ```javascript
  // BAD — always false regardless of server output
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(res.headers, 'Content-Type'), false
  )
  // CLEAN
  assert.strictEqual(
    Object.prototype.hasOwnProperty.call(res.headers, 'content-type'), false
  )
  ```

- **Bitwise NOT coercion masking absent header — `~~undefined === 0` (J4, HIGH):**
  `~~value` coerces `undefined` and `null` to `0`. When used to convert a
  response header to an integer, an absent header produces `0` rather than a
  meaningful error. The assertion then compares against the expected numeric
  value; if that value happens to be `0`, the test passes silently even though
  the header was never sent. Use explicit presence checks before numeric
  conversion.
  Evidence: koajs/koa `respond.test.js` line ~174.
  ```javascript
  // BAD — ~~undefined === 0, masks absent header
  assert.strictEqual(~~res.header['content-length'], expectedLength)
  // CLEAN
  assert.ok(res.header['content-length'] !== undefined, 'header must be present')
  assert.strictEqual(parseInt(res.header['content-length'], 10), expectedLength)
  ```

- **Self-referential field oracle — result read-back as expected value (J2, HIGH):**
  An assertion uses a field from the actual query result as the expected value
  inside the same `toEqual()` call: `expect(result).toEqual([{ createdAt:
  result[0]!.createdAt }])`. The comparison is always equal by construction;
  any encoding, timezone, or type bug in that field is invisible. Common with
  server-generated timestamps. Use a literal or a known-good fixed date.
  Evidence: drizzle-team/drizzle-orm `pg-common.ts` — 8-12 occurrences per file.
  ```typescript
  // BAD — createdAt always matches itself
  expect(result).toEqual([{ id: 1, name: 'Alice', createdAt: result[0]!.createdAt }])
  // CLEAN
  const knownTime = new Date('2024-01-15T10:00:00.000Z')
  expect(result).toEqual([{ id: 1, name: 'Alice', createdAt: knownTime }])
  ```

- **`toHaveBeenCalled()` without argument verification (J4, LOW):**
  The assertion confirms a callback or spy was invoked but does not verify what
  arguments it received. The test passes even if the function was called with
  wrong values, wrong types, or wrong shape. Prefer `toHaveBeenCalledWith()`
  with a specific argument matcher.
  Evidence: react-hook-form `controller.test.tsx` — onChange and onBlur handlers.
  ```typescript
  // BAD — passes even if onChange was called with wrong value
  expect(onChange).toHaveBeenCalled()
  // CLEAN
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ target: { value: 'Alice' } }))
  ```

- **`resolves.toBeDefined()` as async return contract (J4, LOW):**
  `await expect(promise).resolves.toBeDefined()` passes for any resolved value
  except `undefined` — including `null`, `false`, `0`, `''`, or an error
  object. It does not verify the shape or meaning of the resolved value. If the
  contract specifies a particular structure, assert against it.
  Evidence: react-hook-form `useController.test.tsx`.
  ```typescript
  // BAD — passes for null, '', {error: true}, anything but undefined
  await expect(field.onChange(val)).resolves.toBeDefined()
  // CLEAN — assert the actual contract
  await expect(field.onChange(val)).resolves.toEqual(expect.objectContaining({ success: true }))
  ```

- **`Array.every()` aggregation hiding per-input failure (J4, LOW):**
  Validation tests that feed N inputs through a `.every(fn)` call and assert
  the resulting boolean. When the test fails, the message is `false !== true`
  with no indication of which input caused it. Coverage is also one assertion
  for N cases. Use `it.each` or a `for...of` loop so each input gets its own
  result.
  Evidence: colinhacks/zod `string.test.ts` — email, E.164, cuid2 sets.
  ```typescript
  // BAD — which email failed?
  expect(validEmails.every(e => emailSchema.safeParse(e).success)).toBe(true)
  // CLEAN
  for (const email of validEmails) {
    expect(emailSchema.safeParse(email).success, `should accept: ${email}`).toBe(true)
  }
  ```

- **Internal field access via underscore naming convention (J5, HIGH):**
  Fields prefixed or suffixed with `_` (e.g. `control._fields`, `computed.value_`,
  `store._state`) are implementation internals by convention in most JS/TS
  libraries. Tests that read or write them couple to the private representation;
  any refactoring that preserves the public API but renames internals breaks
  the test. Use the public getter or accessor method instead.
  Evidence: react-hook-form `controller.test.tsx` (`control._fields`),
  mobxjs/mobx `observables.js` (`computedValue.value_`).
  ```typescript
  // BAD — _fields is a private internal of react-hook-form
  expect((control as any)._fields?.email?.required).toBeFalsy()
  // CLEAN — use public API to observe the validation result
  await trigger('email')
  expect(formState.errors.email).toBeDefined()
  ```

- **Sign-then-verify tautology — JWT / HMAC positive test only (J2, LOW):**
  A test that signs a payload and immediately verifies it with the same key,
  asserting `verifiedPayload === originalPayload`. This passes even if
  `verify()` skips the signature check entirely. Severity is LOW when adjacent
  negative tests (wrong key, tampered token) prove the verification is
  enforced. Without those negative tests, severity is HIGH.
  Evidence: honojs/hono `jwt.test.ts`.
  ```typescript
  // BAD in isolation (no accompanying negative tests)
  const token = await JWT.sign(payload, secret, 'HS256')
  const verified = await JWT.verify(token, secret, 'HS256')
  expect(verified).toEqual(payload) // passes even without sig verification
  // CLEAN: add the mitigating negative tests shown in semantic_cases.ts
  ```

- **Numeric tautology on a length, `.length >= 0` (J2/C44, HIGH):**
  `expect(x.length).toBeGreaterThanOrEqual(0)` always holds: a `.length` is
  never negative. The check passes for an empty array, a full one, anything.
  The subject must be a direct property access ending in `.length`; a derived
  expression that merely mentions `.length` (`a.length - b.length`) can be
  negative and is not flagged. The Python form is `len(x) >= 0` (see C44 above).
  Bound forms against `Infinity` (`toBeLessThan(Infinity)`,
  `toBeGreaterThan(-Infinity)`) are NOT a tautology: they are false for `NaN`,
  so they still catch a value that escaped to `NaN` and are not flagged.
  ```typescript
  // BAD: length is never negative; always true
  expect(result.length).toBeGreaterThanOrEqual(0)
  // CLEAN: assert the actual length
  expect(result.length).toBe(3)
  ```

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

3. **Type-level assertions**: compile-time type assertions do nothing at runtime but
   fail at `tsc` time if the type no longer matches, so they are not C5 (always-true) and not
   C2b (no runtime check). Covers `expectTypeOf(v).toEqualTypeOf<T>()` (vitest/expect-type), tsd
   `expectType<T>(v)` / `expectError(...)`, and a hand-rolled `type _X = Expect<Equal<A, B>>`
   (the `Expect<Equal<>>` / `IsExact<>` idiom). Do not flag any of these.

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

4. **Testing-Library throwing queries** — `getBy*`/`getAllBy*`/`findBy*`/`findAllBy*`
   throw when the element is absent (or the promise rejects), so the bare query IS an
   assertion. Not C2b and not JS13. Only `queryBy*`/`queryAllBy*` return `null` instead of
   throwing, so a bare `queryBy*` with no following assertion is the check-free JS13 case.

5. **A guarded `if (cond) throw new Error(...)`** or a `node:assert` call (`assert(cond)`,
   `assert.equal(...)`, `assert.ok(...)`): a hand-rolled oracle. The throw fails the test
   when the condition does not hold, so it is a real check, not a no-assertion C2b.

6. **A `try/catch` whose catch contains assertions, guarded by `expect.assertions(N)` or
   `expect.hasAssertions()`**: not JS11 and not JS31. The guard fails the test if the expected
   throw never comes (the catch never runs, so fewer than N assertions execute), so the swallowed
   exception cannot go unnoticed. The swallow smell needs the absence of such a guard.

---

## Visual testing (Percy, Chromatic, Playwright screenshots, Storybook)

Visual-regression tools verify appearance, not behavior, and the oracle usually lives
**outside** the test run:

- **Percy / Chromatic:** `percySnapshot(name)` / `cy.percySnapshot()` captures the DOM or
  a screenshot and **uploads it**; the diff is computed server-side and **approved by a
  human in a dashboard**, asynchronously. The local test verifies nothing - a test whose
  only check is `percySnapshot()` is false-green locally (no runtime oracle; J1/J2). Treat
  `percySnapshot`/`cy.percySnapshot` as a NON-assertion: a test with only it is
  no-verification (C2b-equivalent).
- **Playwright / Storybook screenshots:** `expect(page).toHaveScreenshot()` /
  `toMatchScreenshot()` is a snapshot whose baseline is generated from the output - if it
  is the only assertion, that is snapshot-only (JS3 / C14): it detects change, not
  correctness.

Look-alike - do NOT flag: a visual snapshot **alongside** a behavioral assertion
(`expect(value).toBe(...)`) is fine; the behavioral check is the oracle.

## Robot Framework

Detection cues: `.robot` / `.resource` files; sections `*** Test Cases ***`, `*** Keywords ***`,
`*** Settings ***`; keyword-driven, tab/space-aligned. Robot runs on Python, but a `.robot`
file is a DSL, not Python - the static scanners cannot parse it, so this is a semantic,
text-based pass. Map each finding to J1-J6.

**What counts as a verification keyword (the oracle), across libraries.** Robot's
ecosystem has 100+ libraries; the false-green check hinges on recognizing the assertion
keywords so a real check is not mistaken for "no verification". The dominant convention is
the word **`Should`**, plus library-specific forms:

- **BuiltIn:** `Should Be Equal`, `Should Be True`, `Should Contain`, `Should Match`,
  `Should (Not) Be Empty`, `Should Start/End With`, `Length Should Be`,
  `Should Be Equal As Strings/Numbers`, `Should Contain X Times`.
- **Collections:** `List Should Contain Value`, `Dictionary Should Contain Key`,
  `Lists Should Be Equal`, `Length Should Be`.
- **String:** `Should Be (Lowercase/Uppercase/String)`.
- **SeleniumLibrary / AppiumLibrary:** `Page Should Contain*`, `Element Should Be Visible`,
  `Element Text Should Be`, `Title Should Be`, `Location Should Be`,
  `Element Should (Not) Be Visible`. `Wait Until Page Contains` / `Wait Until Element Is
  Visible` also verify (they fail on timeout) - do not treat as mere waits.
- **Browser (Playwright):** the **assertion engine** - `Get *    <selector>    <operator>
  <expected>` where operator is `==`, `!=`, `contains`, `validate`, `matches`, `>`, `<`,
  `>=`, `<=`, `*=`, `^=`, `$=`. **A `Get ...` keyword with NO operator is a plain getter -
  it verifies nothing.** A test whose only Browser step is `Get Text    h1` (no operator,
  result not passed to a `Should`) is false-green.
- **RequestsLibrary:** `Status Should Be`, `Request Should Be Successful`.
- **RESTinstance:** schema keywords assert the response - `Integer`, `Number`, `String`,
  `Boolean`, `Object`, `Array`, `Null`, `Missing`. `Output` only prints (not a check).
- **DatabaseLibrary:** `Row Count Should Be Equal`, `Check If (Not) Exists In Database`.
- A project **custom keyword** whose name contains `Should`/`Verify`/`Assert`/`Check` and
  that internally calls one of the above.

A test case with none of the above (only actions: `Click`, `Go To`, `Input Text`,
`Log`, bare `Get *`) verifies nothing.

False-green patterns (the verification keyword is the oracle):

- **No verification keyword (J1):** a test case runs keywords but never calls a
  verification keyword (`Should Be Equal`, `Should Contain`, `Should Be True`,
  `Page Should Contain*`, `Element Should Be Visible`, or a custom assertion keyword).
  The keyword equivalent of an assertion-free test.
- **Empty test case (J1):** only `[Documentation]`/`[Tags]`/setup, no body keywords.
- **Swallowed failure (J1, C3):** `Run Keyword And Ignore Error` / `Run Keyword And Return Status`
  wrapping the action without asserting the returned status/message afterward. The test
  stays green whether or not the keyword failed. The consolidated catalog tags this RF3;
  here it shares the id `C3` with the siblings.
- **Status captured, never asserted (J4, C3):** `${status} =    Run Keyword And Return Status    ...`
  where `${status}` is never checked with `Should Be True`/`Should Be Equal`. Same C3 id as
  the swallow form (this is the status-variable variant of RF3).
- **Always-true check (J2, C5):** `Should Be True    ${TRUE}` / `Should Be True    True` /
  `Should Be Equal    1    1`.
- **Should Be True on a string literal (J4, R6):** `Should Be True    some text` passes a
  non-empty bare string literal, not a boolean expression. A non-empty string is always
  truthy, so the check never fails. This is the literal case only: a bare variable
  (`Should Be True    ${x}`) is the truthiness-only C6 **when `${x}` holds a non-boolean
  value** - you should assert its actual expected value, not just that it is truthy. The
  only exemption is a variable with a genuinely boolean provenance: a status captured from
  `Run Keyword And Return Status`, or an `Evaluate` of a comparison. Asserting that with
  `Should Be True    ${status}` is the correct boolean oracle (see "Status captured" above),
  not C6. Any other bare variable stays C6. An expression with operators
  (`Should Be True    ${n} > 0`, `${a} and ${b}`) is also a real oracle and is not flagged.
  Pass a real expression, not a bare literal.
- **Self-compare (J2, C7):** `Should Be Equal    ${x}    ${x}`.
- **Self-confirming literal (J2, C11a):** `${y}=    Set Variable    ${x}` then `Should Be Equal
  ${x}    ${y}` - the expected side is a copy of the actual, so the oracle confirms itself. The
  Robot form of the assign-then-assert C11a; same id as the Python self-confirming literal.
- **Captured value never used (J4, C31):** `${x}=    Get Text    loc` (or any capture) whose
  value is never passed to a `Should`, so the capture is dead and the test verifies something
  else. This shares the id with the Python capsys C31: the Python form is a discarded
  `readouterr()`, the Robot form is a discarded `Get` capture. Same concept (a capture nothing
  asserts on), same id - documented reuse, not silent drift (#105). Mirror of the C44 note style.
- **Catch-all expected error (J4, C9):** `Run Keyword And Expect Error    *` (or the
  explicit-glob form `GLOB:*`) where the pattern is just a glob star. Any error satisfies
  the glob - including one from a typo in the test itself - so the oracle is vacuous. This
  is the glob-wildcard case only: `EQUALS:*` and `STARTS:*` are literal/prefix matchers
  that require the error message to actually be (or start with) `*`, so they are not
  catch-alls. The regex form `REGEXP:.*` (also `REGEXP:.+` / `REGEXP:^.*$`) matches every
  message and IS a catch-all; a bare `.*` without the `REGEXP:` prefix is glob, where `.`
  is literal, so it only matches messages starting with a dot and is not. Match the
  specific message/pattern instead.
- **Verification after a terminator (J1, C20):** a `Should ...` (or other check) placed
  after `[Return]`, `Return From Keyword`, `Fail`, or `Pass Execution` in the same block.
  Nothing after the terminator runs, so the check is dead. Move it before the terminator.
- **Duplicate [Template] data row (J4, C37):** a `[Template]` test whose data table repeats
  an earlier row's argument tuple. The duplicate drives the templated keyword with the same
  inputs and adds no coverage. Remove the repeated row.
- **Commented-out verification keyword (J1, CC):** a line like `# Should Be Equal    ${a}    ${b}`
  in the body - the oracle is switched off. Restore the keyword or delete the line.
- **Forced green (J1, R1):** `Pass Execution` (or `Pass Execution If` with a condition that
  always holds) forces the test to pass regardless of any check. Remove it; let the checks
  decide the result.
- **Hollow verifier keyword (J1, R2):** a user keyword named like an oracle
  (`Verify *` / `Assert *` / `Should *` / `Check *`) whose body contains no verification
  keyword. A test calling `Verify Login` looks protected but nothing is asserted - the root
  cause of a missed C2b.
- **Sleep as synchronization (J1):** `Sleep    2s` used instead of `Wait Until *`; result
  depends on timing.
- **Skipped (J1):** `[Tags]    robot:skip` / `Skip` / `Skip If` that always skips.
- **Vacuous library assertion (J2, C44):** a library assertion provably true for any runtime
  value: `Should Contain    ${x}    ${EMPTY}` (every string contains empty), `Should Not Be
  Empty    ${TRUE}`, `Should Be Empty    ${EMPTY}`, or a `Length Should Be` against a fixed
  length. The Robot analogue of the Python/JS `C44` numeric tautology. Two free variables or a
  runtime-computed length are not flagged.
- **Oracle pinned to a constant-true Set Variable If (J2, C5):** `${expected}=    Set Variable
  If    ${TRUE}    ok    fail` whose result feeds the expected side of a later `Should Be Equal`
  pins the oracle to a value the test fixed. The Robot form of the always-true family.
- **Conditional-only verification (J1):** the only verification lives inside a
  `Run Keyword If` whose condition may never hold.
- **Verification only in Setup (J4, R8):** the only verification keyword lives in `[Setup]` /
  `Test Setup`, so it checks preconditions before the body acts. The body can break and the
  suite stays green. Move the oracle into the test body.
- **Verification only in Teardown (J4, R8b):** the only verification keyword lives in
  `[Teardown]` / `Test Teardown`. Teardown runs even when the body fails and reports on a
  separate axis, so it does not gate the behaviour under test.
- **RequestsLibrary `expected_status=any` (J4, C9b):** an HTTP method called with
  `expected_status=any` / `anything` accepts every status, so the oracle is disabled and a 500
  never fails the test. Pin the expected status, or assert it explicitly.
- **No Operation only (J1, R4):** the only step is `No Operation` - the test/keyword runs but
  does nothing.
- **Empty [Template] (J1, R5):** a `[Template]` keyword with no data rows generates zero cases.
- **Hollow [Template] keyword (J1, R7):** a `[Template]` test whose in-file template keyword
  contains no verification keyword - every generated case runs the keyword but asserts nothing.
  Distinct from R5 (which is zero rows) and R2 (a non-template hollow verifier): R7 is the
  templated-case variant. Add a verification to the template keyword, or template a verifier.
- **Test Cases in a .resource (J1, R3):** a `*** Test Cases ***` section in a `.resource`
  file is invalid; the cases never run.
- **Empty keyword (J1, C2):** a user keyword with only settings and no steps does nothing.
- **Hard-coded IP-address URL (J6, C23):** `http://10.0.0.5:8080` in test data ties the test
  to one machine (a hostname URL is too common in E2E to flag).
- **Control flow at test level (J4, D2, off by default):** `IF`/`FOR`/`WHILE`/`TRY` directly in
  a test case (not a keyword). Diagnostic, not false-green: the guide advises moving control flow
  into a keyword to keep the case flat. Off by default like the other diagnostics.
- **Long test (J5, M2, off by default):** a test/task with too many steps (the guide suggests a
  max of ~10). Coupling, not false-green: split into focused cases or extract keywords. Off by
  default; shares the M2 id with the Python/JS over-long-test-body code.

Look-alikes - do NOT flag:
- `Run Keyword And Expect Error` with a SPECIFIC message/pattern, or
  `Run Keyword And Continue On Failure` followed by a check - these ARE asserting. Only the
  catch-all star pattern (C9 above) is the smell.
- `Wait Until Keyword Succeeds` - legitimate retry for E2E flakiness, not a Sleep smell.
- Teardown keywords (`[Teardown]`, `Close Browser`) - cleanup, not the oracle.
- E2E/UI presence keywords (`Page Should Contain Element`) ARE the assertion at the
  browser layer - do not treat as weak.
- Role files with no body oracle by design: a `.resource` keyword library (no
  `*** Test Cases ***`), or a DataDriver/`[Template]` suite whose body is intentionally empty
  because the data table or external data file IS the oracle - do not flag empty, `No Operation`,
  or hollow-verifier on those. The directory (`testdata/`, `resources/`, `fixtures/`) is a hint,
  never the rule: still flag a file that defines real `*** Test Cases ***`.
- A demo or example whose contract is non-failure - it acts and Logs, runs-without-error is the
  pass criterion, no behavior is named or captured-and-checked - is not no-verification. But an
  `examples/` or `performance/` file is NOT exempt by location: a test case that names a behavior
  and captures a result without asserting on it (e.g. `Test TF2 Operations` with three `Get Tf`
  calls and no Should) is a real false-green - flag it.
- RESTinstance `Expect Request` / `Expect Response` armed in `[Setup]` / `Test Setup` - not R8.
  It installs the schema validation the later request enforces (the request fails when the
  contract is violated), so the verification runs in the body even though it is configured in setup.
- External-report-merge keywords - oxygen `Run JUnit` / `Run Gatling` / `Run Zap` and similar -
  are the oracle. The merged external report carries the pass/fail; the keyword is not a bare action.
- `Pass Execution If` / `Skip If` gated on a runtime or environment condition (library/tool
  version, OS, available feature) is a sanctioned conditional skip, not R1 forced-green. R1 is
  only an unconditional `Pass Execution` or a `Pass Execution If` whose condition always holds.
- Screenshot keywords (`Capture Page Screenshot`, `Capture Element Screenshot`) are diagnostic
  artifacts, not assertions - their presence neither adds nor removes verification.

These mirror the static codes conceptually: no-verification ≈ C2b, empty ≈ C2,
swallowed/status-never-asserted ≈ C3 (catalog RF3), always-true ≈ C5, string-literal-truthy ≈ R6
(catalog RF17), self-compare ≈ C7, catch-all expected error ≈ C9, dead-step-after-terminator ≈ C20,
duplicate-template-row ≈ C37, commented-out-verification ≈ CC, forced-green ≈ R1, hollow-verifier ≈ R2,
sleep ≈ C16, skip ≈ C32, conditional-only ≈ C21, No-Operation-only ≈ R4, empty-template ≈ R5
(catalog RF18), hollow-template ≈ R7, Test-Cases-in-resource ≈ R3, IP-URL ≈ C23, test-level
control-flow ≈ D2 (diagnostic, off).

---

## Project layer (config-audit)

These are not a smell inside any one test: the suite goes green by **configuration**, not by a
real check, so the whole run can pass while protecting nothing. The static scanners surface them
only in `--config-audit` mode (reading pytest/jest/vitest/robot run config), never in the per-file
scan. Listed here so the skill catalog is a true superset of the scanners.

- **No coverage gate (J5, PL7):** no `--cov-fail-under` / `[tool.coverage.report] fail_under`
  (Python), `coverageThreshold` (Jest) or `coverage.thresholds` (Vitest). Coverage can fall to
  zero and the suite still passes. Set a coverage floor.
- **Run stops early (J5, PL8):** `-x` / `--maxfail` / `--exitfirst` in pytest `addopts`, or `bail`
  in jest/vitest. The reported test count is incomplete - a green run may have skipped most tests.
- **Warnings not promoted (J1, PL2, Python):** `filterwarnings` does not turn warnings into errors,
  so deprecations and runtime warnings pass silently. Set `filterwarnings = error`.
- **Asserts stripped at runtime (J1, PL1, Python):** the resolved config runs under python -O/-OO or with PYTHONOPTIMIZE set, which removes every assert statement - the whole suite passes with no checks. Run without -O and unset PYTHONOPTIMIZE.
- **passWithNoTests (J1, PL10, JS/TS):** jest/vitest `passWithNoTests` lets an empty or
  fully-filtered suite report green. Drop it so a no-test run fails.
- **Skip-on-failure run option (J1, PL9, Robot):** `--skiponfailure` / `--noncritical` in the run
  config turns a failing test into a non-fatal pass (legacy, removed in RF 4+). Remove it.

---

## Gherkin / BDD (`.feature`)

Detection cues: `.feature` files; `Feature:`, `Scenario:` / `Scenario Outline:`,
`Given` / `When` / `Then` / `And` / `But`, `Examples:`. Used by Cucumber.js (JS/TS step
defs), behave and pytest-bdd (Python step defs), SpecFlow (C#). The `.feature` file is
Gherkin (a DSL), not code; the step definitions live in `.js`/`.ts`/`.py` and are covered
by the static scanners. This is a semantic, text-based pass over the scenarios.

False-green patterns (the `Then` step is the oracle):

- **Scenario with no `Then` (J1):** only `Given`/`When` steps - the scenario exercises
  behavior but never states an expected outcome. The BDD equivalent of an assertion-free test.
- **`Then` that does not verify (J4):** a `Then` step whose definition only acts or logs
  (navigates, clicks, prints) without asserting. Needs the step-def body to confirm.
- **Empty scenario / outline with no `Examples` (J1):** a `Scenario Outline` whose
  `Examples:` table is empty runs zero times.
- **Tautological Then (J2):** `Then 1 equals 1` / a step that asserts a constant.

Look-alikes - do NOT flag:
- A `Then` whose step definition does assert (presence at the UI layer counts for E2E
  features).
- `@skip`/`@wip`/`@manual` tagged scenarios - intentionally not run (report as J1 skipped, low).

These mirror the static codes: no-Then ≈ C2b, empty ≈ C2, tautological Then ≈ C5.

---

## Tavern (`*.tavern.yaml`)

Detection cues: `*.tavern.yaml` / `*.tavern.yml`; YAML with `test_name:`, `stages:`, each
stage holding a `request:` and a `response:`. Tavern is a pytest plugin for HTTP/MQTT API
testing - the test is YAML (a DSL), executed by pytest. Semantic, text-based pass; the
`response:` block is the oracle.

False-green patterns:

- **Stage with `request:` but no `response:` (J1/J4):** the call is sent but nothing is
  verified; the stage passes as long as the request does not error. The API equivalent of
  an assertion-free test.
- **`response:` checks only `status_code` (J4):** `response: { status_code: 200 }` with no
  `json`/`headers`/schema when the body is what matters - "something came back", like C6.
- **Overly broad status acceptance (J4):** a `status_code` list/range that accepts almost
  any outcome.
- **`verify_response_with` external function that does not assert (J3/J4).**

Look-alikes - do NOT flag:
- A setup-only stage followed by a later stage that does validate the response.
- `response:` with a `json:` body match or `$ext` schema validation - a real oracle.

Mirror: no-response ≈ C2b, status-only ≈ C6.

---

## The oracle hierarchy

The expected value must come from a source independent of the code:

1. **Explicit spec or requirement** (spec document, ticket, RFC)
2. **Documented contract** (docstring, type annotations, API docs)
3. **Independent human judgment** (the tester's own derivation)
4. **The current code** (lowest priority - this is where bugs hide)

Promoting the current code to the top of this hierarchy is how a bug gets
frozen as "correct". The semantic pass enforces this hierarchy.

## F7 - AI-fix gate adjudication (semantic skill + mutation)

When the skill runs in AI-fix mode (Mode C in `SKILL.md`), it proposes a
strengthened test and self-validates it with Mode A. That self-check proves the
proposed test is structurally able to fail; it does not prove the test fails on
*this* bug. Mutation is what closes that gap, and the skill does not run it. F7 is
the rule the host or developer applies to the gate result, and the output contract
is `schema/fix-validation.json`.

### The bidirectional gate

Run the strengthened test twice:

- **Clean replica** (code unmodified): the test must **pass**. A fail here means
  the test is wrong or the environment is unstable, not that the fix works.
- **Mutated replica** (the bug class reintroduced): the test must **fail**. This
  is the proof that the test can catch the defect the finding described.

Decision rule (fixed): **accept** only when `clean_replica = pass` AND
`mutated_replica = fail`. Every other combination is **reject**:

| clean_replica | mutated_replica | verdict | reading |
|---|---|---|---|
| pass | fail | accept | catches the bug, stable on clean code |
| pass | pass | reject | still false-green; the mutant survives |
| fail | fail | reject | test does not hold on clean code |
| fail | pass | reject | inverted and broken |

### Two cost tiers

The gate has two tiers; the host picks based on cost:

- **suite-rerun** (`tier: "suite-rerun"`): rerun the whole suite against the clean
  replica and a mutated replica. Cheap to wire, coarse: a surviving mutant tells
  you *some* test should have failed, not that the strengthened one did.
- **targeted-mutation** (`tier: "targeted-mutation"`): apply a focused mutant to
  the unit under test and run the strengthened test alone. Costlier per run, but it
  attributes the fail to this test and this mutant. Use it when the finding blocks
  a deploy or is cited in a report.

Tooling is the host's, not the skill's: **mutmut** or **cosmic-ray** for Python,
**Stryker** for JavaScript/TypeScript. The skill never invokes them.

### The flaky case

If the strengthened test does not pass in stable isolation on the clean replica
(passes on rerun, fails on rerun, or depends on test order), it is a J6 finding in
its own right: order-dependent or non-deterministic. Do not accept a flaky fix even
if it happens to fail on the mutated replica, because the mutated-replica fail
cannot be attributed to the mutation. Verdict: **reject**, with the J6 reason in
`notes`. Fix the isolation first (Mode C re-run), then re-gate.

### Output contract

The host records the verdict in `schema/fix-validation.json`: the `finding`
reference (code / file / line), the `tier`, the two replica outcomes, the
`verdict`, and optional `mutation` and `notes`. `accept` is gated on
`clean_replica = pass` AND `mutated_replica = fail`; the schema description carries
the same rule so the contract is self-describing. The bidirectional gate is the
SENTINEL / Pizzini contribution credited in `CREDITS.md`.

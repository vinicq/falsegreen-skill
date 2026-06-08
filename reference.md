# Detection Reference

Full case catalog with per-language patterns, framework cues, and look-alike
examples. Use alongside [SKILL.md](SKILL.md).

<!-- This file is populated from paper synthesis. See workflow output. -->

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

### Java
- Imports: `import org.junit.jupiter.api.*` (JUnit 5),
  `import org.junit.*` (JUnit 4), `import org.testng.*`
- Annotations: `@Test`, `@BeforeEach`, `@AfterEach`, `@ExtendWith`,
  `@MockBean`, `@InjectMocks`, `@Mock`
- Mock cues: `Mockito.mock()`, `when(...).thenReturn(...)`, `verify(...)`,
  `@Mock`, `@InjectMocks`
- Assertion style: `assertEquals`, `assertThat`, `assertTrue`,
  `assertThrows` (JUnit 5), `Assertions.*`

### C#
- Namespaces: `using NUnit.Framework`, `using Xunit`, `using Microsoft.VisualStudio.TestTools.UnitTesting`
- Attributes: `[Test]`, `[Fact]`, `[Theory]`, `[TestMethod]`, `[SetUp]`
- Mock cues: `Mock<T>`, `.Setup(...)`, `.Returns(...)`, `.Verify(...)`,
  `Moq.Mock`, `NSubstitute`, `FakeItEasy`
- Assertion style: `Assert.That(...)`, `Assert.Equal(...)`,
  `Assert.AreEqual(...)`, `.Should()` (FluentAssertions)

### PHP
- Uses: `use PHPUnit\Framework\TestCase`
- Methods: `setUp()`, `tearDown()`, `test*` prefixed methods, `@test` docblock
- Mock cues: `$this->createMock(...)`, `$this->getMockBuilder(...)`,
  `expects(...)`, `method(...)`, `willReturn(...)`
- Assertion style: `$this->assertEquals(...)`, `$this->assertSame(...)`,
  `$this->assertInstanceOf(...)`

### Ruby
- Requires: `require 'rspec'`, `require 'minitest/autorun'`
- RSpec: `describe`, `context`, `it`, `expect(...).to`, `subject`, `let`
- Mock cues: `allow(...).to receive(...)`, `expect(...).to receive(...)`,
  `double(...)`, `instance_double(...)`, `stub`
- Minitest: `def test_*`, `assert_equal`, `assert_raises`, `refute_*`

### C++
- Includes: `#include <gtest/gtest.h>`, `#include <catch2/catch_test_macros.hpp>`
- GoogleTest: `TEST(Suite, Name)`, `TEST_F(Fixture, Name)`, `ASSERT_*`, `EXPECT_*`
- Catch2: `TEST_CASE(...)`, `REQUIRE(...)`, `CHECK(...)`, `SECTION(...)`
- Mock cues: `MOCK_METHOD(...)` (gmock), `NiceMock<>`, `StrictMock<>`

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

**Java/Mockito example:**
```java
// BAD
@Mock Calculator calculator;
@Test void testAdd() {
    when(calculator.add(2, 3)).thenReturn(5);
    assertEquals(5, calculator.add(2, 3)); // C10
}

// CLEAN
@Mock Repository repo;
@InjectMocks UserService sut;             // real SUT
@Test void testGetUser() {
    when(repo.findById(1L)).thenReturn(Optional.of(new User(1L, "Alice")));
    User u = sut.getUser(1L);
    assertEquals("Alice", u.getName());
}
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

**Java example:**
```java
// BAD
@Test void testDiscount() {
    double price = 200, rate = 0.15;
    double expected = price - (price * rate);  // re-implements
    assertEquals(expected, sut.applyDiscount(price, rate));
}

// CLEAN
@Test void testDiscount() {
    assertEquals(170.0, sut.applyDiscount(200.0, 0.15)); // 200 - 15% = 170
}
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

**C# example:**
```csharp
// Spec: VAT rate for food is 7%
[Test]
public void TestVat() {
    Assert.AreEqual(107, calculator.AddVat(100, ProductType.Food)); // C18 if spec says 7%
    // oracle: tax regulation document
}
```

---

## Language-specific patterns

Paper evidence backs each entry. Abbreviations in brackets identify the
source paper; see `research/papers/` in the audit repo for full summaries.

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

### Java

- **`@Ignore` (JUnit 4) / `@Disabled` (JUnit 5) with no explanation or expiry
  (J1, MEDIUM):** The annotation silently removes the test from the suite
  indefinitely. Require a `value` string on `@Disabled`; flag bare `@Ignore`.
  Confirmed in large mature projects. [Goes 2024, Pizzini 2024]

- **`@Test(expected = Exception.class)` - over-broad exception catch (J4/C9, HIGH):**
  Catching the base `Exception` class means any exception, including a
  `NullPointerException` from a typo in the test itself, satisfies the
  expectation. Flag only when `Exception.class` (not a specific subtype) is
  used. [Goes 2024, Pizzini 2024]

- **TestNG `@Test(expectedExceptions = Exception.class)` (J4/C9, HIGH):**
  Identical false-green risk to the JUnit 4 pattern above, expressed in
  TestNG syntax. [Goes 2024]

- **`assertThrows(Exception.class, ...)` - JUnit 5 (J4/C9, HIGH):**
  Same over-broad catch in JUnit 5 style. Flag only when `Exception.class`
  itself is passed, not a specific subtype. [Goes 2024]

- **Conditional Test Logic - assert inside `if`/`for`/`while` (J1/C1, HIGH):**
  Any control structure in the test body that guards an assertion. Present
  even in highly-maintained large codebases. JNose rule: flag when an
  assertion lives inside any conditional or loop. [Goes 2024]

- **`assertAll()` called with no lambdas (J1/C2 analog, HIGH):**
  `assertAll()` with an empty varargs list compiles and passes vacuously.
  The grouped assertion block contains nothing to fail. [JUnit 5 behavior]

- **Empty `@Test` method (J1/C2b, HIGH):**
  A `@Test`-annotated method with an empty body or only comments. Compiles
  fine, produces no assertion, always green. [Pizzini 2024, Goes 2024]

- **Re-implementing the formula as the expected value (J2/C12, HIGH):**
  ```java
  double expected = price - (price * rate);
  assertEquals(expected, sut.applyDiscount(price, rate));
  ```
  Both sides use the same arithmetic. Detected by semantic pass only, not
  static scan. [Goes 2024, Pizzini 2024]

---

### C#

- **`async void` test method - NUnit/MSTest (J1/C22 analog, HIGH):**
  When an exception is thrown inside an `async void` test, it is posted to
  the thread-pool `SynchronizationContext` rather than propagated to the test
  runner. The test shows green even if the assertion throws. xUnit disallows
  `async void` by design. Flag `async void` on any `[Test]`/`[TestMethod]`-
  annotated method. [Paul 2024, xNose - arXiv:2405.04063]

- **`Assert.Pass()` - unconditional green (J1/C5 analog, HIGH):**
  Marks the test passed without executing any assertions below it. No Python
  equivalent. [Paul 2024]

- **`Assert.Inconclusive()` - counts as green in most CI pipelines (J1, MEDIUM):**
  Marks the test inconclusive, which many pipelines treat as passing. Neither
  pass nor fail, but the assertions below it do not execute. [Paul 2024]

- **`[Fact(Skip = "...")]` / `[Ignore]` / `[TestMethod][Ignore]` left permanently
  (J1, MEDIUM):** xUnit uses the `Skip =` parameter; NUnit/MSTest use
  `[Ignore]`. Both silently skip forever when no condition is attached. Flag
  when the reason string contains no issue number or expiry date. [Paul 2024]

- **Unknown Test - must recognize all assertion dialects (J1/C2b, HIGH):**
  A test body with none of these assertion patterns is an Unknown Test:
  `Assert.Equal(...)` / `Assert.AreEqual(...)` (MSTest/NUnit),
  `.Should().Be(...)` (FluentAssertions),
  `.ShouldBe(...)` / `.ShouldEqual(...)` (Shouldly).
  Also check `Assert.Throws` / `Assert.ThrowsAsync`. [Paul 2024]

- **`Assert.IsTrue(true)` / `Assert.AreEqual(x, x)` with identical arguments
  (J2/C5-C7, HIGH):** Both are always-true checks. The same-expression check
  requires that both arguments are syntactically identical. [Paul 2024]

- **Empty `[Test]`/`[Fact]`/`[TestMethod]` method (J1/C2b, HIGH):**
  No assertions in the body; method is a no-op that always passes. [Paul 2024]

---

### PHP

- **Unknown Test - no `$this->assert*` call (J1/C2b, HIGH):**
  A `test*`-prefixed method or a method with `@test` docblock that contains
  no `$this->assertEquals`, `$this->assertTrue`, `$this->assertSame`,
  `$this->assertInstanceOf`, or similar. Also check for absence of
  `$this->fail()`, which is the only non-assert way to force a failure.

- **`$this->assertTrue(true)` / `$this->assertFalse(false)` - always-true
  (J2/C5, HIGH):** Both sides are literals; passes by construction regardless
  of production code. [Paul 2024 analog]

- **`$this->assertEquals($x, $x)` - same variable on both sides (J2/C7, HIGH):**
  Always passes. Requires both arguments to be syntactically identical.

- **`$this->expectException(\Exception::class)` - over-broad (J4/C9 analog, HIGH):**
  Catches any `Exception` subclass including errors from typos in the test
  itself. Flag when `\Exception::class` (root class) is passed rather than
  a specific type.

- **`$this->expectException(\Throwable::class)` or `\Error::class` - even broader
  (J4/C9 analog, HIGH):** `Throwable` in PHP 7+ covers both `Exception` and
  `Error` hierarchies. A fatal `TypeError` from a wrong type hint satisfies
  this expectation. Flag as HIGH when `Throwable` or `Error` (not a specific
  subclass) is the argument.

- **`@dataProvider` returning an empty dataset (J1/C1 analog, MEDIUM):**
  A `@dataProvider` annotation pointing to a method that returns an empty
  array causes the test to be skipped with no assertion. No iteration runs.

- **`$this->markTestSkipped(...)` or `$this->markTestIncomplete(...)` without
  a condition guard (J1/C4 analog, MEDIUM):** Unconditionally marks the test
  as skipped/incomplete on every run; the test body never executes.

---

### Ruby

- **Fire and Forget - async with no wait (J1/C22 analog, HIGH):**
  A test that starts a background job, thread, or EventMachine operation
  without waiting for completion before the assertion. The test returns before
  the async work settles. High prevalence in multi-language study. [Lucas 2024]

- **`it { }` with empty block - RSpec pending (J1/C2b, MEDIUM):**
  RSpec pending examples are silently green or pending depending on
  configuration. No assertion executes. [Lucas 2024]

- **`expect { }.not_to raise_error` without a positive result assertion
  (J4/C9 analog, MEDIUM):** Checks only exception absence, not correctness of
  the return value. The block could return any value and the test passes.
  This is NOT automatically C10 or J4 - classify intent first (Step 3). Only
  flag when the block wraps the SUT and absence-of-exception is not itself the
  specified contract. Pair with a positive assertion on the result. [Lucas 2024]

- **`stub_chain` through the SUT itself (J3/C10, HIGH):**
  `allow(sut).to receive_message_chain(:method_a, :method_b)` stubs a call
  chain on the system under test rather than a dependency. The test verifies
  the stub fires, not production behavior. [Lucas 2024]

- **Self-Test - `expect(mock).to receive(:method)` then calls `mock.method()`
  directly (J3/C13, HIGH):** Sets an expectation on a mock, then calls the
  method on the mock rather than passing the mock to the SUT. Asserts only
  that the stub fires, not that real code calls it. [Lucas 2024]

- **Echo pattern - stub return value asserted directly (J2/J3/C11, HIGH):**
  `allow(...).to receive(:method).and_return(value)` followed by
  `expect(result).to eq(value)` where the asserted value is the same value
  injected into the stub. No production logic transforms it. [Lucas 2024]

- **Minitest `test_*` method with no `assert_*` or `refute_*` (J1/C2b, HIGH):**
  Method is collected by the runner but has no check.

- **`assert_raises` catching `StandardError` or `Exception` - Minitest
  (J4/C9 analog, HIGH):** Over-broad exception capture; any runtime error
  satisfies the assertion.

---

### C++

- **`TEST`/`TEST_F` with no `ASSERT_*` or `EXPECT_*` in the body
  (J1/C2, HIGH):** The test compiles and runs but emits no assertion; always
  green. Detection: parse the block for any call matching `ASSERT_[A-Z]+` or
  `EXPECT_[A-Z]+`; flag if none found.
  **Delegate-pattern exemption:** if `ASSERT_*`/`EXPECT_*` appears inside a
  helper function called by the test (not in the test body itself), do NOT
  flag Unknown Test. The assertion executes when the helper is called. Check
  the call chain before reporting J1/C2. [Lopes 2023]

- **`ASSERT_NO_THROW(expr)` without inspecting the return value
  (J4/C9 analog, MEDIUM):** Verifies only that no exception was thrown; does
  not check correctness of the result. A function returning the wrong value
  still passes. Pair with `EXPECT_EQ`/`EXPECT_THAT` on the result. [Lopes 2023]

- **`ASSERT_NO_THROW` wrapping multiple non-trivial calls (C19 analog, LOW):**
  An earlier call may throw, shielding the target call from executing. Flag
  LOW only when more than one non-trivial call appears inside the macro.
  [Lopes 2023, arXiv:2405.04063 analog]

- **`TEST_CASE` with no `REQUIRE`/`CHECK` - Catch2 (J1/C2, HIGH):**
  The Catch2 equivalent of the GoogleTest unknown-test pattern. A `TEST_CASE`
  block with no `REQUIRE`, `CHECK`, `REQUIRE_THROWS`, or `CHECK_THROWS`
  macros is always green.

- **`DISABLED_` prefix or `GTEST_SKIP()` - GoogleTest (J1, MEDIUM):**
  `TEST(Suite, DISABLED_Name)` is silently excluded from the default run.
  `GTEST_SKIP()` at the top skips with no failure. Neither signals intent or
  expiry. Note: an empty body inside a `DISABLED_`-prefixed test is a true
  negative, not an Unknown Test - the test is explicitly excluded. [Lopes 2023]

- **`ASSERT_TRUE(ptr != nullptr)` only - no further content check
  (J4/C6 analog, LOW):** Confirms non-null but does not verify the pointed-to
  value. Passes for any non-null pointer regardless of content.

- **`EXPECT_CALL(mock, Method()).Times(0)` as the sole assertion (J4, LOW):**
  Verifies a method is never called but does not verify what the SUT produced.
  Pair with a positive result check.

---

## The oracle hierarchy

The expected value must come from a source independent of the code:

1. **Explicit spec or requirement** (spec document, ticket, RFC)
2. **Documented contract** (docstring, type annotations, API docs)
3. **Independent human judgment** (the tester's own derivation)
4. **The current code** (lowest priority - this is where bugs hide)

Promoting the current code to the top of this hierarchy is how a bug gets
frozen as "correct". The semantic pass enforces this hierarchy.

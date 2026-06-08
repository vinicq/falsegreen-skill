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

### Case 10 — Mocks the unit under test (J3, HIGH)

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
    assert result == 5          # C10 — asserting the mock's value

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
    expect(add(2, 3)).toBe(5);  // C10 — testing the mock
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

### Case 11 — Asserts the value fed to the mock (J2/J3, HIGH)

The test stubs a dependency to return a specific value, then asserts the
test result equals that same value. The result passes through no production
logic: it is an echo.

**Pattern:** `stub.return_value = X; assert sut.method() == X`

**Python example:**
```python
# BAD: stubs price, asserts price
def test_price(mock_product):
    mock_product.price = 100
    assert get_price(mock_product) == 100  # C11 — just echoes the stub

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

### Case 12 — Re-implements the production formula (J2, HIGH)

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

### Case 15 — Passes only if another test ran first (J6, HIGH)

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
    assert cache['key'] == 'value'  # C15 — depends on test_populate
```

**TypeScript/Jest example:**
```typescript
const state: string[] = [];

test('push item', () => {
    state.push('a');
    expect(state).toHaveLength(1);
});

test('has item', () => {
    expect(state[0]).toBe('a');  // C15 — only passes after the previous test
});
```

---

### Case 18 — Expected value contradicts what the code should do (J2, HIGH)

The test asserts an expected value that contradicts the specification,
documented contract, or domain rule. The test passes — but only because
it has frozen a bug as the correct behavior.

**Requires an independent oracle.** Do not report without citing one.

**Python example:**
```python
# Spec says: apply_discount(200, 0.15) must return 170
# Bug: the function subtracts the wrong amount
def test_apply_discount():
    assert apply_discount(200, 0.15) == 200  # C18 — asserts no discount was applied
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

*This section is populated from paper synthesis. See workflow output.*
*Placeholder — will be completed after paper analysis.*

### TypeScript / JavaScript specific patterns
- `async/await` tests that never await the SUT (The Liar — maps to C22)
- `Promise` tests that do not `return` or `await` the assertion chain (Jest)
- `done` callback tests that call `done` before the assertion fires
- Empty `it()` blocks (Jest/Vitest do not warn by default)
- `expect.assertions(0)` that passes vacuously

### Java specific patterns
- JUnit 4 `expected = Exception.class` that catches too broad an exception
- TestNG `@Test(expectedExceptions = Exception.class)` — same issue
- Empty `@Test` methods (compile fine, produce no assertion)
- `@Ignore`/`@Disabled` with no expiry

### C# specific patterns
- `[Ignore]` / `[Skip]` with no condition
- `Assert.Pass()` / `Assert.Inconclusive()` patterns
- Empty `[Test]` methods
- `Task`-returning test methods not awaited by the runner (xUnit requires
  `async Task`, not `async void`)

### PHP specific patterns
- `$this->assertTrue(true)` (always true)
- Methods without any `$this->assert*` call
- `@test` docblock on a method that is never called

### Ruby specific patterns
- `expect { }.not_to raise_error` without verifying the result
- `it { }` with empty block (pending in RSpec, silently green)
- `stub_chain` that chains through the SUT

### C++ specific patterns
- `TEST` with no `ASSERT_*` or `EXPECT_*` calls (GoogleTest)
- `ASSERT_NO_THROW` without inspecting the result
- `TEST_CASE` with no `REQUIRE` or `CHECK` (Catch2)

---

## The oracle hierarchy

The expected value must come from a source independent of the code:

1. **Explicit spec or requirement** (spec document, ticket, RFC)
2. **Documented contract** (docstring, type annotations, API docs)
3. **Independent human judgment** (the tester's own derivation)
4. **The current code** (lowest priority — this is where bugs hide)

Promoting the current code to the top of this hierarchy is how a bug gets
frozen as "correct". The semantic pass enforces this hierarchy.

/**
 * Weak assertion patterns — TypeScript (Vitest / Jest).
 * Case: J4 — the test runs an assertion but it checks too little
 * or the wrong thing to catch real regressions.
 *
 * Patterns covered:
 *   - toHaveBeenCalled() without argument verification
 *   - resolves.toBeDefined() as an async return contract
 *   - Array.every() aggregation hiding which input failed
 *   - Unasserted happy-path call (C2b / J4)
 *   - Internal-field access via underscore convention (J5)
 *
 * Evidence: react-hook-form (controller.test.tsx, useController.test.tsx),
 *           colinhacks/zod (string.test.ts, primitive.test.ts),
 *           mobxjs/mobx (observables.js).
 */

import { describe, it, expect, vi } from 'vitest';
import { emailSchema, userSchema, processForm } from './forms';

// ─── J4: toHaveBeenCalled() without argument check ───────────────────────────
//
// BAD: the spy confirms the callback was invoked, but does not verify that it
// received the correct arguments. The test passes even if the component calls
// onChange with a wrong value or wrong type.
//
// Evidence: react-hook-form controller.test.tsx — both onChange and onBlur
// handlers are verified with toHaveBeenCalled() only (no .toHaveBeenCalledWith).

describe('form onChange handler (J4 - called without arg check)', () => {
  it('BAD: confirms the call happened, not what was passed', async () => {
    const onChange = vi.fn();
    await userEvent.type(screen.getByRole('textbox'), 'Alice');

    // J4 — passes even if onChange is called with undefined, '', or wrong shape
    expect(onChange).toHaveBeenCalled();
  });

  // CLEAN: verify the specific value the handler received.
  it('CLEAN: check the argument, not just the call count', async () => {
    const onChange = vi.fn();
    await userEvent.type(screen.getByRole('textbox'), 'Alice');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: { value: 'Alice' } })
    );
  });
});


// ─── J4: resolves.toBeDefined() as async return contract ─────────────────────
//
// BAD: resolves.toBeDefined() passes for any resolved value except undefined.
// It accepts null, 0, false, '', an empty object, or an error payload.
// It does not verify the shape or meaning of the returned value.
//
// Evidence: react-hook-form useController.test.tsx — used to check that
// field.onChange returns a "promise-like value", but accepts any resolution.

describe('field.onChange return value (J4 - weak async contract)', () => {
  it('BAD: resolves.toBeDefined() accepts any non-undefined resolution', async () => {
    const { result } = renderHook(() => useController({ name: 'email' }));
    const onChangeResult = result.current.field.onChange('test@example.com');

    // J4 — passes for null, '', {}, false — anything except undefined
    await expect(onChangeResult).resolves.toBeDefined();
  });

  // CLEAN: resolve and check the actual shape of the return value.
  it('CLEAN: assert the resolved structure, not just existence', async () => {
    const { result } = renderHook(() => useController({ name: 'email' }));
    const resolved = await result.current.field.onChange('test@example.com');

    // depends on the contract — adjust to what onChange is supposed to return
    expect(resolved).toEqual(expect.objectContaining({ success: true }));
  });

  // CLEAN alternative: if the contract is "returns void/undefined on success",
  // assert that explicitly rather than asserting "not undefined".
  it('CLEAN: if void return is the contract, assert toBeUndefined', async () => {
    const { result } = renderHook(() => useController({ name: 'email' }));
    await expect(result.current.field.onChange('test@example.com')).resolves.toBeUndefined();
  });
});


// ─── J4: Array.every() aggregation hiding which input failed ─────────────────
//
// BAD: the test runs N inputs through the schema and aggregates the results into
// a single boolean. When the assertion fails you learn "false !== true" but not
// which email caused the failure. Also, the test has only one assertion that
// covers N cases — no per-input diagnostics.
//
// Evidence: colinhacks/zod string.test.ts — valid email, E.164, cuid2 sets
// all use this pattern.

const validEmails = [
  'user@example.com',
  'user+tag@sub.example.org',
  'firstname.lastname@example.co.uk',
];

const invalidEmails = [
  'not-an-email',
  '@no-local-part.com',
  'missing@tld',
];

describe('emailSchema validation (J4 - every() aggregation)', () => {
  it('BAD: single boolean hides which email failed', () => {
    // J4 — failure message: "expected false to be true" with no other context
    expect(
      validEmails.every((email) => emailSchema.safeParse(email).success)
    ).toBe(true);
  });

  // CLEAN: one assertion per input so failures are self-describing.
  it('CLEAN: assert each email individually', () => {
    for (const email of validEmails) {
      expect(emailSchema.safeParse(email).success, `should accept: ${email}`).toBe(true);
    }
  });

  // CLEAN alternative: use test.each for structured per-input test names.
  it.each(validEmails)('accepts valid email: %s', (email) => {
    expect(emailSchema.safeParse(email).success).toBe(true);
  });

  it.each(invalidEmails)('rejects invalid email: %s', (email) => {
    expect(emailSchema.safeParse(email).success).toBe(false);
  });
});


// ─── J4 / C2b: unasserted happy-path call ────────────────────────────────────
//
// BAD: the test calls the SUT on a valid input and discards the return value.
// It only verifies that the function did not throw. The return value — the
// parse result that the caller would actually use — is never checked.
//
// Evidence: colinhacks/zod primitive.test.ts — systematic across all 8
// primitive types in v4. Only error-path calls use toThrow(); success paths
// call .parse() and drop the result.

describe('string schema (J4 / C2b - unasserted success path)', () => {
  it('BAD: parse result discarded, only error path is asserted', () => {
    // J4 / C2b — return value of .parse('hello') is dropped
    userSchema.string().parse('hello');
    expect(() => userSchema.string().parse(42)).toThrow();
  });

  // CLEAN: assert the actual parsed value on the success path too.
  it('CLEAN: both paths asserted', () => {
    expect(userSchema.string().parse('hello')).toBe('hello');
    expect(() => userSchema.string().parse(42)).toThrow();
  });
});


// ─── J5: internal field access via underscore convention ─────────────────────
//
// BAD: underscore-prefixed fields (_fields, value_, _state) signal implementation
// internals. A test that reads or writes them becomes coupled to the library's
// private implementation. Any refactoring that renames or restructures internals
// breaks the test — even if the public API is preserved.
//
// Evidence:
//   react-hook-form controller.test.tsx line ~531: control._fields
//   mobxjs/mobx observables.js line ~258: computedValue.value_

describe('form internals access (J5 - underscore fields)', () => {
  it('BAD: reads control._fields (private internal)', () => {
    const { control } = useForm();
    // J5 — _fields is an internal field, not part of the public API
    const fieldsRef = (control as any)._fields;
    expect(fieldsRef?.email?.required).toBeFalsy();
  });

  // CLEAN: use the public API to observe validation behavior.
  it('CLEAN: trigger validation and observe public result', async () => {
    const { register, trigger, formState } = useForm({ defaultValues: { email: '' } });
    register('email', { required: 'required' });

    await trigger('email');
    // formState.errors is the public contract; _fields is the internals
    expect(formState.errors.email).toBeDefined();
  });
});

describe('MobX computed value internals (J5 - value_ field)', () => {
  it('BAD: reads computedValue.value_ (MobX internal field)', () => {
    const price = observable.box(10);
    const doubled = computed(() => price.get() * 2);

    // J5 — value_ is a private field of ComputedValue, not stable API
    expect((doubled as any).value_).toBe(20);
  });

  // CLEAN: use .get() — the documented public accessor.
  it('CLEAN: use .get() to read the computed value', () => {
    const price = observable.box(10);
    const doubled = computed(() => price.get() * 2);

    expect(doubled.get()).toBe(20);
  });
});


// ─── Placeholder stubs (not imported — inline for IDE clarity) ───────────────

declare const screen: any;
declare const userEvent: any;
declare function renderHook(fn: () => any): { result: any };
declare function useController(opts: any): any;
declare function useForm(opts?: any): any;
declare const observable: any;
declare function computed(fn: () => any): any;

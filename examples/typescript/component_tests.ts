/**
 * Component test false-positive patterns — TypeScript
 *
 * Covers frontend testing with React Testing Library, Vue Test Utils, and
 * Angular TestBed. The J1-J6 framework applies identically to component tests
 * and backend tests. The patterns have different surface shapes but the same
 * structural failures: assertions that cannot fail.
 *
 * Each example is annotated with the case code, judgment, and confidence.
 */

// ============================================================================
// REACT (React Testing Library + Vitest / Jest)
// ============================================================================

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── J4: truthiness-only assertion on rendered output ─────────────────────────
// CASE 6 (J4) - HIGH
// screen.getByTestId always returns an element or throws. The toBeTruthy()
// check adds nothing — it passes for any non-null DOM node, including one
// that renders with empty or wrong content.

describe('UserCard', () => {
  it('renders the user name', () => {
    render(<UserCard name="Alice" role="admin" />);
    expect(screen.getByTestId('user-name')).toBeTruthy(); // J4: no content check
  });
});

// ── J3: mocking the component under test ──────────────────────────────────────
// CASE 10 (J3) - HIGH
// The component under test (PaymentForm) is replaced by a spy. Asserting that
// the spy was called tests Vue/React's rendering plumbing, not the component's
// behavior. Any render of CheckoutPage — even one that passes the wrong props —
// satisfies this assertion.

import * as PaymentFormModule from '../components/PaymentForm';

describe('CheckoutPage', () => {
  it('shows the payment form', () => {
    vi.spyOn(PaymentFormModule, 'PaymentForm').mockReturnValue(null);
    render(<CheckoutPage />);
    expect(PaymentFormModule.PaymentForm).toHaveBeenCalled(); // J3: mock-the-SUT
  });
});

// ── J2: echo mock — expected value round-tripped from mock setup ──────────────
// CASE 11 (J2) - HIGH
// The oracle for the assertion is the same object used to configure the mock.
// Any value the mock returns satisfies the assertion, including a raw decimal
// that the component should have formatted as currency.

describe('ProductCard', () => {
  it('shows the formatted price', async () => {
    const product = { id: 1, name: 'Widget', price: 29.99 };
    vi.mocked(api.getProduct).mockResolvedValue(product);

    render(<ProductCard productId={1} />);
    await screen.findByTestId('price');

    // J2: product.price is the mock's return value — not an independent oracle.
    // Passes even if the component renders "29.99" instead of "$29.99".
    expect(screen.getByTestId('price').textContent).toContain(`${product.price}`);
  });
});

// ── C13: mock assertion without parentheses ───────────────────────────────────
// CASE 13 (J1) - HIGH
// expect(fn.toHaveBeenCalledWith) is a property access, not a call.
// The property exists on every vi.fn(), so this assertion is always truthy
// regardless of whether the callback was invoked.

describe('LoginForm', () => {
  it('calls onLogin with credentials', async () => {
    const onLogin = vi.fn();
    render(<LoginForm onLogin={onLogin} />);
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(onLogin.toHaveBeenCalledWith); // C13: missing () — always passes
  });
});

// ── C2b: event fired but side effect never asserted ───────────────────────────
// CASE 2b (J1) - HIGH
// userEvent.click fires the remove action, but the test then asserts that
// the button is still in the document — not that the item was removed.
// The test passes whether or not the component updates correctly.

describe('CartItem', () => {
  it('removes item when remove button clicked', async () => {
    const onRemove = vi.fn();
    render(<CartItem name="Widget" qty={2} onRemove={onRemove} />);
    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    // C2b: asserts the button exists after click, not that onRemove was called
    // or that the item was removed from the cart.
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });
});

// ── J5: coupling to internal React state (Enzyme) ────────────────────────────
// CASE J5 - HIGH
// wrapper.state() reads internal React class component state directly.
// Breaks on any refactor that replaces useState/this.state with a ref,
// a context, or a CSS-only toggle — even if the visible behavior is identical.

import { shallow } from 'enzyme';

describe('DropdownMenu', () => {
  it('opens when trigger is clicked', () => {
    const wrapper = shallow(<DropdownMenu items={['Home', 'About', 'Contact']} />);
    wrapper.find('[data-testid="trigger"]').simulate('click');
    expect(wrapper.state('open')).toBe(true); // J5: asserts internal state
  });
});

// ── C9: overly broad exception assertion in async action ─────────────────────
// CASE 9 (J4) - LOW
// /error/i matches any text containing "error", including generic React
// error boundaries, console output leaking into the DOM, or a field label
// that reads "Error reporting enabled". The specific error message is not
// checked, so a different failure mode satisfies the assertion.

describe('FileUpload', () => {
  it('shows an error message when upload fails', async () => {
    vi.mocked(api.upload).mockRejectedValue(new Error('Network timeout'));
    render(<FileUpload />);
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText(/choose file/i), file);
    await waitFor(() => {
      // C9/J4: matches any element containing "error", not "Network timeout"
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// VUE (Vue Test Utils + Vitest)
// ============================================================================

import { mount, shallowMount } from '@vue/test-utils';

// ── J4: wrapper.exists() is always true for a mounted component ───────────────
// CASE 6 (J4) - HIGH
// mount() throws if the component cannot be created at all. If mount()
// succeeds, wrapper.exists() is always true. The assertion adds no value.

describe('BaseButton', () => {
  it('renders', () => {
    const wrapper = mount(BaseButton, { props: { label: 'Submit' } });
    expect(wrapper.exists()).toBe(true); // J4: always true after a successful mount
  });
});

// ── J3: shallowMount stub asserted instead of component behavior ──────────────
// CASE 10 (J3) - HIGH
// shallowMount replaces child components with stubs. Asserting the stub count
// verifies that Vue's stub mechanism works, not that OrderSummary renders
// the correct number of items or passes the right props to LineItem.

describe('OrderSummary', () => {
  it('renders a row for each order item', () => {
    const wrapper = shallowMount(OrderSummary, {
      props: { items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] },
    });
    // J3: asserting the stub count — LineItem is not rendered at all
    expect(wrapper.findAllComponents({ name: 'LineItemStub' })).toHaveLength(2);
  });
});

// ── J2: emitted event payload is the same object passed as a prop ─────────────
// CASE 11 (J2) - HIGH
// The test passes selectedItem as a prop and then asserts the emitted event
// carries that same reference. Any component that emits its input verbatim
// satisfies this — including one that ignores the item's fields entirely.

describe('SelectableList', () => {
  it('emits the selected item on click', async () => {
    const selectedItem = { id: 42, label: 'Option A' };
    const wrapper = mount(SelectableList, {
      props: { items: [selectedItem] },
    });
    await wrapper.find('[data-testid="item-42"]').trigger('click');
    // J2: oracle is the same object provided in props, not an independent value
    expect(wrapper.emitted('select')?.[0]).toEqual([selectedItem]);
  });
});

// ============================================================================
// ANGULAR (TestBed)
// ============================================================================

import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

// ── J4: nativeElement truthy check without content validation ─────────────────
// CASE 6 (J4) - HIGH
// If the component mounts at all, nativeElement is always a DOM node —
// truthy by definition. The assertion passes even if the message is empty.

describe('AlertComponent', () => {
  let fixture: ComponentFixture<AlertComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AlertComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(AlertComponent);
  });

  it('displays the alert message', () => {
    fixture.componentInstance.message = 'Disk space low';
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.css('.alert'));
    expect(el.nativeElement).toBeTruthy(); // J4: DOM node present, message not checked
  });
});

// ── J5: direct access to component property instead of rendered output ────────
// CASE J5 - HIGH
// The test reads fixture.componentInstance.isOpen — a private implementation
// detail — instead of checking what the user sees. Breaks if the open state
// is moved to a service, a signal, or a directive without changing behavior.

describe('AccordionComponent', () => {
  it('sets isOpen to true when header is clicked', () => {
    const fixture = TestBed.createComponent(AccordionComponent);
    fixture.detectChanges();
    const header = fixture.debugElement.query(By.css('.accordion-header'));
    header.triggerEventHandler('click', null);
    fixture.detectChanges();
    // J5: reads internal component state directly
    expect(fixture.componentInstance.isOpen).toBe(true);
  });
});

// ── C2b: HTTP request made but response not asserted ─────────────────────────
// CASE 2b (J1) - HIGH
// The component method is called, triggering an HTTP request via the mock.
// The test only checks that the service method was called — not that the
// component updated its view with the response data.

import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

describe('UserListComponent', () => {
  it('loads users on init', () => {
    const fixture = TestBed.createComponent(UserListComponent);
    const userService = TestBed.inject(UserService);
    vi.spyOn(userService, 'getUsers').mockReturnValue(of([{ id: 1, name: 'Alice' }]));

    fixture.detectChanges(); // triggers ngOnInit

    // C2b: verifies the service was called, not that the template rendered the user
    expect(userService.getUsers).toHaveBeenCalled();
  });
});

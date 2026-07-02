/**
 * Cypress query chains - RiskGroup: effectiveness.
 * Codes: JS24
 *
 * A Cypress query (cy.get / cy.find / cy.contains) returns a chainable subject.
 * Cypress retries the query and fails the test if the selector never resolves,
 * so this is NOT "green while the element is missing". The smell is narrower:
 * without a terminating .should / .and, or an expect() inside a .then, nothing
 * beyond the element's implicit existence is checked. The element was found and
 * its state, text, or value - the thing the test meant to verify - was never
 * asserted. This lives in a .cy.ts file so the scanner reads it as a Cypress
 * spec. It is a scan target, not a runnable suite.
 */

// --- JS24: query used as a statement, no terminating assertion --------------

// BAD: the button is found (Cypress would fail if it were absent) but nothing
// about its state - enabled, text, visibility - is ever asserted.
it('JS24 - loose cy.get', () => {
  cy.get('.submit-btn'); // JS24 - no .should/.and, only implicit existence
});

// BAD: chained navigation that still ends without an assertion.
it('JS24 - find then drop', () => {
  cy.get('form').find('input[name="email"]'); // JS24 - query result discarded
});

// BAD: the text is located, but the surrounding state (is the banner visible,
// is the user actually logged in) is never asserted.
it('JS24 - contains no check', () => {
  cy.contains('Welcome back'); // JS24 - located, but state never asserted
});

// BAD: .then opens a callback but never calls expect inside it.
it('JS24 - then without expect', () => {
  cy.get('.count').then(($el) => {
    $el.text(); // JS24 - reads the value, never asserts it
  });
});

// --- CLEAN look-alikes: the chain terminates in a real assertion ------------

// CLEAN: .should is the oracle.
it('JS24 clean - should visible', () => {
  cy.get('.submit-btn').should('be.visible');
});

// CLEAN: .and adds a second real check.
it('JS24 clean - text content', () => {
  cy.contains('Welcome back').should('exist').and('be.visible');
});

// CLEAN: expect inside .then, against a spec value not the element's own echo.
it('JS24 clean - expect in then', () => {
  cy.get('.count').then(($el) => {
    expect($el.text().trim()).to.equal('3'); // oracle: the cart has 3 items
  });
});

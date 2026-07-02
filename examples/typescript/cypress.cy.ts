/**
 * Cypress query chains - RiskGroup: effectiveness.
 * Codes: JS24
 *
 * A Cypress query (cy.get / cy.find / cy.contains) returns a chainable subject.
 * Without a terminating .should / .and, or an expect() inside a .then, the
 * subject is never asserted: the command queue runs, the test reports green, and
 * a broken selector or missing element goes unnoticed. This lives in a .cy.ts
 * file so the scanner reads it as a Cypress spec. It is a scan target, not a
 * runnable suite; get/find/contains resolve at runtime against the DOM.
 */

// --- JS24: query used as a statement, no terminating assertion --------------

// BAD: the element is fetched and then nothing is checked about it.
it('JS24 - loose cy.get', () => {
  cy.get('.submit-btn'); // JS24 - no .should/.and, subject never asserted
});

// BAD: chained navigation that still ends without an assertion.
it('JS24 - find then drop', () => {
  cy.get('form').find('input[name="email"]'); // JS24 - query result discarded
});

// BAD: contains locates text but asserts nothing about state.
it('JS24 - contains no check', () => {
  cy.contains('Welcome back'); // JS24 - presence not asserted, only queried
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

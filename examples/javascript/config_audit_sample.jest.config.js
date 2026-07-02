/**
 * Project layer - config-audit (Jest / Vitest). RiskGroup: effectiveness.
 * Codes: PL7, PL8, PL10
 *
 * These are not a smell inside any one test. The whole suite goes green by
 * configuration, not by a real check, so the run can pass while protecting
 * nothing. The static scanners surface them only in `--config-audit` mode
 * (reading the resolved jest/vitest run config), never in the per-file scan.
 * Shown here so the skill catalog carries a worked example of each, matching
 * `reference.md` (Project layer) and `schema/code-catalog.json`.
 *
 * This file is a scan target, not a config anyone should ship. The BAD export is
 * the one the scanner flags; the CLEAN version below is the fix.
 */

// BAD: every project-layer smell at once.
module.exports = {
  // PL10: an empty or fully-filtered run reports green instead of failing.
  passWithNoTests: true,

  // PL8: the run stops at the first failure, so the reported pass count is
  // incomplete - a "green" run may have skipped most of the suite.
  bail: 1,

  // PL7: there is no coverageThreshold at all, so coverage can fall to zero and
  // the suite still passes. Nothing here forces a coverage floor.
};

// CLEAN: the fixes for PL7/PL8/PL10.
//
//   module.exports = {
//     // PL7 fixed: coverage cannot silently fall to zero.
//     coverageThreshold: { global: { lines: 80, branches: 70, functions: 80 } },
//     // PL8 fixed: no `bail`, so the whole suite runs and the count is honest.
//     // PL10 fixed: no `passWithNoTests`, so a no-test run fails instead of
//     // reporting green.
//   };
//
// Vitest equivalent: set `test.coverage.thresholds` (PL7), drop `bail` (PL8),
// and drop `passWithNoTests` (PL10).

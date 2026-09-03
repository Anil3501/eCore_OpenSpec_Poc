import { test, expect } from '../src/fixtures/test.ts';

/**
 * Seed spec for the Playwright Test Generator.
 *
 * It uses the shared framework fixtures so that generated code inherits the
 * framework's page objects, environment loader and test data service instead of
 * re-creating browser plumbing.
 *
 * It deliberately asserts no business behaviour: business scenarios live in
 * approved feature files under features/approved/ and are never duplicated here.
 */
test.describe('Test group', () => {
  test('seed', async ({ environment }) => {
    expect(environment.testEnvironment).toBeTruthy();
    // generate code here.
    // Generated exploration code stays in this file. Promote nothing from here
    // into a business test - approved feature files are the only scenario source.
  });
});

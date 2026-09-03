import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test } from '../src/fixtures/test.ts';
import { BUSINESS_ENTITY_SIGN_IN, ORGANIZATION_SIGN_IN } from '../src/pages/ecore-login.page.ts';

/**
 * Step definitions for features/approved/account-access/organization-sign-in.feature.
 *
 * Orchestration only. Every locator lives in the page objects and every
 * decision about which details to use lives in the organization-login service,
 * so nothing here knows what the page looks like or what the credentials are.
 */
const { Given, When, Then } = createBdd(test);

Given('the eCore Command Center login page is open', async ({ loginPage }) => {
  await loginPage.open();
});

Given('I have chosen to sign in on behalf of my organization', async ({ loginPage }) => {
  await loginPage.chooseOrganizationSignIn();
});

When('I look at the page before entering any details', async () => {
  // The Background has opened the page and nothing has been entered. This step
  // exists to make the ordering that AC-ETA-351-001 asserts explicit in the
  // scenario: the choice must be available *before* any detail is supplied.
});

When('I examine the sign-in kinds the page offers', async () => {
  // The kinds are read in the Then step, which keeps the assertion and the
  // value it asserts on in one place.
});

When('I choose to sign in on behalf of my organization', async ({ loginPage }) => {
  await loginPage.chooseOrganizationSignIn();
});

When('I type the secret that proves who I am', async ({ loginPage, organizationLogin }) => {
  await loginPage.typeSecret(organizationLogin.secretForConcealmentCheck());
});

When('I sign in with correct organization details', async ({ loginPage, organizationLogin }) => {
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
});

When('I sign in with organization details that are wrong', async ({ loginPage, organizationLogin }) => {
  await loginPage.enterOrganizationDetails(organizationLogin.wrongDetails());
  await loginPage.submit();
});

When('I sign in leaving required organization details out', async ({ loginPage, organizationLogin }) => {
  await loginPage.enterOrganizationDetails(organizationLogin.incompleteDetails());
  await loginPage.submit();
});

When('I remember how the application responded', async ({ loginPage, signInResponseMemory }) => {
  signInResponseMemory.remembered = await loginPage.captureFailureSignal();
});

When(
  'I return to the login page and choose to sign in on behalf of my organization',
  async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.chooseOrganizationSignIn();
  },
);

Then('the page offers a way to declare which kind of sign-in I am using', async ({ loginPage }) => {
  await loginPage.expectSignInKindChoiceOffered();
});

Then('organization sign-in and Business Entity Login are both offered', async ({ loginPage }) => {
  const offered = await loginPage.signInKindsOffered();
  expect(offered).toContain(ORGANIZATION_SIGN_IN);
  expect(offered).toContain(BUSINESS_ENTITY_SIGN_IN);
});

Then('I can tell the two kinds apart', async ({ loginPage }) => {
  await loginPage.expectSignInKindsDistinguishable();
});

Then('the page asks me for the details that belong to organization sign-in', async ({ loginPage }) => {
  await loginPage.expectOrganizationDetailsRequested();
});

Then('the page does not present every possible field at once', async ({ loginPage }) => {
  await loginPage.expectDetailsOfTheOtherKindNotPresented();
});

Then('the secret is not readable on screen', async ({ loginPage }) => {
  await loginPage.expectSecretNotReadable();
});

Then('I arrive at the eCore Command Center Home page', async ({ homePage }) => {
  await homePage.expectArrived();
});

Then('I am not admitted to the application', async ({ loginPage }) => {
  await loginPage.expectStillOnLoginPage();
});

Then('I am told that the sign-in attempt failed', async ({ loginPage }) => {
  await loginPage.expectSignInFailureReported();
});

Then('the response differs from the one I remembered', async ({ loginPage, signInResponseMemory }) => {
  const remembered = signInResponseMemory.remembered;
  expect(
    remembered,
    'No earlier response was remembered. The scenario must capture the first response before comparing.',
  ).toBeDefined();

  const current = await loginPage.captureFailureSignal();

  // Compared on the channel the application used, not on message wording:
  // ETA-351 puts exact wording out of scope, so asserting on text would invent
  // a requirement. See AMB-ETA-351-003.
  expect(current.channel).not.toBe(remembered?.channel);
});

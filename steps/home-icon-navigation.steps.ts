import { createBdd } from 'playwright-bdd';
import { test } from '../src/fixtures/test.ts';
import type { EcoreNewTransactionPage } from '../src/pages/ecore-new-transaction.page.ts';
import type { EcoreWorkspacePage } from '../src/pages/ecore-workspace.page.ts';
import type { EcorePreferencesPage } from '../src/pages/ecore-preferences.page.ts';

/**
 * Step definitions for features/approved/home-navigation/home-icon-navigation.feature.
 *
 * Orchestration only. Every locator lives in a page object.
 *
 * Two decisions here are load-bearing and should survive any tidying.
 *
 * First, activating a dashboard icon and activating a header link are separate
 * step definitions rather than one step with the entry point as a parameter.
 * The two are genuinely different elements that happen to share a name, and
 * folding them together would turn TS-ETA-411-003 and TS-ETA-411-008 into one
 * test reporting coverage for two acceptance criteria. See RISK-TP-ETA-411-003.
 *
 * Second, the destination alternatives are written out literally rather than as
 * a catch-all capture. `I arrive at the eCore Command Center Home page` is an
 * existing step owned by organization-sign-in.steps.ts, and a loose pattern
 * here would match it too and make the binding ambiguous.
 */
const { Given, When, Then } = createBdd(test);

type DestinationPages = {
  newTransactionPage: EcoreNewTransactionPage;
  workspacePage: EcoreWorkspacePage;
  preferencesPage: EcorePreferencesPage;
};

async function expectArrivedAt(pages: DestinationPages, destination: string): Promise<void> {
  switch (destination) {
    case 'New Transaction':
      return pages.newTransactionPage.expectArrived();
    case 'Workspace':
      return pages.workspacePage.expectArrived();
    case 'Preferences':
      return pages.preferencesPage.expectArrived();
    default:
      throw new Error(
        `No approved destination page for "${destination}". ETA-411 approved exactly three: New Transaction, Workspace and Preferences.`,
      );
  }
}

Given(
  'I am signed in as an organization user on the eCore Command Center Home page',
  async ({ loginPage, organizationLogin, homePage }) => {
    await loginPage.open();
    await loginPage.chooseOrganizationSignIn();
    await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
    await loginPage.submit();
    await homePage.expectArrived();
  },
);

Given(
  /^I have reached the (New Transaction|Workspace|Preferences) page by activating the (New Transaction|Workspace|Preferences) icon on the Home page dashboard$/,
  async (
    { homePage, newTransactionPage, workspacePage, preferencesPage },
    destination: string,
    icon: string,
  ) => {
    await homePage.activateDashboardIcon(icon);
    await expectArrivedAt({ newTransactionPage, workspacePage, preferencesPage }, destination);
  },
);

When('I look at the icons offered on the Home page dashboard', async () => {
  // The Given has already placed the user on the Home page. The icons are read
  // in the Then step, which keeps the assertion and the thing it asserts on in
  // one place rather than smuggling state between steps.
});

When('I look at the links offered in the header navigation bar', async () => {
  // As above: the reading happens in the Then step.
});

When(
  /^I activate the (New Transaction|Workspace|Preferences) icon on the Home page dashboard$/,
  async ({ homePage }, icon: string) => {
    await homePage.activateDashboardIcon(icon);
  },
);

When(
  /^I activate the (New Transaction|Workspace) link in the header navigation bar$/,
  async ({ homePage }, link: string) => {
    await homePage.activateHeaderLink(link);
  },
);

When('I activate the Command Center control in the upper left corner', async ({ homePage }) => {
  await homePage.activateCommandCenter();
});

Then(
  'three icons are offered, named New Transaction, Workspace and Preferences',
  async ({ homePage }) => {
    await homePage.expectDashboardIcons();
  },
);

Then('each of the three icons can be activated', async ({ homePage }) => {
  await homePage.expectDashboardIconsActivatable();
});

Then(
  /^I arrive at the (New Transaction|Workspace|Preferences) page$/,
  async ({ newTransactionPage, workspacePage, preferencesPage }, destination: string) => {
    await expectArrivedAt({ newTransactionPage, workspacePage, preferencesPage }, destination);
  },
);

Then('the page offers to create a transaction', async ({ newTransactionPage }) => {
  // Asserted inside the page object alongside the address, so the two halves of
  // "arrived at the right page" cannot drift apart.
  await newTransactionPage.expectArrived();
});

Then(
  'links named New Transaction and Workspace are offered in the header navigation bar',
  async ({ homePage }) => {
    await homePage.expectHeaderLinks();
  },
);

Then(
  'those links are distinct from the Home page dashboard icons of the same name',
  async ({ homePage }) => {
    await homePage.expectHeaderLinksDistinctFromDashboardIcons();
  },
);

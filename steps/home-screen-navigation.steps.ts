import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { test, type NavigationOutcome } from '../src/fixtures/test.ts';

/**
 * Step definitions for features/approved/home-navigation/home-screen-navigation.feature.
 *
 * Orchestration only. Every locator lives in a page object or a component and
 * every credential decision lives in the organization-login service, so nothing
 * here knows what the application looks like.
 *
 * The one piece of knowledge that does live here is which destination answers
 * for a module name in a Gherkin table. That is a mapping between the business
 * vocabulary of the feature file and the page objects, which is exactly what a
 * step definition is for.
 */
const { Given, When, Then } = createBdd(test);

const HOME = 'Home';
const NEW_TRANSACTION = 'New Transaction';
const WORKSPACE = 'Workspace';
const PREFERENCES = 'Preferences';
const ORGANIZATION = 'Organization';
const VAULT = 'Vault';

/**
 * Records whether the browser reached the module it was sent to.
 *
 * The check has to run while the browser is still there, so it runs here and
 * the verdict is kept for the Then step. A thrown assertion is captured rather
 * than propagated so that a table of five modules reports on all five instead
 * of stopping at the first, which is what makes the resulting failure useful.
 */
async function record(
  outcomes: NavigationOutcome[],
  module: string,
  arrival: () => Promise<void>,
): Promise<void> {
  try {
    await arrival();
    outcomes.push({ module, arrived: true, detail: '' });
  } catch (error) {
    outcomes.push({ module, arrived: false, detail: (error as Error).message });
  }
}

function expectEveryOutcomeArrived(outcomes: NavigationOutcome[], expectedModules: number): void {
  // The count is asserted first. Without it a When step that silently walked
  // nothing at all would leave an empty list and every assertion below would
  // vacuously hold, reporting a pass for a journey that never happened.
  expect(outcomes).toHaveLength(expectedModules);
  for (const outcome of outcomes) {
    expect(outcome.arrived, `${outcome.module} was not reached. ${outcome.detail}`).toBe(true);
  }
}

Given('I am signed in to eCore as an Organization user', async ({ loginPage, homePage, organizationLogin }) => {
  await loginPage.open();
  await loginPage.chooseOrganizationSignIn();
  await loginPage.enterOrganizationDetails(organizationLogin.correctDetails());
  await loginPage.submit();
  await homePage.expectArrived();
});

Given('the Home page is displayed', async ({ homePage }) => {
  await homePage.expectArrived();
});

Given('I am not signed in to eCore', async ({ context }) => {
  // The bdd project carries no stored session, so the context starts signed
  // out. Cookies are cleared anyway so the scenario states its precondition
  // rather than depending on a configuration file to hold it true.
  //
  // Deliberately no credential is entered, not even a wrong one: the eCore
  // login page warns that an account can lock out after a number of incorrect
  // attempts, and this scenario is about never having signed in at all.
  await context.clearCookies();
});

When('I view the modules offered on the Home page and in the navigation menu', async () => {
  // Nothing to do. The Home page is displayed and the banner menu is part of
  // it; what is offered is read in the Then step, which keeps the assertion and
  // the thing it asserts on together.
});

When('I open the navigation menu', async () => {
  // The navigation menu is part of the banner and is already displayed. The
  // grouping beneath Preferences is revealed by the Then steps that assert on
  // it, so that each assertion performs the reveal it depends on.
});

When(
  'I select each of the following Dashboard icons in turn, returning to the Home page after each',
  async (
    { homePage, newTransactionPage, workspacePage, preferencesPage, organizationPage, vaultPage, navigationOutcomes },
    dataTable,
  ) => {
    const destinations = {
      homePage,
      newTransactionPage,
      workspacePage,
      preferencesPage,
      organizationPage,
      vaultPage,
    };
    for (const [module] of dataTable.raw()) {
      await homePage.activateDashboardIcon(module);
      await record(navigationOutcomes, module, () => arrivalAt(module, destinations));
      // Returned to directly, never through Command Center or the menu Home
      // entry: those are what TS-ETA-411-006 and TS-ETA-411-003 exist to prove,
      // and a scenario that used them as setup would report a pass for a
      // control it never tested.
      await homePage.open();
    }
  },
);

When(
  'I select each of the following entries from the navigation menu in turn',
  async (
    { navigationMenu, homePage, newTransactionPage, workspacePage, preferencesPage, organizationPage, vaultPage, navigationOutcomes },
    dataTable,
  ) => {
    const destinations = {
      homePage,
      newTransactionPage,
      workspacePage,
      preferencesPage,
      organizationPage,
      vaultPage,
    };
    // No return to Home between entries, and the table order matters. The menu
    // Home entry cannot be clicked while the Home page is displayed - a <span>
    // intercepts the click, observed on qa5 - so Home is reached from Workspace,
    // which is where the previous row leaves the browser. That is also the
    // journey the acceptance criterion describes: reaching Home from elsewhere.
    for (const [module] of dataTable.raw()) {
      await selectMenuEntry(navigationMenu, module);
      await record(navigationOutcomes, module, () => arrivalAt(module, destinations));
    }
  },
);

When(
  'I select each of the following entries from beneath Preferences in turn, returning to the Home page after each',
  async (
    { navigationMenu, homePage, newTransactionPage, workspacePage, preferencesPage, organizationPage, vaultPage, navigationOutcomes },
    dataTable,
  ) => {
    const destinations = {
      homePage,
      newTransactionPage,
      workspacePage,
      preferencesPage,
      organizationPage,
      vaultPage,
    };
    for (const [module] of dataTable.raw()) {
      await selectMenuEntry(navigationMenu, module);
      await record(navigationOutcomes, module, () => arrivalAt(module, destinations));
      await homePage.open();
    }
  },
);

When(
  'I open each of the following modules and then select Command Center',
  async (
    { navigationMenu, commandCenter, homePage, newTransactionPage, workspacePage, preferencesPage, organizationPage, vaultPage, navigationOutcomes },
    dataTable,
  ) => {
    const destinations = {
      homePage,
      newTransactionPage,
      workspacePage,
      preferencesPage,
      organizationPage,
      vaultPage,
    };
    for (const [module] of dataTable.raw()) {
      if (module === ORGANIZATION || module === VAULT) {
        await selectMenuEntry(navigationMenu, module);
      } else {
        await homePage.activateDashboardIcon(module);
      }
      // The module must genuinely have opened before Command Center is used,
      // otherwise a return to Home would be indistinguishable from never having
      // left it and the scenario would pass without exercising anything.
      await arrivalAt(module, destinations);
      await commandCenter.activate();
      await record(navigationOutcomes, module, () => homePage.expectArrived());
    }
  },
);

When('I request the Workspace module directly', async ({ workspacePage }) => {
  await workspacePage.requestDirectly();
});

Then('the following modules are offered to me', async ({ homePage, navigationMenu }, dataTable) => {
  for (const [module] of dataTable.raw()) {
    switch (module) {
      case HOME:
        await navigationMenu.expectHomeOffered();
        break;
      case NEW_TRANSACTION:
        await homePage.expectDashboardIconOffered(module);
        await navigationMenu.expectNewTransactionOffered();
        break;
      case WORKSPACE:
        await homePage.expectDashboardIconOffered(module);
        await navigationMenu.expectWorkspaceOffered();
        break;
      case PREFERENCES:
        await homePage.expectDashboardIconOffered(module);
        await navigationMenu.expectPreferencesGroupingOffered();
        break;
      case ORGANIZATION:
        await navigationMenu.expectOrganizationOffered();
        break;
      case VAULT:
        await navigationMenu.expectVaultOffered();
        break;
      default:
        throw new Error(`The feature file names a module this step cannot look for: ${module}`);
    }
  }
});

Then('each icon opens its own module', async ({ navigationOutcomes }) => {
  expectEveryOutcomeArrived(navigationOutcomes, 3);
});

Then('each entry opens its own module', async ({ navigationOutcomes }) => {
  expectEveryOutcomeArrived(navigationOutcomes, 3);
});

Then('each entry opens its own page', async ({ navigationOutcomes }) => {
  expectEveryOutcomeArrived(navigationOutcomes, 2);
});

Then('the Home page is displayed again after each module', async ({ navigationOutcomes }) => {
  expectEveryOutcomeArrived(navigationOutcomes, 5);
});

Then('Preferences is offered to me', async ({ navigationMenu }) => {
  await navigationMenu.expectPreferencesGroupingOffered();
});

Then('the following entries are grouped beneath Preferences', async ({ navigationMenu }, dataTable) => {
  for (const [entry] of dataTable.raw()) {
    switch (entry) {
      case ORGANIZATION:
        await navigationMenu.expectOrganizationOffered();
        break;
      case VAULT:
        await navigationMenu.expectVaultOffered();
        break;
      default:
        throw new Error(`The feature file groups an entry this step cannot look for: ${entry}`);
    }
  }
});

Then('an error message is shown to me', async ({ loginPage }) => {
  // Presence, not wording. The message the application shows here says the
  // session has timed out, which is questionable for a visitor who never had
  // one, but AC-ETA-411-009 asks only that an error is shown. Asserting the
  // observed wording would make the current behaviour the definition of
  // correct. The wording is recorded for the reviewer instead.
  await loginPage.expectSignInFailureReported();
});

Then('the sign-in page is still displayed', async ({ loginPage }) => {
  await loginPage.expectStillOnLoginPage();
});

type Destinations = {
  homePage: { expectArrived(): Promise<void> };
  newTransactionPage: { expectArrived(): Promise<void> };
  workspacePage: { expectArrived(): Promise<void> };
  preferencesPage: { expectArrived(): Promise<void> };
  organizationPage: { expectArrived(): Promise<void> };
  vaultPage: { expectArrived(): Promise<void> };
};

async function arrivalAt(module: string, pages: Destinations): Promise<void> {
  switch (module) {
    case HOME:
      return pages.homePage.expectArrived();
    case NEW_TRANSACTION:
      return pages.newTransactionPage.expectArrived();
    case WORKSPACE:
      return pages.workspacePage.expectArrived();
    case PREFERENCES:
      return pages.preferencesPage.expectArrived();
    case ORGANIZATION:
      return pages.organizationPage.expectArrived();
    case VAULT:
      return pages.vaultPage.expectArrived();
    default:
      throw new Error(`The feature file names a destination this step cannot check: ${module}`);
  }
}

async function selectMenuEntry(
  navigationMenu: {
    selectHome(): Promise<void>;
    selectNewTransaction(): Promise<void>;
    selectWorkspace(): Promise<void>;
    selectOrganization(): Promise<void>;
    selectVault(): Promise<void>;
  },
  entry: string,
): Promise<void> {
  switch (entry) {
    case HOME:
      return navigationMenu.selectHome();
    case NEW_TRANSACTION:
      return navigationMenu.selectNewTransaction();
    case WORKSPACE:
      return navigationMenu.selectWorkspace();
    case ORGANIZATION:
      return navigationMenu.selectOrganization();
    case VAULT:
      return navigationMenu.selectVault();
    default:
      throw new Error(`The feature file names a menu entry this step cannot select: ${entry}`);
  }
}

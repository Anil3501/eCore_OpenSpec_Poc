import type { Page } from '@playwright/test';
import { EcoreHomePage } from '../pages/ecore-home.page.ts';
import { EcoreNewTransactionPage } from '../pages/ecore-new-transaction.page.ts';
import { EcoreWorkspacePage } from '../pages/ecore-workspace.page.ts';
import { EcorePreferencesPage } from '../pages/ecore-preferences.page.ts';
import { EcoreOrganizationPage } from '../pages/ecore-organization.page.ts';
import { EcoreVaultPage } from '../pages/ecore-vault.page.ts';
import { NavigationMenuComponent } from '../components/navigation-menu.component.ts';
import { CommandCenterComponent } from '../components/command-center.component.ts';

/**
 * What one navigation attempt reached.
 *
 * Every ETA-411 navigation scenario walks a table of modules in a When step and
 * judges the walk in a Then step. Arrival has to be checked while the browser is
 * still on the destination, so the When makes the check and records the result
 * here, and the Then asserts over the record.
 */
export interface NavigationOutcome {
  module: string;
  arrived: boolean;
  /** The failure as the assertion reported it. Empty when the arrival held. */
  detail: string;
}

export interface HomeNavigationFixtures {
  homePage: EcoreHomePage;
  newTransactionPage: EcoreNewTransactionPage;
  workspacePage: EcoreWorkspacePage;
  preferencesPage: EcorePreferencesPage;
  organizationPage: EcoreOrganizationPage;
  vaultPage: EcoreVaultPage;
  navigationMenu: NavigationMenuComponent;
  commandCenter: CommandCenterComponent;
  navigationOutcomes: NavigationOutcome[];
}

export const homeNavigationFixture = {
  homePage: async ({ page }: { page: Page }, use: (p: EcoreHomePage) => Promise<void>) => {
    await use(new EcoreHomePage(page));
  },
  newTransactionPage: async ({ page }: { page: Page }, use: (p: EcoreNewTransactionPage) => Promise<void>) => {
    await use(new EcoreNewTransactionPage(page));
  },
  workspacePage: async ({ page }: { page: Page }, use: (p: EcoreWorkspacePage) => Promise<void>) => {
    await use(new EcoreWorkspacePage(page));
  },
  preferencesPage: async ({ page }: { page: Page }, use: (p: EcorePreferencesPage) => Promise<void>) => {
    await use(new EcorePreferencesPage(page));
  },
  organizationPage: async ({ page }: { page: Page }, use: (p: EcoreOrganizationPage) => Promise<void>) => {
    await use(new EcoreOrganizationPage(page));
  },
  vaultPage: async ({ page }: { page: Page }, use: (p: EcoreVaultPage) => Promise<void>) => {
    await use(new EcoreVaultPage(page));
  },
  navigationMenu: async ({ page }: { page: Page }, use: (c: NavigationMenuComponent) => Promise<void>) => {
    await use(new NavigationMenuComponent(page));
  },
  commandCenter: async ({ page }: { page: Page }, use: (c: CommandCenterComponent) => Promise<void>) => {
    await use(new CommandCenterComponent(page));
  },
  // eslint-disable-next-line no-empty-pattern
  navigationOutcomes: async ({}, use: (outcomes: NavigationOutcome[]) => Promise<void>) => {
    await use([]);
  },
};

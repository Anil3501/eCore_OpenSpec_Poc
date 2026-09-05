import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { env } from '../utils/env.ts';

/**
 * The eCore Command Center Home page.
 *
 * Deliberately minimal. `AC-ETA-351-005` requires only that a user with
 * correct organization details arrives here; what the user may then do is
 * permission-dependent behaviour, which ETA-351 lists as out of scope and
 * which remains open as `AMB-ETA-351-006`. This page object therefore asserts
 * arrival and nothing else.
 *
 * Locators were confirmed against the real application on 2026-08-31 - see
 * reports/validation/ETA-351-playwright-validation.md. Note that the page
 * title is identical to the login page's, so the title cannot be used to tell
 * them apart.
 */
export class EcoreHomePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private get homeLink(): Locator {
    return this.page.getByRole('link', { name: 'Home', exact: true });
  }

  /**
   * Only a signed-in user is offered a way to sign out, so this is the
   * strongest available evidence that sign-in actually succeeded.
   */
  private get logoutLink(): Locator {
    return this.page.getByRole('link', { name: 'Logout', exact: true });
  }

  private get workspaceHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Workspace' });
  }

  /**
   * Opens the Home page directly.
   *
   * TS-ETA-411-002 returns to Home between icons. It must not return through
   * the Command Center control or the menu Home entry, because those are the
   * subjects of TS-ETA-411-006 and TS-ETA-411-003: a scenario that used them to
   * set itself up would report a pass for the very control it never proved.
   *
   * The address is resolved from the one configured base URL rather than
   * written out, so no host is hardcoded anywhere in `src/`.
   */
  async open(): Promise<void> {
    await this.page.goto(new URL('welcome.eo', env.requireBaseUrl()).toString(), {
      waitUntil: 'domcontentloaded',
    });
    await this.expectArrived();
  }

  /**
   * The first assertion carries an explicit timeout because it is the one that
   * waits for the post-sign-in navigation to complete. Sign-in traverses the
   * browser-capability interstitial and a server round trip, which regularly
   * exceeds the 5s default - and does so more often when V8 coverage capture is
   * attached to the page. The later two assertions run against a page that has
   * already rendered, so they keep the default.
   */
  async expectArrived(): Promise<void> {
    await expect(this.logoutLink).toBeVisible({ timeout: 30_000 });
    await expect(this.homeLink).toBeVisible();
    await expect(this.workspaceHeading).toBeVisible();
  }

  // --- ETA-411: Home page icon navigation ---------------------------------
  //
  // The three dashboard icons share their accessible names with two of the
  // header navigation links, so an unscoped `getByRole('link')` matches two
  // elements and throws a strict-mode violation. Confirmed against the running
  // application on 2026-09-01: unscoped 2, scoped to the dashboard 1 - see
  // reports/validation/ETA-411-navigation-validation.json.
  //
  // Keeping the two entry points apart is load-bearing. If they ever collapse
  // into one, TS-ETA-411-002 and TS-ETA-411-003 become the same test under two
  // identifiers and two acceptance criteria would report coverage that only one
  // of them has. The dashboard icons stay here; the header navigation entries
  // live in NavigationMenuComponent and are reached by id, because the shared
  // banner is present on every module page and not only on Home.

  // VALIDATED - the dashboard container exposes no role, accessible name or
  // text of its own, so there is no accessible-locator route to it. Its id was
  // confirmed against the application on 2026-09-01.
  private get dashboard(): Locator {
    return this.page.locator('#icon-buttons');
  }

  private dashboardIcon(name: string): Locator {
    return this.dashboard.getByRole('link', { name, exact: true });
  }

  private static readonly DASHBOARD_ICON_NAMES = [
    'New Transaction',
    'Workspace',
    'Preferences',
  ] as const;

  /** AC-ETA-411-003 - the three icons are offered. */
  async expectDashboardIcons(): Promise<void> {
    for (const name of EcoreHomePage.DASHBOARD_ICON_NAMES) {
      await expect(this.dashboardIcon(name)).toBeVisible({ timeout: 30_000 });
    }
    await expect(this.dashboard.getByRole('link')).toHaveCount(
      EcoreHomePage.DASHBOARD_ICON_NAMES.length,
    );
  }

  /**
   * AC-ETA-411-003 - each icon "can be activated".
   *
   * Honest limit: visible and enabled is the strongest claim that can be made
   * without actually activating each one, and activating them is what the
   * navigation scenarios do. This asserts availability, not outcome.
   */
  async expectDashboardIconsActivatable(): Promise<void> {
    for (const name of EcoreHomePage.DASHBOARD_ICON_NAMES) {
      await expect(this.dashboardIcon(name)).toBeEnabled();
    }
  }

  /** AC-ETA-411-001 - Preferences is offered on the Home page as an icon. */
  async expectDashboardIconOffered(name: string): Promise<void> {
    await expect(this.dashboardIcon(name)).toBeVisible({ timeout: 30_000 });
  }

  async activateDashboardIcon(name: string): Promise<void> {
    await this.dashboardIcon(name).click();
  }
}

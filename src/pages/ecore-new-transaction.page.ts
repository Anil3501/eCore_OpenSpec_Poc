import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The New Transaction page.
 *
 * `AC-ETA-411-003` and `AC-ETA-411-008` both end here, reached by the dashboard
 * icon and by the header link respectively. This page object asserts arrival
 * and nothing else - what a user may then do with a transaction is outside
 * ETA-411 entirely.
 *
 * The strongest of the three destinations: it is the only one that exposes a
 * heading unique to it, so arrival is proven by address *and* by content rather
 * than by address alone. Confirmed against the application on 2026-09-01 - see
 * reports/validation/ETA-411-navigation-validation.json.
 */
export class EcoreNewTransactionPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * The address carries an explicit timeout because this assertion is the one
   * that waits for the navigation to complete; the heading then runs against a
   * page that has already rendered.
   *
   * Every page in this application returns the title "eOriginal Command
   * Center™", so the title is useless as a discriminator and is not used.
   */
  async expectArrived(): Promise<void> {
    await expect(this.page).toHaveURL(/\/ssweb\/setup\/container\/ct\/newPackage\.eo/, {
      timeout: 30_000,
    });
    await expect(this.page.getByRole('heading', { name: 'Create Transaction' })).toBeVisible();
  }
}

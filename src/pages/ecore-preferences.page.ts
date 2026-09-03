import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The Preferences page.
 *
 * `AC-ETA-411-005`. Arrival only.
 *
 * Deliberately weaker than the other two destinations, and the weakness is
 * stated rather than hidden. PLAYWRIGHT_VALIDATION on 2026-09-01 found no
 * heading, landmark or text on this page that does not also appear on every
 * other page in the application - the only heading present is the upload-format
 * boilerplate that the shared layout renders everywhere. So the address is the
 * only honest discriminator available, and this assertion would not notice a
 * Preferences page that rendered empty.
 *
 * Do not "fix" this by asserting the boilerplate heading. That would pass on
 * any page in the product and would report coverage this test does not have.
 *
 * `AMB-ETA-411-006` - whether the header menu link labelled "Organization" is
 * also a route to Preferences - remains REVIEW_REQUIRED and is not guessed at
 * here.
 */
export class EcorePreferencesPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async expectArrived(): Promise<void> {
    await expect(this.page).toHaveURL(/\/ssweb\/setup\/prefs\/preferences\.eo/, {
      timeout: 30_000,
    });
  }
}

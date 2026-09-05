import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The Preferences page.
 *
 * `AC-ETA-411-003` - the Preferences dashboard icon opens it. Arrival only.
 *
 * This was address-only until 2026-09-05. The earlier note said no heading on
 * this page was anything but shared boilerplate; that conclusion came from a
 * probe reading `textContent` off `h1,h2,h3,legend,caption`, which is the same
 * flawed technique recorded in the scar on EcoreWorkspacePage - a `<legend>` is
 * not a heading.
 *
 * Re-probed on qa5 through the ARIA role engine, filtered by visibility - the
 * identical engine `expect(getByRole(...))` uses - the page exposes seven
 * visible headings: Scope, SmartSign Web, Command Center, Workflow Rules,
 * Organization Administration, Vault Administration, Partner Configuration.
 * Evidence: reports/validation/TP-ETA-411-001-content-probe.json.
 *
 * Two of those, Scope and Organization Administration, are absent from the
 * Vault page, so they are the discriminators asserted below. This is strictly
 * stronger than the address alone: the address assertion is kept, and a
 * Preferences page that rendered empty would now be caught.
 *
 * `AMB-ETA-411-006` - whether the menu entry labelled "Organization" is also a
 * route to Preferences - is no longer open on the evidence. It is. See
 * EcoreOrganizationPage and
 * reports/validation/TP-ETA-411-001-expectation-mismatch.json.
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
    await expect(this.page.getByRole('heading', { name: 'Scope' })).toBeVisible();
    await expect(
      this.page.getByRole('heading', { name: 'Organization Administration' }),
    ).toBeVisible();
  }
}

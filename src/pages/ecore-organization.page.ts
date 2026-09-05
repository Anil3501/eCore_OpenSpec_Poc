import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The page reached by the Organization entry under Preferences.
 *
 * `AC-ETA-411-006`, `TS-ETA-411-005`.
 *
 * READ THIS BEFORE STRENGTHENING ANYTHING HERE.
 *
 * The approved automation design requires arrival to be asserted on page
 * content, never on the address, because the Organization entry shares
 * `/ssweb/setup/prefs/preferences.eo` with the Preferences dashboard icon. The
 * content probe run on qa5 on 2026-09-05 shows that content does not separate
 * them either: the two routes produce the same address AND the same seven
 * visible ARIA headings. Evidence:
 * reports/validation/TP-ETA-411-001-content-probe.json.
 *
 * So this class asserts what the application demonstrably does - the entry
 * opens the organization administration settings - and it does NOT claim to
 * prove that Organization is a destination distinct from Preferences, because
 * on this evidence it is not. That gap between the acceptance criterion and the
 * application is recorded in
 * reports/validation/TP-ETA-411-001-expectation-mismatch.json and is a human
 * decision, not one this page object may make by quietly asserting less.
 *
 * Vault, by contrast, is genuinely its own page - different address, different
 * headings, different content - see EcoreVaultPage.
 */
export class EcoreOrganizationPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async expectArrived(): Promise<void> {
    // Content first, deliberately: it is the assertion the approved design
    // asked for. The address is checked too because it costs nothing and a
    // weaker assertion is never made just because a stronger one exists.
    await expect(
      this.page.getByRole('heading', { name: 'Organization Administration' }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(this.page.getByRole('heading', { name: 'Scope' })).toBeVisible();
    await expect(this.page).toHaveURL(/\/ssweb\/setup\/prefs\/preferences\.eo/);
  }
}

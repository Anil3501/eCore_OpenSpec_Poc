import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The Vault page.
 *
 * `AC-ETA-411-006`, `TS-ETA-411-005`. Arrival only.
 *
 * Unlike Organization, Vault really is a destination of its own. The content
 * probe on qa5 on 2026-09-05 recorded a distinct address
 * (`/ssweb/setup/vault/vault.eo`), a distinct set of visible ARIA headings -
 * it has "Vault Administration" but neither "Scope" nor "Organization
 * Administration" - and distinct content beginning "Industry Settings". So the
 * content assertion the approved design asked for is available here, and it is
 * made. Evidence: reports/validation/TP-ETA-411-001-content-probe.json.
 *
 * "Vault Administration" also appears on the Preferences page, so on its own it
 * would not separate the two. Paired with the address, which Preferences does
 * not share, it does.
 */
export class EcoreVaultPage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async expectArrived(): Promise<void> {
    await expect(this.page).toHaveURL(/\/ssweb\/setup\/vault\/vault\.eo/, { timeout: 30_000 });
    await expect(this.page.getByRole('heading', { name: 'Vault Administration' })).toBeVisible();
  }
}

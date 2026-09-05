import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The navigation menu in the shared banner.
 *
 * Every locator here was proven against the running application on qa5 on
 * 2026-09-05 - see reports/validation/TP-ETA-411-001-browser-validation.json.
 * The earlier ETA-411 probes ran against qa1 and were treated as expectation
 * rather than fact when the environment moved.
 *
 * Two findings from that validation shape this class and neither is cosmetic.
 *
 * First, `getByRole('link', { name: 'Organization' })` and the same call for
 * `Vault` both matched ZERO elements. Their `<ul>` carries `eo-hidden`, so they
 * are absent from the accessibility tree until the Preferences section is
 * hovered. Anything that reaches them must open the section first.
 *
 * Second, the menu Home link cannot be clicked while the Home page is already
 * displayed: Playwright reports `<span> intercepts pointer events`. The same
 * click succeeds from another module. `selectHome()` therefore documents that
 * it must be called from somewhere other than Home.
 */
export class NavigationMenuComponent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // VALIDATED - every menu entry carries an id containing a dot, so `#id` is
  // not a valid CSS id selector and an attribute selector is required. The
  // accessible-name route works for the top-level entries but matches two
  // elements for New Transaction and Workspace, because the dashboard icons
  // share their names. Each id resolved to exactly one element on qa5.
  private entry(id: string): Locator {
    return this.page.locator(`[id="${id}"]`);
  }

  private get homeEntry(): Locator {
    return this.entry('header.home');
  }

  private get newTransactionEntry(): Locator {
    return this.entry('header.new_transaction');
  }

  private get workspaceEntry(): Locator {
    return this.entry('header.workspace');
  }

  // VALIDATED - `getByRole('link', { name: 'Organization' })` matched ZERO
  // elements on qa5. The entry sits in a <ul class="eo-hidden">, so it is absent
  // from the accessibility tree until the section is hovered, and there is no
  // accessible route to an element that is not in that tree. Scoped inside the
  // Preferences section on purpose: being reachable there is what AC-ETA-411-005
  // means by "grouped beneath Preferences", so the scope is part of the
  // assertion rather than a convenience.
  private get organizationEntry(): Locator {
    return this.preferencesSection.locator('[id="header.preferences.org"]');
  }

  // VALIDATED - same as organizationEntry above: zero accessible matches until
  // the section is hovered, confirmed on qa5 on 2026-09-05.
  private get vaultEntry(): Locator {
    return this.preferencesSection.locator('[id="header.preferences.vault"]');
  }

  // VALIDATED - three sibling sections share the class `section more
  // dropdownMenu` (Analytics, Preferences and Help), so a positional pick
  // selects Analytics. The section is identified by what it contains instead.
  private get preferencesSection(): Locator {
    return this.page.locator('li.section:has([id="header.preferences.org"])');
  }

  // VALIDATED - the grouping label is a <span>, not a link. Confirmed on qa5:
  // tag span, text "Preferences", no href. This is the evidence behind the
  // owner's Gate 1 answer to AMB-ETA-411-007 that Preferences is a heading over
  // two entries rather than a destination of its own.
  private get preferencesGroupingLabel(): Locator {
    return this.preferencesSection.locator('span').filter({ hasText: /^Preferences$/ });
  }

  /**
   * Reveals the entries grouped beneath Preferences.
   *
   * Hover, not click: the submenu is opened by the section's hover state. This
   * waits for the entry to become visible rather than for a fixed period.
   */
  async openPreferencesGroup(): Promise<void> {
    await this.preferencesSection.hover();
    await expect(this.vaultEntry).toBeVisible();
  }

  async expectHomeOffered(): Promise<void> {
    await expect(this.homeEntry).toBeVisible({ timeout: 30_000 });
  }

  async expectNewTransactionOffered(): Promise<void> {
    await expect(this.newTransactionEntry).toBeVisible();
  }

  async expectWorkspaceOffered(): Promise<void> {
    await expect(this.workspaceEntry).toBeVisible();
  }

  /** AC-ETA-411-005 - Preferences is offered as a grouping, not as a destination. */
  async expectPreferencesGroupingOffered(): Promise<void> {
    await expect(this.preferencesGroupingLabel).toBeVisible();
  }

  async expectOrganizationOffered(): Promise<void> {
    await this.openPreferencesGroup();
    await expect(this.organizationEntry).toBeVisible();
  }

  async expectVaultOffered(): Promise<void> {
    await this.openPreferencesGroup();
    await expect(this.vaultEntry).toBeVisible();
  }

  /**
   * Must be called from a page other than Home. Clicking this entry while Home
   * is displayed is intercepted by a `<span>` and times out - observed on qa5,
   * recorded in the browser-validation report. That is not a limitation of the
   * test: the scenario is about reaching Home from elsewhere.
   */
  async selectHome(): Promise<void> {
    await this.homeEntry.click();
  }

  async selectNewTransaction(): Promise<void> {
    await this.newTransactionEntry.click();
  }

  async selectWorkspace(): Promise<void> {
    await this.workspaceEntry.click();
  }

  async selectOrganization(): Promise<void> {
    await this.openPreferencesGroup();
    await this.organizationEntry.click();
  }

  async selectVault(): Promise<void> {
    await this.openPreferencesGroup();
    await this.vaultEntry.click();
  }
}

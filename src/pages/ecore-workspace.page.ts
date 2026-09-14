import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { env } from '../utils/env.ts';

/**
 * The Workspace page.
 *
 * `AC-ETA-411-004` and `AC-ETA-411-009` both end here. Arrival only; what a
 * user may then search for is outside ETA-411.
 *
 * Address-only, matching TP-ETA-411-001 exactly, and the history of that is
 * worth keeping because it is a trap someone will otherwise walk into again.
 * On 2026-09-01 this class asserted a visible heading named "Search Criteria",
 * on the strength of a PLAYWRIGHT_VALIDATION probe that reported it. The probe
 * read `textContent` from `h1, h2, h3, legend, caption` without checking ARIA
 * role or visibility, and a `<legend>` or `<caption>` is not a heading. Three
 * scenarios failed. The reviewer reverted to address-only the same day. The
 * page genuinely exposes nothing unique to it, exactly as the original
 * reconnaissance said.
 *
 * So this assertion is weak, and knowingly so: it would not notice a Workspace
 * page that reached the right address and then failed to render. That is
 * `RISK-TP-ETA-411-002`, accepted at Gate 2. Do not strengthen it again without
 * an element whose ARIA role and visibility have both been confirmed against
 * the running application.
 */
export class EcoreWorkspacePage {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async expectArrived(): Promise<void> {
    await expect(this.page).toHaveURL(/\/ssweb\/setup\/workspace\/workspace\.eo/, {
      timeout: 30_000,
    });
  }

  /**
   * Asks the application for this page without going through any menu.
   *
   * TS-ETA-411-007 needs a request that no signed-in navigation could have
   * produced, so the address is requested directly. It is resolved from the one
   * configured base URL rather than written out, so no host is hardcoded here.
   *
   * No assertion follows the navigation on purpose: whether the application
   * serves this page or refuses it IS the thing under test, so this method must
   * not presume either outcome.
   */
  async requestDirectly(): Promise<void> {
    await this.page.goto(new URL('workspace/workspace.eo', env.requireBaseUrl()).toString(), {
      waitUntil: 'domcontentloaded',
    });
  }

  /**
   * The row for a named collection in the Collections accordion.
   *
   * VALIDATED - the row carries no accessible name of its own, so the
   * `data-collection-name` attribute (populated with the real collection name)
   * is the most stable handle. Confirmed live against qa5's "demo collection"
   * and "results 21 july" on 2026-09-11 (EC-12000 PLAYWRIGHT_VALIDATION).
   */
  private collectionRow(collectionName: string): Locator {
    return this.page.locator(`tr.collection[data-collection-name="${collectionName}"]`);
  }

  /**
   * Every collection name currently in the Collections accordion, in
   * on-screen order.
   *
   * VALIDATED - `tr.collection` is the same row-level selector
   * `collectionRow` scopes by name; read unscoped, it returns every row.
   * qa5's Collections list changed once already during EC-12000 (from
   * "demo collection"/"test collection" to "c1".."c5"), so no scenario may
   * assume a specific name still exists. This reads the list the application
   * is actually offering right now instead. Confirmed live 2026-09-16.
   */
  async collectionNames(): Promise<string[]> {
    const rows = this.page.locator('tr.collection');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    const names = await rows.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-collection-name')),
    );
    return names.filter((name): name is string => name !== null && name.trim() !== '');
  }

  // VALIDATED - the row's dropdown-action trigger carries no accessible name;
  // `.collection-dropdown-action` is the only stable handle. Confirmed live
  // 2026-09-11.
  private collectionDropdownAction(collectionName: string): Locator {
    return this.collectionRow(collectionName).locator('.collection-dropdown-action');
  }

  // VALIDATED - the row-level dropdown's top-level "Batch" cascading trigger.
  // `.collection-dropdown-actions .cascading` is duplicated once per open
  // collection row's menu template, so it is always scoped to a specific
  // row's own dropdown container, never queried page-wide. Confirmed live
  // 2026-09-11.
  private batchCascadingTrigger(collectionName: string): Locator {
    return this.collectionRow(collectionName).locator('.collection-dropdown-actions .cascading').first();
  }

  // VALIDATED - the "Paper Out® Request" entry sits inside that "Batch"
  // cascading submenu and is `visibility:hidden` until the submenu is
  // revealed by hovering its trigger. The application renders one copy of
  // this menu markup per collection row, so this locator is always scoped to
  // a specific row rather than queried page-wide (an unscoped
  // `div.paperOutTransactionCollection` matches every row's copy and throws a
  // Playwright strict-mode violation). Confirmed live 2026-09-11.
  private paperOutRequestMenuItem(collectionName: string): Locator {
    return this.collectionRow(collectionName).locator('div.paperOutTransactionCollection');
  }

  /**
   * Opens the Paper Out® Request modal for a named collection via the
   * Collections accordion's row-level dropdown action.
   *
   * EC-12000 AMB-EC-12000-001 resolution: a Paper Out initiated from
   * Collections uses this accordion's Batch option, then the same
   * `PaperOutRequestModalComponent` used from a transaction or document row.
   */
  async openPaperOutRequestModal(collectionName: string): Promise<void> {
    const row = this.collectionRow(collectionName);
    // The Collections list is populated by an AJAX call that fires after the
    // Workspace document itself has loaded, so the row is not necessarily
    // present the instant `expectArrived()` resolves - a longer timeout than
    // the page-object default covers that load, confirmed live 2026-09-11.
    await expect(row).toBeVisible({ timeout: 15_000 });
    // The dropdown-action icon is only revealed by the browser on real row
    // hover (its wrapping `.dropdown-action` is `display:none` until then,
    // confirmed live 2026-09-11); a direct click without first hovering the
    // row leaves it non-interactable and the click hangs.
    await row.hover();
    await this.collectionDropdownAction(collectionName).click();
    // The "Paper Out® Request" entry lives in a nested "Batch" cascading
    // submenu that is itself hidden until its trigger is hovered (confirmed
    // live 2026-09-11) - hover it before clicking the now-revealed entry.
    await this.batchCascadingTrigger(collectionName).hover();
    await this.paperOutRequestMenuItem(collectionName).click();
  }

  /**
   * Loads a collection's transactions into the results table.
   *
   * Clicking the collection row is the same gesture a user makes; the results
   * table is AJAX-populated afterwards, so callers must wait for a row rather
   * than reading a count immediately.
   */
  async openCollection(collectionName: string): Promise<void> {
    const row = this.collectionRow(collectionName);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
  }

  /**
   * The transaction rows of the loaded results table.
   *
   * VALIDATED - a transaction row is a `<tr>` carrying the transaction's
   * numeric vault id as its `id`, plus `draggable-transaction`. The numeric id
   * makes `tr#16509517` invalid CSS, so the attribute form is mandatory.
   * Confirmed live against qa5 on 2026-09-14.
   */
  private get transactionRows(): Locator {
    return this.page.locator('tbody tr[id].draggable-transaction');
  }

  /**
   * Selects the first transaction in the loaded results table and returns its
   * vault id, so a scenario can name the transaction it acted on.
   */
  async selectFirstTransaction(): Promise<string> {
    const row = this.transactionRows.first();
    await expect(row).toBeVisible({ timeout: 25_000 });
    await row.click();
    const id = await row.getAttribute('id');
    if (id === null) throw new Error('The selected transaction row carries no id attribute.');
    return id;
  }

  /**
   * VALIDATED - the row-level action handles do NOT live inside the `<tr>`.
   * The application renders one shared `td#transactionNameActions` container
   * and repopulates it for whichever row is selected. Every row-scoped lookup
   * for `.snapshot-dropdown-action` therefore returns 0, which is exactly why
   * an earlier probe wrongly concluded the transaction offered no actions.
   * Confirmed live 2026-09-14.
   */
  private get transactionActionTrigger(): Locator {
    return this.page.locator('td#transactionNameActions .snapshot-dropdown-action');
  }

  /**
   * Opens the Paper Out® Request modal for the currently selected
   * transaction.
   *
   * VALIDATED - `div.paperOutTransaction` is the transaction-level
   * "Paper Out® Request" entry. It is absent when the transaction is locked
   * (demo_Anil's transaction, locked by an Authorized Paper Out, offers no
   * such entry at all), so its absence is a real eligibility signal rather
   * than a timing problem. Confirmed live 2026-09-14.
   */
  async openPaperOutRequestModalForTransaction(): Promise<void> {
    const trigger = this.transactionActionTrigger;
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click();

    // VALIDATED - the menu entry carries no ARIA role and no accessible name;
    // `div.paperOutTransaction` is the application's own class for the
    // transaction-level "Paper Out® Request" item and is the only stable
    // handle. Confirmed live against qa5 on 2026-09-14.
    const entry = this.page.locator('div.paperOutTransaction');
    await expect(
      entry,
      'The selected transaction offers no transaction-level Paper Out® Request action. That ' +
        'happens when the transaction is locked by an existing Paper Out, so it indicates an ' +
        'ineligible fixture rather than a timing problem.',
    ).toBeVisible({ timeout: 20_000 });
    await entry.click();
  }

  /**
   * VALIDATED - a document row is `tr.documentRow`, nested under its
   * transaction and revealed once that transaction row is selected. Confirmed
   * live 2026-09-14.
   */
  private get documentRows(): Locator {
    return this.page.locator('tr.documentRow');
  }

  /**
   * Selects the first document of the currently selected transaction.
   *
   * The document row carries two `.snapshot-dropdown-action` handles and the
   * first is `display:none` until the row is genuinely hovered, so the
   * visible one is chosen by inspection rather than by index - picking
   * `.first()` resolves to the hidden one and the click hangs. Confirmed live
   * 2026-09-14.
   */
  async selectFirstDocument(): Promise<void> {
    const row = this.documentRows.first();
    await expect(row).toBeVisible({ timeout: 25_000 });
    await row.click();
    await row.hover();
  }

  private async visibleDocumentActionTrigger(): Promise<Locator> {
    const row = this.documentRows.first();
    await row.hover();
    // VALIDATED - the document row renders TWO `.snapshot-dropdown-action`
    // handles and the first is `display:none` until the row is genuinely
    // hovered, so the one to click must be chosen by visibility. Playwright's
    // `:visible` engine does that as part of the selector, which keeps the
    // choice non-positional - an index-based pick resolves to the hidden
    // handle and the click hangs. Neither handle carries an ARIA role or an
    // accessible name. Confirmed live against qa5 on 2026-09-14.
    const triggers = row.locator('.snapshot-dropdown-action:visible');
    await expect(
      triggers,
      'No visible dropdown-action handle was found on the document row. The row renders two and ' +
        'reveals one on hover; if neither is visible the row was never genuinely hovered.',
    ).toHaveCount(1, { timeout: 20_000 });
    return triggers;
  }

  /**
   * Opens the Paper Out® Request modal for the currently selected document.
   *
   * VALIDATED - `div.paperOutDocument` is the document-level entry, the
   * document-row counterpart of `div.paperOutTransaction`. Confirmed live
   * 2026-09-14.
   */
  async openPaperOutRequestModalForDocument(): Promise<void> {
    const trigger = await this.visibleDocumentActionTrigger();
    await trigger.click();

    // VALIDATED - `div.paperOutDocument` is the document-row counterpart of
    // `div.paperOutTransaction`, with the same absence of ARIA role or
    // accessible name. Confirmed live against qa5 on 2026-09-14.
    const entry = this.page.locator('div.paperOutDocument');
    await expect(
      entry,
      'The selected document offers no document-level Paper Out® Request action, which indicates ' +
        'an ineligible or already-locked fixture.',
    ).toBeVisible({ timeout: 20_000 });
    await entry.click();
  }

  /**
   * Opens the Document History dialog for the currently selected document.
   *
   * This is the only surface on which a Paper Out is recorded. The
   * TRANSACTION history records no Paper Out event whatsoever - confirmed
   * live 2026-09-14 against demo_Anil/16807619, whose Paper Out had been
   * approved all the way to Authorized and still left its transaction history
   * showing only Created Transaction / Document Added / Transaction Fully
   * Signed. Several earlier probes concluded Media Type was unobservable
   * purely because they looked there.
   */
  async openDocumentHistory(): Promise<void> {
    const trigger = await this.visibleDocumentActionTrigger();
    await trigger.click();

    // VALIDATED - `div.viewDocumentHistory` renders the label "View History".
    // Confirmed live 2026-09-14.
    const entry = this.page.locator('div.viewDocumentHistory');
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await entry.click();
  }
}

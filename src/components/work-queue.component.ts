import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The Work Queue panel on the Workspace page.
 *
 * Confirmed live against qa5 on 2026-09-11 (EC-12000, after a real Paper Out
 * Request submission on the "demo_Anil" fixture collection): a submitted
 * Paper Out request that requires approval renders as
 * `<tr class="batch selectableBatch" data-batch-name="..."
 * data-batch-type="export" data-batch-status="Submitted"
 * data-next-step="Approval">` inside the Work Queue pane's own table (a
 * separate `<table>` from the pane's header/toolbar table, the same
 * header/rows split already seen on the Collections pane). Its row-level
 * dropdown offers "View Transactions", "Approve" and "Cancel" - confirming
 * the signed-in user (the same account selected as Approver) can act on it
 * directly, matching AC-EC-12000-003.
 */
export class WorkQueueComponent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // VALIDATED - `data-batch-name` carries the exact "Name of Request" value
  // submitted; `data-batch-status="Submitted"` and `data-next-step="Approval"`
  // together confirm a genuine pending-approval item (not merely a row that
  // happens to share the name). Confirmed live 2026-09-11.
  private pendingApprovalItem(nameOfRequest: string): Locator {
    return this.page.locator(
      `tr.batch[data-batch-name="${nameOfRequest}"][data-batch-status="Submitted"][data-next-step="Approval"]`,
    );
  }

  /**
   * Asserts a Work Queue item was created for approval for the given Paper
   * Out Request name (AC-EC-12000-003 / TS-EC-12000-003).
   *
   * The Work Queue pane is AJAX-refreshed, same as the Collections pane, so
   * this waits generously rather than asserting on the first render.
   */
  async expectApprovalItemCreated(nameOfRequest: string): Promise<void> {
    await expect(this.pendingApprovalItem(nameOfRequest)).toBeVisible({ timeout: 15_000 });
  }

  // VALIDATED - the row's dropdown trigger. Confirmed live 2026-09-14: the
  // wrapping `.dropdown-action` is only revealed on real row hover, exactly
  // like the Collections pane's row actions.
  private rowDropdownTrigger(nameOfRequest: string): Locator {
    return this.pendingApprovalItem(nameOfRequest).locator('.batch-dropdown-action');
  }

  // VALIDATED - `<div class="cancelPaperOut">Cancel</div>` inside the row's
  // own dropdown container, confirmed live 2026-09-14. Scoped to the row, so
  // it can never match another batch's copy of the same markup.
  private cancelAction(nameOfRequest: string): Locator {
    return this.pendingApprovalItem(nameOfRequest).locator('div.cancelPaperOut');
  }

  // VALIDATED - `#cancelPaperOutDialog`, title "Confirm Cancellation", body
  // "Are you sure you would like to cancel the Paper Out® request?", button
  // pane ["Cancel Request", "Close"], form posting to cancelPaperOut.eo with
  // the row's `batch.id`. Captured live from the pre-rendered dialog markup
  // on 2026-09-14.
  private confirmCancellationDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Confirm Cancellation' });
  }

  /**
   * CLEANUP - reverses the real Paper Out request that TS-EC-12000-003
   * submits, so the scenario is repeatable.
   *
   * Why this is required rather than merely tidy: a submitted Paper Out
   * request places a genuine "Pending Request for Paper Out" lock on every
   * transaction it covers. Left in place, that lock makes the application
   * refuse the *next* Paper Out request against the same collection
   * ("Cannot process paper out request. The following transactions are
   * currently locked"), so TS-EC-12000-003 would pass exactly once and fail
   * on every subsequent run - confirmed live 2026-09-14.
   *
   * What is restored: cancelling at the `Submitted`/`Approval` stage returns
   * the transaction to its prior unlocked state and leaves the underlying
   * electronic original document untouched in the vault. This is the only
   * non-destructive exit from the Paper Out lifecycle. The alternative -
   * approving and then verifying - permanently removes the source documents
   * from the vault ("WARNING! Once you click Verify all source documents
   * will be removed from the vault", captured live 2026-09-14) and would
   * consume the very fixture the scenario depends on.
   *
   * Deliberately tolerant: cleanup must never turn a passing scenario red,
   * and must never mask the assertion failure of one that already failed.
   * Tolerant does not mean silent, though. This method used to return early
   * whenever the row was not present on first look, which made "the Work
   * Queue has not AJAX-refreshed yet" indistinguishable from "there is
   * nothing to cancel" - so it reported success while leaving a real lock in
   * place. That happened live on 2026-09-14 and stranded a submitted request
   * that then blocked the next run. It now waits for the row and raises a
   * descriptive error if it never appears; the caller's After hook downgrades
   * that to a warning, so a genuine nothing-to-cancel case is noisy rather
   * than dangerous.
   */
  async cancelApprovalItem(nameOfRequest: string): Promise<void> {
    const row = this.pendingApprovalItem(nameOfRequest);

    await expect(
      row,
      `Cleanup could not find a pending Paper Out request named "${nameOfRequest}" to cancel. ` +
        'If the scenario did submit one, it is still holding a transaction lock and the next run ' +
        'will be refused - cancel it by hand via Work Queue > Cancel.',
    ).toHaveCount(1, { timeout: 30_000 });

    await row.hover();
    await this.rowDropdownTrigger(nameOfRequest).click();
    await this.cancelAction(nameOfRequest).click();

    const dialog = this.confirmCancellationDialog();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole('button', { name: 'Cancel Request' }).click();

    // The pane AJAX-refreshes; the pending-approval row going away is the
    // observable evidence that the lock was released.
    await expect(row).toHaveCount(0, { timeout: 30_000 });
  }

  /**
   * Opens the Verify Paper Out modal from any Work Queue item that has
   * reached `Authorized`/`Verification` (TS-EC-12000-018).
   *
   * Deliberately not tied to one batch id: the modal's verbiage is the same
   * whichever authorized request raises it, and pinning the scenario to a
   * specific batch would make it fail the moment that batch's lifecycle moves
   * on. When no such item exists the scenario fails with a named fixture
   * blocker rather than a locator timeout, because the difference matters to
   * whoever reads the failure.
   */
  async openVerifyModalForAnyAuthorizedItem(): Promise<void> {
    const item = this.anyAuthorizedItem();
    await expect(
      item.first(),
      'BLOCKER-EC-12000-003: no Work Queue item is currently at Authorized/Verification, so the ' +
        'Verify Paper Out modal cannot be raised. A human must approve a submitted Paper Out request ' +
        '(Work Queue > Approve) to create one. Note that verifying it afterwards would permanently ' +
        'remove its source documents from the vault, so it should be left at Authorized.',
    ).toBeVisible({ timeout: 20_000 });

    const row = item.first();
    await row.hover();
    // VALIDATED - the row's action menu is opened by
    // `<div class="batch-dropdown-action">`, which carries no accessible name,
    // no role and no text of its own (it renders as a chevron glyph). There is
    // no getByRole/getByLabel/getByText alternative to reach it. Confirmed
    // live 2026-09-14.
    await row.locator('.batch-dropdown-action').click();
    // VALIDATED - `<div class="getBatchPaperOut">Print</div>` is the only
    // action an Authorized/Verification item offers besides "View
    // Transactions", and it raises the Verify Paper Out modal. Confirmed live
    // 2026-09-14.
    await row.locator('div.getBatchPaperOut').click();
  }

  // VALIDATED - an approved-but-unverified Paper Out request carries
  // data-batch-status="Authorized" and data-next-step="Verification".
  // Confirmed live 2026-09-14.
  private anyAuthorizedItem(): Locator {
    return this.page.locator('tr.batch[data-batch-status="Authorized"][data-next-step="Verification"]');
  }
}

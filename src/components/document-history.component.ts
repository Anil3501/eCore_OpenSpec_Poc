import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The Document History dialog, and the one surface on which a Paper Out's
 * recorded Media Type is observable.
 *
 * How this was established, because it cost several probes and the wrong
 * conclusion was reached twice: a Paper Out records NOTHING in the
 * transaction-level history. demo_Anil/16807619 was driven all the way to
 * Authorized and its transaction history still showed only Created
 * Transaction, Document Added and Transaction Fully Signed. The Paper Out
 * events - "Submitted Paper Out", "Authorized Paper Out", "Canceled Paper
 * Out" - are logged against the DOCUMENT. Confirmed live against qa5 on
 * 2026-09-14.
 *
 * The Media Type itself is not in the table text. It lives in the Details
 * column's "View" control as a `data-extra-data` attribute, and the dialog it
 * opens is titled "Additional Information" - which is exactly the wording
 * AC-EC-12000-016 uses. Captured live:
 *
 *   <span class="clickableText extraData"
 *         data-extra-data="Batch Name=PROBE-TS003-CHECK, ID=366823, Media Type=electronic">
 *     View
 *   </span>
 */
export class DocumentHistoryComponent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // VALIDATED - the dialog body is `#historyDialog`; its jQuery-UI wrapper
  // carries the title "Document History". Confirmed live 2026-09-14.
  private get dialog(): Locator {
    return this.page.locator('#historyDialog');
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 25_000 });
  }

  /**
   * The Details "View" control of the Submitted Paper Out event belonging to
   * one specific Paper Out request.
   *
   * Matching on the batch name rather than taking the newest event matters:
   * qa5's fixture document already carries eighteen Paper Out events from
   * earlier runs, so "the most recent one" is only correct until two runs
   * overlap, and a stale event would then be read as this run's result.
   *
   * VALIDATED - `span.extraData` in the row's last cell; the payload format
   * is "Batch Name=<name>, ID=<batch id>, Media Type=<value>". Confirmed live
   * 2026-09-14.
   */
  private submittedPaperOutExtraData(nameOfRequest: string): Locator {
    return this.dialog
      .locator('tr')
      .filter({ hasText: 'Submitted Paper Out' })
      .locator(`span.extraData[data-extra-data*="Batch Name=${nameOfRequest},"]`);
  }

  /**
   * The recorded Media Type for a named Paper Out request, read from the
   * Submitted Paper Out event's Additional Information.
   *
   * Returns the application's own raw value (observed: "paper" and
   * "electronic") rather than a normalised one, so the caller asserts against
   * what the application actually wrote.
   */
  async recordedMediaType(nameOfRequest: string): Promise<string> {
    const view = this.submittedPaperOutExtraData(nameOfRequest);
    await expect(
      view,
      `No "Submitted Paper Out" event carrying Batch Name=${nameOfRequest} was found in this ` +
        "document's history. The Paper Out was therefore never recorded against this document.",
    ).toHaveCount(1, { timeout: 25_000 });

    const payload = await view.getAttribute('data-extra-data');
    if (payload === null) {
      throw new Error(`The Submitted Paper Out event for ${nameOfRequest} carries no extra data.`);
    }

    const match = payload.match(/Media Type=([^,]+)/i);
    if (match === null) {
      throw new Error(
        `The Submitted Paper Out event for ${nameOfRequest} records no Media Type at all. Its ` +
          `Additional Information reads: "${payload}".`,
      );
    }
    return match[1].trim();
  }

  /**
   * Whether a named Paper Out request's Submitted event records any Media
   * Type segment at all.
   *
   * AC-EC-12000-017 is about absence, and absence has to be distinguishable
   * from "could not read it". A pre-change record was captured live on
   * 2026-09-14 reading exactly "Batch Name=test delete, ID=362346" - no Media
   * Type segment - alongside post-change records that carry one.
   */
  async recordsAnyMediaType(nameOfRequest: string): Promise<boolean> {
    const view = this.submittedPaperOutExtraData(nameOfRequest);
    await expect(view).toHaveCount(1, { timeout: 25_000 });
    const payload = await view.getAttribute('data-extra-data');
    return payload !== null && /Media Type=/i.test(payload);
  }

  /**
   * Opens the "Additional Information" dialog itself, so a scenario can prove
   * the value is reachable the way a user reaches it rather than only as a
   * DOM attribute.
   */
  async openAdditionalInformation(nameOfRequest: string): Promise<void> {
    await this.submittedPaperOutExtraData(nameOfRequest).click();
    await expect(this.additionalInformationDialog).toBeVisible({ timeout: 20_000 });
  }

  // VALIDATED - the Additional Information dialog's accessible name is
  // "Additional Information"; its body repeats the same payload string and it
  // is dismissed with OK. Confirmed live 2026-09-14.
  private get additionalInformationDialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Additional Information' });
  }

  async additionalInformationText(): Promise<string> {
    return this.additionalInformationDialog.innerText();
  }
}

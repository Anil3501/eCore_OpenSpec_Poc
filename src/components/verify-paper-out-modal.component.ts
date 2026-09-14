import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Readable } from 'node:stream';
import { extractPdfText } from '../utils/pdf-text.ts';

/**
 * The Verify Paper Out® Request modal (TS-EC-12000-018 / AC-EC-12000-018).
 *
 * Raised by the "Print" (`getBatchPaperOut`) action on a Work Queue item that
 * has reached `Authorized`/`Verification`. Confirmed live against qa5 on
 * 2026-09-14: the modal presents four checkboxes, in this order, each an
 * `input[type="checkbox"].verifyPOCB` with a stable id:
 *
 *   1. `#certificationReviewed`  - "I have reviewed and agree that I satisfy
 *                                   all of the terms of the ..."
 *   2. `#packageDownloaded`      - disabled until the package link is used
 *   3. `#multimediaDownloaded`   - disabled until the signatures link is used
 *   4. `#packagePrinted`         - the LAST one, the subject of AC-EC-12000-018
 *
 * This component is deliberately READ-ONLY. It never checks a box and never
 * presses Verify: the modal's own warning is that verifying permanently
 * removes every source document from the vault ("WARNING! Once you click
 * Verify all source documents will be removed from the vault and you will not
 * have an option to download or print them again", captured live 2026-09-14).
 * AC-EC-12000-018 is a verbiage assertion and needs no such action.
 */
export class VerifyPaperOutModalComponent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // VALIDATED - the jQuery dialog's accessible name is the exact title
  // "Verify Paper Out® Request" (note the registered-trademark sign, which is
  // part of the application's own wording). Confirmed live 2026-09-14.
  private get dialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Verify Paper Out® Request' });
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible({ timeout: 20_000 });
  }

  /**
   * The ids of the modal's checkboxes, in the order the modal renders them.
   *
   * Read from the DOM rather than addressed positionally: `SEM-AUTOMATION-
   * HYGIENE` forbids `.nth()` precisely because a positional locator silently
   * targets the wrong element when a list changes, and "the last checkbox" is
   * exactly the kind of claim that must not be allowed to drift quietly. By
   * reading the real order the scenario can *prove* which checkbox is last
   * instead of assuming it.
   */
  async checkboxIdsInOrder(): Promise<string[]> {
    await this.expectOpen();
    return this.dialog.evaluate((el) =>
      Array.from(el.querySelectorAll('input[type="checkbox"]')).map((cb) => (cb as HTMLInputElement).id),
    );
  }

  /**
   * The visible label text associated with a checkbox, via its `for`
   * attribute.
   *
   * VALIDATED - each checkbox is labelled by a sibling
   * `<label for="<id>"><span class="padded">...</span></label>`, confirmed
   * live 2026-09-14.
   */
  async labelTextFor(checkboxId: string): Promise<string> {
    await this.expectOpen();
    const text = await this.dialog.evaluate((el, id) => {
      const label = el.querySelector(`label[for="${id}"]`);
      return label ? (label as HTMLElement).innerText : null;
    }, checkboxId);

    expect(text, `No <label for="${checkboxId}"> found in the Verify Paper Out modal`).not.toBeNull();
    return (text ?? '').replace(/\s+/g, ' ').trim();
  }

  /** The label text of whichever checkbox the modal renders last. */
  async lastCheckboxLabelText(): Promise<string> {
    const ids = await this.checkboxIdsInOrder();
    expect(ids.length, 'The Verify Paper Out modal presented no checkboxes').toBeGreaterThan(0);
    return this.labelTextFor(ids[ids.length - 1]);
  }

  // VALIDATED - the modal's "document" package link renders as
  // `a[href*="getPrintableDocumentContents.eo?batch.id=...&printableDocumentType=document"]`.
  // Clicking it is a plain GET download, so it is exactly as safe as the
  // checkbox reads above - it never checks a box and never presses Verify.
  // Confirmed live against qa5 on 2026-09-14 for the PROBE-TS003-CHECK
  // fixture (batch id 366823): the downloaded PDF is a multi-page bundle
  // whose text contains both
  // "Submitted Paper Out Batch Name=PROBE-TS003-CHECK, ID=366823, Media
  // Type=electronic" and, further down,
  // "Authorized Paper Out Batch Name=PROBE-TS003-CHECK, Verifier=..." with no
  // Media Type segment at all. This is the one surface AC-EC-12000-016 needs
  // that does not require navigating back through a Collection - the
  // Authorized fixture this reads is reached read-only from the Work Queue,
  // the same way TS-EC-12000-018 already does.
  private get documentPackageLink(): Locator {
    return this.dialog.locator('a[href*="printableDocumentType=document"]');
  }

  /**
   * Downloads the Paper Out package's "document" PDF and returns its
   * extracted text.
   *
   * AC-EC-12000-016 asks about three things - the Submitted event's
   * Additional Information, the Authorized event's Additional Information,
   * and the downloaded activity history report - and this single download
   * turns out to answer all three: the package bundles the same Transaction/
   * Document Activity History Report pages the Document History dialog
   * reads, alongside the cover page. The caller inspects the one returned
   * string for each of the three assertions rather than taking three
   * separate readings, because there is only one artifact to read from.
   */
  async downloadDocumentActivityReportText(): Promise<string> {
    await this.expectOpen();
    const downloadPromise = this.page.waitForEvent('download', { timeout: 20_000 });
    await this.documentPackageLink.click();
    const download = await downloadPromise;
    const stream = await download.createReadStream();
    if (stream === null) {
      throw new Error('The Paper Out package download produced no readable stream.');
    }
    return extractPdfText(await this.readableToBuffer(stream));
  }

  private async readableToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * The Media Type recorded on the downloaded report's "Submitted Paper Out"
   * line.
   *
   * Matches the same "Batch Name=..., ID=..., Media Type=..." payload format
   * as the Document History dialog's `data-extra-data` attribute (see
   * DocumentHistoryComponent) - the package bundles the identical activity
   * history report, just rendered to PDF instead of to a dialog. Only the
   * first matching line is read: a dedicated fixture like
   * PROBE-TS003-CHECK carries exactly one Submitted event, and reading the
   * first occurrence is what a reviewer opening the same PDF would see first
   * too.
   */
  mediaTypeFromSubmittedLine(reportText: string): string {
    const match = reportText.match(/Submitted Paper Out Batch Name=[^\r\n]*?Media Type=([^\r\n,]+)/i);
    if (match === null) {
      throw new Error(
        'No "Submitted Paper Out" line carrying a Media Type was found in the downloaded report. It reads: ' +
          `"${reportText.slice(0, 500)}..."`,
      );
    }
    return match[1].trim();
  }

  /**
   * Whether the downloaded report's "Authorized Paper Out" line records any
   * Media Type segment at all.
   *
   * AC-EC-12000-016 is partly about absence, and absence must be
   * distinguishable from "could not read it" - hence the explicit check that
   * an Authorized Paper Out line exists at all before reporting on what it
   * does or does not carry.
   */
  authorizedLineRecordsMediaType(reportText: string): boolean {
    const match = reportText.match(/Authorized Paper Out Batch Name=[^\r\n]+/i);
    if (match === null) {
      throw new Error(
        'No "Authorized Paper Out" line was found in the downloaded report. It reads: ' +
          `"${reportText.slice(0, 500)}..."`,
      );
    }
    return /Media Type=/i.test(match[0]);
  }
}

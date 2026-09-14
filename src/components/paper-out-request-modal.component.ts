import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const MEDIA_TYPE_SECTION_HEADING = 'Media Type for Paper Out® Package';
const PRINT_TO_PAPER = 'Print to Paper';
// VALIDATED - the radio's accessible name is NOT the same at every level the
// modal opens from, which is a trap worth stating plainly. Opened from a
// collection it reads "Save as Electronic"; opened from a transaction or a
// document it reads "Save as Electronic File". Both confirmed live against
// qa5 - the collection form on 2026-09-11, the transaction form on
// 2026-09-14, when an exact match on the collection wording failed to find
// the transaction-level radio at all.
//
// "Save as Electronic" is therefore matched as a prefix rather than exactly.
// The looser match is safe and was measured, not assumed: at both levels it
// resolves to exactly one radio, because the only other option is "Print to
// Paper". An exact match cannot serve both, and hard-coding one wording per
// call site would leave the same bug waiting at whichever level was written
// second.
const SAVE_AS_ELECTRONIC_FILE = 'Save as Electronic';

/**
 * The Paper Out® Request modal.
 *
 * Confirmed identical (same title, same Media Type section, same two radios,
 * same OK/Cancel) regardless of entry point - collection, transaction or
 * document level - live against qa5 on 2026-09-11
 * (features/generated/paper-out-export/TP-EC-12000-001-automation-design.md).
 * One component therefore models all three, matching AMB-EC-12000-001's
 * resolution: it owns only its own locators, never the navigation that opened
 * it.
 */
export class PaperOutRequestModalComponent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // VALIDATED - confirmed live 2026-09-11 at collection, transaction and
  // document level.
  private get dialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Paper Out® Request' });
  }

  private get mediaTypeSectionHeading(): Locator {
    return this.dialog.getByText(MEDIA_TYPE_SECTION_HEADING);
  }

  private get printToPaperRadio(): Locator {
    return this.dialog.getByRole('radio', { name: PRINT_TO_PAPER });
  }

  private get saveAsElectronicFileRadio(): Locator {
    return this.dialog.getByRole('radio', { name: SAVE_AS_ELECTRONIC_FILE });
  }

  // VALIDATED - form field name (verifyRequestPaperOutCollection.eo response)
  // is `batchName`; the accessible label is "Name of Request:". Confirmed live
  // 2026-09-11.
  private get nameOfRequestField(): Locator {
    return this.dialog.getByRole('textbox', { name: 'Name of Request:' });
  }

  // VALIDATED - form field name is `approverUserGuid`; the accessible label is
  // "Approver:". Options are real users configured in the organization, never
  // fabricated here. Confirmed live 2026-09-11.
  private get approverField(): Locator {
    return this.dialog.getByRole('combobox', { name: 'Approver:' });
  }

  private get okButton(): Locator {
    return this.dialog.getByRole('button', { name: 'OK' });
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  async expectMediaTypeSectionShown(): Promise<void> {
    await expect(this.mediaTypeSectionHeading).toBeVisible();
  }

  async expectPrintToPaperSelectedByDefault(): Promise<void> {
    await expect(this.printToPaperRadio).toBeChecked();
  }

  async selectSaveAsElectronicFile(): Promise<void> {
    await this.saveAsElectronicFileRadio.check();
  }

  /**
   * Selects "Print to Paper".
   *
   * It is already selected by default (TS-EC-12000-001 asserts exactly that),
   * so `check()` is usually a no-op. It is still made explicitly rather than
   * relied upon: TS-EC-12000-007 exists to prove that choosing Print to Paper
   * records Media Type Paper, and a scenario that never made the choice would
   * be proving only that the default happens to be recorded. `check()` is a
   * no-op on an already-checked radio, so this is safe in either state.
   */
  async selectPrintToPaper(): Promise<void> {
    await this.printToPaperRadio.check();
  }

  /**
   * Fills the two fields the modal requires before OK will proceed
   * (AMB-EC-12000-003 resolution). Name of Request is a fabricated value from
   * test-data/paper-out-export.sample.json; the Approver is selected from the
   * real, organization-configured options the combobox already offers -
   * never a name invented here.
   *
   * The combobox's own first `<option>` is always the placeholder
   * "-- Select User --", which carries an empty `value` (confirmed live
   * 2026-09-11 and again 2026-09-14). Selecting it submits no approver and
   * the application rejects with "Approver is required." The real users are
   * therefore identified by having a non-empty, non-disabled value rather
   * than by their position in the list - a positional pick would silently
   * choose the wrong user the moment the organization's user list changes.
   */
  async completeRequiredFields(nameOfRequest: string): Promise<void> {
    await this.nameOfRequestField.fill(nameOfRequest);

    // The Approver list is populated by the same AJAX response that renders
    // the modal body, so it can still be placeholder-only on first paint.
    await expect(async () => {
      expect(await this.selectableApproverValues()).not.toHaveLength(0);
    }).toPass({ timeout: 20_000 });

    const [firstSelectableApprover] = await this.selectableApproverValues();
    await this.approverField.selectOption(firstSelectableApprover);
  }

  /**
   * The option values that identify a real, selectable organization user.
   *
   * Reads the live `<select>` rather than matching on label text: approver
   * names are real organization data and must never be hard-coded here.
   */
  private async selectableApproverValues(): Promise<string[]> {
    return this.approverField.evaluate((select) =>
      Array.from((select as HTMLSelectElement).options)
        .filter((option) => option.value.trim() !== '' && !option.disabled)
        .map((option) => option.value),
    );
  }

  async clickOk(): Promise<void> {
    await this.okButton.click();
  }

  /**
   * Reads back the currently entered Name of Request, so a scenario can prove
   * field values were retained (TS-EC-12000-004) without depending on a
   * screenshot.
   */
  async currentNameOfRequest(): Promise<string> {
    return this.nameOfRequestField.inputValue();
  }
}

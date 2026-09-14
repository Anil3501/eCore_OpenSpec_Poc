import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * The Acknowledgement modal.
 *
 * Opens from the Paper Out® Request modal only when "Save as Electronic File"
 * is selected and its required fields are completed (AC-EC-12000-002). Its
 * checkbox gates the OK button (AC-EC-12000-003); Cancel closes only this
 * dialog, leaving the Paper Out Request modal open with its values retained
 * and no submission side effect (AC-EC-12000-004). Confirmed live against
 * qa5 on 2026-09-11
 * (features/generated/paper-out-export/TP-EC-12000-001-automation-design.md).
 */
export class AcknowledgementModalComponent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private get dialog(): Locator {
    return this.page.getByRole('dialog', { name: 'Acknowledgement' });
  }

  // VALIDATED - the checkbox carries no accessible name beyond its own label
  // text (a full legal notice), so the stable handle is its element id,
  // `#mediaTypeElectronicConfirmCheckbox`. Confirmed live 2026-09-11.
  private get checkbox(): Locator {
    return this.dialog.locator('#mediaTypeElectronicConfirmCheckbox');
  }

  private get okButton(): Locator {
    return this.dialog.getByRole('button', { name: 'OK' });
  }

  private get cancelButton(): Locator {
    return this.dialog.getByRole('button', { name: 'Cancel' });
  }

  async expectOpen(): Promise<void> {
    await expect(this.dialog).toBeVisible();
  }

  async expectClosed(): Promise<void> {
    await expect(this.dialog).toBeHidden();
  }

  async expectCheckboxUnchecked(): Promise<void> {
    await expect(this.checkbox).not.toBeChecked();
  }

  async expectOkDisabled(): Promise<void> {
    await expect(this.okButton).toBeDisabled();
  }

  async expectOkEnabled(): Promise<void> {
    await expect(this.okButton).toBeEnabled();
  }

  async checkAcknowledgement(): Promise<void> {
    await this.checkbox.check();
  }

  async clickOk(): Promise<void> {
    await this.okButton.click();
  }

  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
  }
}

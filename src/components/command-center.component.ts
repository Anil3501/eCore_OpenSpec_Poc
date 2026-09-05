import type { Locator, Page } from '@playwright/test';

/**
 * The Command Center control in the shared banner.
 *
 * It lives in the banner, which is rendered on every module page, so it belongs
 * to a component rather than to the Home page: TS-ETA-411-006 activates it from
 * five different modules.
 *
 * There is no `expectArrived` here on purpose. Where the control leads is the
 * assertion the scenario makes, through EcoreHomePage. A component that both
 * performed the action and judged its own outcome would let the control appear
 * to work simply because this class said so.
 */
export class CommandCenterComponent {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // VALIDATED - the Command Center control is a styled div with a CSS
  // background image. It exposes no text, no alt text, no title, no aria-label
  // and no role, so no accessible locator can reach it. Observed on qa5 on
  // 2026-09-05 as div#bannerBackground.clickable and confirmed to return the
  // browser to welcome.eo from all five modules - see
  // reports/validation/TP-ETA-411-001-browser-validation.json.
  //
  // The missing accessible name is a property of the application, not of this
  // locator. It was raised at Gate 3 as an open question and has NOT been filed
  // as a defect; this waiver records how the element is reached and is not a
  // finding that its inaccessibility is acceptable.
  private get control(): Locator {
    return this.page.locator('#bannerBackground');
  }

  async activate(): Promise<void> {
    await this.control.click();
  }
}

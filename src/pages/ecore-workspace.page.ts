import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

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
}

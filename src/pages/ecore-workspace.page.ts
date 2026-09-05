import type { Page } from '@playwright/test';
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
}

/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/tp-eta-411-001-content-probe.ts
 *
 * TS-ETA-411-005 says arrival at Organization and Vault is asserted on page CONTENT,
 * never on the address, because Organization and the Preferences dashboard icon share
 * the address /ssweb/setup/prefs/preferences.eo.
 *
 * That instruction is only satisfiable if the two pages actually differ. This probe finds
 * out, and it uses the ARIA role engine rather than a querySelector over h1/h2/h3/legend/
 * caption. src/pages/ecore-workspace.page.ts records what happened the last time that
 * shortcut was taken: a <legend> was mistaken for a heading, an assertion was written on
 * it, and three scenarios failed.
 *
 * Observation only. If the two pages prove indistinguishable, that is recorded as a
 * mismatch against the approved design for a human to settle - not quietly downgraded to
 * a URL assertion.
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/utils/env.ts';

const REPORT_PATH = 'reports/validation/TP-ETA-411-001-content-probe.json';

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
}

async function signIn(page: Page): Promise<void> {
  const login = env.requireEcoreLogin();
  await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await settle(page);
  const form = page.locator('#eo_cc_login');
  await form.locator('#loginType').selectOption({ label: 'Organization Login' });
  await form
    .getByRole('textbox', { name: 'Organization Name' })
    .waitFor({ state: 'visible', timeout: 15_000 });
  await form.getByRole('textbox', { name: 'Username' }).fill(login.username);
  await form.getByRole('textbox', { name: 'Organization Name' }).fill(login.organization);
  await form.getByPlaceholder('Password').fill(login.password);
  await form.getByRole('button', { name: 'Sign In' }).click();
  await page
    .getByRole('link', { name: 'Logout', exact: true })
    .waitFor({ state: 'visible', timeout: 60_000 });
  await settle(page);
}

/** Only what the accessibility tree actually exposes, and only if it is visible. */
async function accessibleSnapshot(page: Page): Promise<Record<string, unknown>> {
  const headings = page.getByRole('heading');
  const visibleHeadings: string[] = [];
  const count = await headings.count();
  for (let index = 0; index < count; index += 1) {
    const heading = headings.nth(index);
    if (await heading.isVisible().catch(() => false)) {
      const text = ((await heading.textContent()) || '').replace(/\s+/g, ' ').trim();
      if (text) visibleHeadings.push(text);
    }
  }

  const tabs = page.getByRole('tab');
  const visibleTabs: string[] = [];
  const tabCount = await tabs.count();
  for (let index = 0; index < tabCount; index += 1) {
    const tab = tabs.nth(index);
    if (await tab.isVisible().catch(() => false)) {
      const text = ((await tab.textContent()) || '').replace(/\s+/g, ' ').trim();
      if (text) visibleTabs.push(text);
    }
  }

  return {
    url: page.url(),
    title: await page.title(),
    visibleHeadings,
    visibleTabs,
    // The main region minus the shared banner, so the comparison is not swamped
    // by chrome that every page renders.
    mainVisibleText: await page.evaluate(() => {
      const banner = document.querySelector('#banner');
      const clone = document.body.cloneNode(true) as HTMLElement;
      if (banner) clone.querySelector('#banner')?.remove();
      return (clone.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
    }),
  };
}

async function main(): Promise<void> {
  const findings: Record<string, unknown> = {
    probe: 'TP-ETA-411-001-content-probe',
    story: 'ETA-411',
    testPlanId: 'TP-ETA-411-001',
    stage: 'PLAYWRIGHT_VALIDATION',
    question:
      'Can arrival at Organization be told apart from arrival at Preferences by page content, ' +
      'as TS-ETA-411-005 requires, given both share /ssweb/setup/prefs/preferences.eo?',
    evidenceSource:
      'Scripted Playwright using the ARIA role engine. Headings are read via getByRole(heading) ' +
      'and filtered by visibility, never via a querySelector over h1/h2/h3/legend/caption.',
    startedAt: new Date().toISOString(),
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await signIn(page);
    const homeUrl = page.url();

    await page.locator('#icon-buttons').getByRole('link', { name: 'Preferences', exact: true }).click();
    await settle(page);
    findings.viaPreferencesIcon = await accessibleSnapshot(page);

    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await settle(page);
    await page.locator('li.section:has([id="header.preferences.org"])').first().hover();
    await page.locator('[id="header.preferences.org"]').click();
    await settle(page);
    findings.viaOrganizationMenu = await accessibleSnapshot(page);

    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await settle(page);
    await page.locator('li.section:has([id="header.preferences.vault"])').first().hover();
    await page.locator('[id="header.preferences.vault"]').click();
    await settle(page);
    findings.viaVaultMenu = await accessibleSnapshot(page);

    const a = findings.viaPreferencesIcon as Record<string, unknown>;
    const b = findings.viaOrganizationMenu as Record<string, unknown>;
    findings.comparison = {
      sameUrl: a.url === b.url,
      sameHeadings: JSON.stringify(a.visibleHeadings) === JSON.stringify(b.visibleHeadings),
      sameMainText: a.mainVisibleText === b.mainVisibleText,
    };
  } catch (error) {
    findings.fatalError = error instanceof Error ? error.message.slice(0, 600) : String(error);
  } finally {
    findings.finishedAt = new Date().toISOString();
    await context.close();
    await browser.close();
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${REPORT_PATH}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-351-message-probe.ts
 *
 * Identifies the DOM container that carries the validation and failure
 * messages, so page objects can address them with an accessible locator
 * instead of a guessed selector. Fabricated values only.
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';

async function openOrganizationForm(page: Page): Promise<void> {
  await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await page.locator('#loginType').selectOption({ label: 'Organization Login' });
  await page.locator('#orgName').waitFor({ state: 'visible', timeout: 15_000 });
}

async function describeMessages(page: Page, needle: string): Promise<unknown> {
  return page.evaluate((text) => {
    const out: { tag: string; id: string | null; className: string; role: string | null; html: string }[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.textContent || !node.textContent.includes(text)) continue;
      const el = node.parentElement;
      if (!el || seen.has(el)) continue;
      seen.add(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: el.className ? String(el.className) : '',
        role: el.getAttribute('role'),
        html: el.outerHTML.slice(0, 400),
      });
      const parent = el.parentElement;
      if (parent && !seen.has(parent)) {
        seen.add(parent);
        out.push({
          tag: parent.tagName.toLowerCase() + ' (parent)',
          id: parent.id || null,
          className: parent.className ? String(parent.className) : '',
          role: parent.getAttribute('role'),
          html: parent.outerHTML.slice(0, 500),
        });
      }
    }
    return out;
  }, needle);
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const findings: Record<string, unknown> = { probe: 'ETA-351-messages', startedAt: new Date().toISOString() };

  try {
    await openOrganizationForm(page);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    findings.missingDetailsContainers = await describeMessages(page, 'is required');

    await openOrganizationForm(page);
    await page.locator('#userName').fill('qa.fabricated.user.eta351');
    await page.locator('#orgName').fill('FABRICATED-ORG-DOES-NOT-EXIST');
    await page.locator('#password').fill('Fabricated!Passw0rd!eta351');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
    findings.wrongDetailsContainers = await describeMessages(page, 'login attempt failed');
    findings.status = 'OBSERVED';
  } catch (error) {
    findings.status = 'FAILED';
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  const out = path.join(REPORT_DIR, 'ETA-351-message-probe.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2) + '\n', 'utf8');
  console.log('status: ' + findings.status);
  console.log('\n--- missing details ---');
  console.log(JSON.stringify(findings.missingDetailsContainers, null, 2).slice(0, 2500));
  console.log('\n--- wrong details ---');
  console.log(JSON.stringify(findings.wrongDetailsContainers, null, 2).slice(0, 2000));
  console.log('\nreport -> ' + out);
}

await main();

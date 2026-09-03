/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-351-missing-probe.ts
 *
 * Focused probe for AMB-ETA-351-003 / AC-ETA-351-007.
 *
 * The behaviour probe found no message after submitting with every field empty.
 * That is either a real gap or a probe that looked in the wrong places. This
 * script therefore compares the WHOLE page before and after submission instead
 * of relying on a selector list, and tries several omission shapes.
 *
 * Every value used is fabricated. No real credential is read.
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';
const FABRICATED = {
  username: 'qa.fabricated.user.eta351',
  organization: 'FABRICATED-ORG-DOES-NOT-EXIST',
  password: 'Fabricated!Passw0rd!eta351',
};

interface Snapshot {
  url: string;
  bodyText: string;
  htmlLength: number;
}

async function snapshot(page: Page): Promise<Snapshot> {
  return {
    url: page.url(),
    bodyText: (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim(),
    htmlLength: (await page.content()).length,
  };
}

async function openOrganizationForm(page: Page): Promise<void> {
  await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await page.locator('#loginType').selectOption({ label: 'Organization Login' });
  await page.locator('#orgName').waitFor({ state: 'visible', timeout: 15_000 });
}

interface CaseResult {
  name: string;
  filled: Record<string, string>;
  before: Snapshot;
  after: Snapshot;
  navigated: boolean;
  textChanged: boolean;
  newText: string;
  htmlValidationBlocked: boolean;
}

async function runCase(
  page: Page,
  name: string,
  fills: Record<string, string>,
): Promise<CaseResult> {
  await openOrganizationForm(page);
  for (const [id, value] of Object.entries(fills)) {
    await page.locator('#' + id).fill(value);
  }
  const before = await snapshot(page);

  // Does the browser's own constraint validation block submission?
  const htmlValidationBlocked = await page.evaluate(() => {
    const form = document.querySelector('form');
    if (!form) return false;
    return typeof form.checkValidity === 'function' ? !form.checkValidity() : false;
  });

  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
  const after = await snapshot(page);

  const newText = after.bodyText.startsWith(before.bodyText)
    ? after.bodyText.slice(before.bodyText.length).trim()
    : after.bodyText === before.bodyText
      ? ''
      : after.bodyText;

  return {
    name,
    filled: Object.fromEntries(Object.keys(fills).map((k) => [k, k === 'password' ? '(fabricated secret)' : fills[k]])),
    before,
    after,
    navigated: before.url !== after.url,
    textChanged: before.bodyText !== after.bodyText,
    newText: newText.slice(0, 600),
    htmlValidationBlocked,
  };
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const results: CaseResult[] = [];
  const findings: Record<string, unknown> = {
    probe: 'ETA-351-missing-details',
    purpose: 'Determine whether omitting required details produces any observable response.',
    startedAt: new Date().toISOString(),
  };

  try {
    results.push(await runCase(page, 'all fields empty', {}));
    results.push(await runCase(page, 'only password omitted', {
      userName: FABRICATED.username,
      orgName: FABRICATED.organization,
    }));
    results.push(await runCase(page, 'only organization omitted', {
      userName: FABRICATED.username,
      password: FABRICATED.password,
    }));
    results.push(await runCase(page, 'all fields present but wrong (control case)', {
      userName: FABRICATED.username,
      orgName: FABRICATED.organization,
      password: FABRICATED.password,
    }));
    findings.status = 'OBSERVED';
  } catch (error) {
    findings.status = 'FAILED';
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  findings.cases = results;
  const out = path.join(REPORT_DIR, 'ETA-351-missing-details-probe.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2) + '\n', 'utf8');

  console.log('status: ' + findings.status);
  if (findings.error) console.log('error : ' + findings.error);
  for (const r of results) {
    console.log('\n=== ' + r.name + ' ===');
    console.log('  fields filled        : ' + JSON.stringify(r.filled));
    console.log('  browser blocked submit: ' + r.htmlValidationBlocked);
    console.log('  navigated            : ' + r.navigated);
    console.log('  page text changed    : ' + r.textChanged);
    console.log('  new text             : ' + (r.newText || '(none)'));
  }
  console.log('\nreport -> ' + out);
}

await main();

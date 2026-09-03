/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-351-form-probe.ts
 *
 * The login page hosts more than one form (the sign-in form and a hidden
 * forgot-password form) and they share field names, so an unscoped
 * `getByLabel('Username')` is a strict-mode violation. This probe maps every
 * form and its controls so page-object locators can be scoped correctly.
 *
 * Read-only. Nothing is submitted and no credential is used.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const findings: Record<string, unknown> = {
    probe: 'ETA-351-forms',
    startedAt: new Date().toISOString(),
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 });
    await page.locator('#loginType').selectOption({ label: 'Organization Login' });
    await page.locator('#orgName').waitFor({ state: 'visible', timeout: 15_000 });

    findings.forms = await page.evaluate(() =>
      Array.from(document.querySelectorAll('form')).map((form) => ({
        id: form.id || null,
        name: form.getAttribute('name'),
        action: form.getAttribute('action'),
        className: String(form.className || ''),
        visible: !!(form as HTMLElement).offsetParent || form.getClientRects().length > 0,
        controls: Array.from(form.querySelectorAll('input, select, textarea, button')).map((el) => {
          const input = el as HTMLInputElement;
          return {
            tag: el.tagName.toLowerCase(),
            type: input.type || null,
            id: el.id || null,
            name: input.name || null,
            placeholder: input.placeholder || null,
            value: input.type === 'submit' ? input.value : null,
            visible: !!(el as HTMLElement).offsetParent || el.getClientRects().length > 0,
          };
        }),
      })),
    );

    findings.duplicateNamesAcrossForms = await page.evaluate(() => {
      const counts: Record<string, number> = {};
      document.querySelectorAll('input').forEach((el) => {
        const key = (el as HTMLInputElement).placeholder || (el as HTMLInputElement).name || '';
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      return Object.fromEntries(Object.entries(counts).filter(([, n]) => n > 1));
    });

    findings.status = 'OBSERVED';
  } catch (error) {
    findings.status = 'FAILED';
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  const out = path.join(REPORT_DIR, 'ETA-351-form-probe.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2) + '\n', 'utf8');
  console.log('status: ' + findings.status);
  if (findings.error) console.log('error : ' + findings.error);
  console.log(JSON.stringify(findings.forms, null, 2));
  console.log('\nduplicate field identifiers: ' + JSON.stringify(findings.duplicateNamesAcrossForms));
  console.log('\nreport -> ' + out);
}

await main();

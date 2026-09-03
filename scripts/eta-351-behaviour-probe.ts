/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-351-behaviour-probe.ts
 *
 * PLAYWRIGHT_VALIDATION behaviour probe for ETA-351.
 *
 * Phase A  selects Organization Login and records the resulting field set
 *          (AMB-ETA-351-001, AMB-ETA-351-005).
 * Phase B  submits with required details left out and records the response.
 * Phase C  submits complete but fabricated details and records the response.
 *          Comparing B and C answers AMB-ETA-351-003.
 *
 * SAFETY: every value submitted here is fabricated and cannot belong to a real
 * account. The real credential is never read by this script. The login page
 * warns that an account can lock after repeated incorrect attempts, so a real
 * username must never reach a failing submission.
 *
 * Output: reports/validation/ETA-351-behaviour-probe.json plus screenshots.
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';

// Deliberately impossible values. Not derived from configuration.
const FABRICATED = {
  username: 'qa.fabricated.user.eta351',
  organization: 'FABRICATED-ORG-DOES-NOT-EXIST',
  password: 'Fabricated!Passw0rd!eta351',
};

interface ControlRecord {
  tag: string;
  type: string | null;
  id: string | null;
  visible: boolean;
  accessibleName: string | null;
  required: boolean;
}

async function readControls(page: Page): Promise<ControlRecord[]> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('input, select, textarea'));
    return nodes.map((node) => {
      const el = node as HTMLElement;
      const input = node as HTMLInputElement;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      let label: string | null = null;
      if (input.id) {
        const forLabel = document.querySelector('label[for="' + CSS.escape(input.id) + '"]');
        if (forLabel) label = (forLabel.textContent ?? '').trim();
      }
      if (!label) label = el.getAttribute('aria-label');
      if (!label) label = input.placeholder || null;
      return {
        tag: el.tagName.toLowerCase(),
        type: input.type ?? null,
        id: el.id || null,
        visible:
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0,
        accessibleName: label ? label.replace(/\s+/g, ' ').slice(0, 120) : null,
        required: input.required === true || el.getAttribute('aria-required') === 'true',
      };
    });
  });
}

/** Anything the page shows that could constitute "being told what happened". */
async function readSignals(page: Page): Promise<Record<string, unknown>> {
  const messages = await page.evaluate(() => {
    const selectors = [
      '.error', '.errors', '.alert', '.message', '.messages',
      '[role="alert"]', '.field-error', '.validation-summary-errors', '.errorMessage',
    ];
    const found: { selector: string; id: string | null; text: string }[] = [];
    for (const selector of selectors) {
      for (const node of Array.from(document.querySelectorAll(selector))) {
        const el = node as HTMLElement;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const visible =
          style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0;
        const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (visible && text.length > 0) {
          found.push({ selector, id: el.id || null, text: text.slice(0, 300) });
        }
      }
    }
    return found;
  });

  const validationMessages = await page.evaluate(() => {
    const out: { id: string; message: string }[] = [];
    for (const node of Array.from(document.querySelectorAll('input, select'))) {
      const el = node as HTMLInputElement;
      if (el.validationMessage) out.push({ id: el.id || '(no id)', message: el.validationMessage });
    }
    return out;
  });

  return {
    url: page.url(),
    domMessages: messages,
    browserValidationMessages: validationMessages,
  };
}

async function chooseOrganization(page: Page): Promise<void> {
  await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForLoadState('networkidle', { timeout: 60_000 });
  await page.locator('#loginType').selectOption({ label: 'Organization Login' });
  await page.waitForTimeout(500); // JUSTIFIED-WAIT: probe only, observing an unspecified client-side reaction.
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const findings: Record<string, unknown> = {
    probe: 'ETA-351-behaviour',
    purpose: 'PLAYWRIGHT_VALIDATION. All submitted values are fabricated; no real credential is read.',
    startedAt: new Date().toISOString(),
    fabricatedValuesUsed: Object.keys(FABRICATED),
  };

  try {
    // Phase A - field set after choosing Organization Login.
    await chooseOrganization(page);
    const afterChoice = await readControls(page);
    findings.phaseA_organizationFieldSet = afterChoice.filter((c) => c.visible);
    await page.screenshot({ path: path.join(REPORT_DIR, 'ETA-351-organization-selected.png'), fullPage: true });

    // Phase B - submit with everything left out.
    // Two submit inputs exist ("Sign In" and "Submit"); address the one by accessible name.
    await chooseOrganization(page);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
    findings.phaseB_missingDetails = await readSignals(page);
    await page.screenshot({ path: path.join(REPORT_DIR, 'ETA-351-missing-details.png'), fullPage: true });

    // Phase C - submit complete but fabricated (wrong) details.
    await chooseOrganization(page);
    const visibleTextInputs = (await readControls(page)).filter(
      (c) => c.visible && c.tag === 'input' && (c.type === 'text' || c.type === 'password'),
    );
    for (const control of visibleTextInputs) {
      if (!control.id) continue;
      const value =
        control.type === 'password'
          ? FABRICATED.password
          : control.id.toLowerCase().includes('user')
            ? FABRICATED.username
            : FABRICATED.organization;
      await page.locator('#' + control.id).fill(value);
    }
    findings.phaseC_fieldsFilled = visibleTextInputs.map((c) => c.id);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
    findings.phaseC_wrongDetails = await readSignals(page);
    await page.screenshot({ path: path.join(REPORT_DIR, 'ETA-351-wrong-details.png'), fullPage: true });

    const b = JSON.stringify((findings.phaseB_missingDetails as Record<string, unknown>).domMessages);
    const c = JSON.stringify((findings.phaseC_wrongDetails as Record<string, unknown>).domMessages);
    findings.responsesDiffer = b !== c;
    findings.status = 'OBSERVED';
  } catch (error) {
    findings.status = 'FAILED';
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  const out = path.join(REPORT_DIR, 'ETA-351-behaviour-probe.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2) + '\n', 'utf8');

  console.log('status: ' + findings.status);
  if (findings.error) console.log('error : ' + findings.error);
  console.log('\n--- Phase A: fields after choosing Organization Login ---');
  for (const c of (findings.phaseA_organizationFieldSet as ControlRecord[] | undefined) ?? []) {
    console.log('  ' + c.tag + '[' + (c.type ?? '') + '] id=' + (c.id ?? '-') + ' label=' + (c.accessibleName ?? '-') + (c.required ? ' REQUIRED' : ''));
  }
  console.log('\n--- Phase B: missing details ---');
  console.log(JSON.stringify(findings.phaseB_missingDetails, null, 2));
  console.log('\n--- Phase C: wrong details ---');
  console.log('filled: ' + JSON.stringify(findings.phaseC_fieldsFilled));
  console.log(JSON.stringify(findings.phaseC_wrongDetails, null, 2));
  console.log('\nresponses differ: ' + findings.responsesDiffer);
  console.log('report -> ' + out);
}

await main();

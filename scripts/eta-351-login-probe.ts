/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-351-login-probe.ts
 *
 * PLAYWRIGHT_VALIDATION probe for ETA-351.
 *
 * Opens the real eCore Command Center login page and records what is actually
 * there. It answers the observable ambiguities recorded against ETA-351:
 *   AMB-ETA-351-001  what the organization sign-in field set is
 *   AMB-ETA-351-002  how the sign-in kind is declared
 *   AMB-ETA-351-005  which details are mandatory (structurally, at least)
 *
 * It submits nothing and supplies no credential. AMB-ETA-351-003 needs failing
 * submissions and is handled by a separate probe so that this one can never
 * touch an account.
 *
 * Output: reports/validation/ETA-351-login-page-probe.json plus a screenshot.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/utils/env.ts';

interface ControlRecord {
  tag: string;
  type: string | null;
  id: string | null;
  name: string | null;
  visible: boolean;
  accessibleName: string | null;
  role: string | null;
  required: boolean;
  options: string[] | null;
}

const REPORT_DIR = 'reports/validation';

async function main(): Promise<void> {
  const baseUrl = env.requireBaseUrl();
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const findings: Record<string, unknown> = {
    probe: 'ETA-351-login-page',
    purpose: 'PLAYWRIGHT_VALIDATION observation. No credential supplied, nothing submitted.',
    startedAt: new Date().toISOString(),
    requestedUrl: baseUrl,
  };

  try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    // The configured URL is a capability-detection interstitial that redirects.
    await page.waitForLoadState('networkidle', { timeout: 60_000 });

    findings.finalUrl = page.url();
    findings.title = await page.title();
    findings.redirected = page.url() !== baseUrl;

    const controls: ControlRecord[] = await page.evaluate(() => {
      const nodes = Array.from(
        document.querySelectorAll('input, select, textarea, button, a[href]'),
      );
      return nodes.map((node) => {
        const el = node as HTMLElement;
        const input = node as HTMLInputElement;
        const select = node as HTMLSelectElement;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        let label: string | null = null;
        if (input.id) {
          const forLabel = document.querySelector('label[for="' + CSS.escape(input.id) + '"]');
          if (forLabel) label = (forLabel.textContent ?? '').trim();
        }
        if (!label) {
          const wrapping = el.closest('label');
          if (wrapping) label = (wrapping.textContent ?? '').trim();
        }
        if (!label) label = el.getAttribute('aria-label');
        if (!label && el.tagName === 'BUTTON') label = (el.textContent ?? '').trim();
        if (!label && el.tagName === 'A') label = (el.textContent ?? '').trim();
        if (!label) label = input.placeholder || input.value || null;

        return {
          tag: el.tagName.toLowerCase(),
          type: input.type ?? null,
          id: el.id || null,
          name: input.name || null,
          visible:
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            rect.width > 0 &&
            rect.height > 0,
          accessibleName: label ? label.replace(/\s+/g, ' ').slice(0, 120) : null,
          role: el.getAttribute('role'),
          required: input.required === true || el.getAttribute('aria-required') === 'true',
          options:
            el.tagName === 'SELECT'
              ? Array.from(select.options).map((o) => (o.textContent ?? '').trim())
              : null,
        };
      });
    });

    findings.controls = controls;
    findings.visibleControls = controls.filter((c) => c.visible);

    const bodyText = await page.locator('body').innerText();
    findings.pageText = bodyText.replace(/\s+/g, ' ').slice(0, 3000);

    const shot = path.join(REPORT_DIR, 'ETA-351-login-page.png');
    await page.screenshot({ path: shot, fullPage: true });
    findings.screenshot = shot;
    findings.status = 'OBSERVED';
  } catch (error) {
    findings.status = 'FAILED';
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  const out = path.join(REPORT_DIR, 'ETA-351-login-page-probe.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2) + '\n', 'utf8');

  console.log('status      : ' + findings.status);
  console.log('final url   : ' + (findings.finalUrl ?? 'n/a'));
  console.log('page title  : ' + (findings.title ?? 'n/a'));
  const visible = (findings.visibleControls as ControlRecord[] | undefined) ?? [];
  console.log('visible controls: ' + visible.length);
  for (const c of visible) {
    const opts = c.options ? ' options=[' + c.options.join(' | ') + ']' : '';
    console.log(
      '  ' + c.tag + (c.type ? '[' + c.type + ']' : '') +
      ' id=' + (c.id ?? '-') +
      ' name=' + (c.name ?? '-') +
      ' label=' + (c.accessibleName ?? '-') +
      (c.required ? ' REQUIRED' : '') +
      opts,
    );
  }
  console.log('report -> ' + out);
}

await main();

/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-351-home-probe.ts
 *
 * Observes what the Home page looks like after a SUCCESSFUL organization
 * sign-in, so `src/pages/ecore-home.page.ts` asserts on something real rather
 * than on a guessed heading.
 *
 * This is the one probe that uses the real account. That is deliberate and
 * safe: the lockout counter is driven by FAILED attempts, and this script
 * makes exactly one attempt with correct details. It prints no credential.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const login = env.requireEcoreLogin();
  const findings: Record<string, unknown> = {
    probe: 'ETA-351-home-page',
    startedAt: new Date().toISOString(),
    note: 'Single successful sign-in. No credential value is recorded in this file.',
    configuredLoginType: login.loginType,
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 });

    // The page hosts a second, hidden forgot-password form that duplicates the
    // Username / Organization Name placeholders, so every field must be scoped
    // to the sign-in form. These are the exact locators the page object ships.
    const form = page.locator('#eo_cc_login');
    await form.locator('#loginType').selectOption({ label: 'Organization Login' });
    await form.getByRole('textbox', { name: 'Organization Name' }).waitFor({ state: 'visible', timeout: 15_000 });

    await form.getByRole('textbox', { name: 'Username' }).fill(login.username);
    await form.getByRole('textbox', { name: 'Organization Name' }).fill(login.organization);
    await form.getByPlaceholder('Password').fill(login.password);
    await form.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

    findings.landedUrl = page.url();
    findings.title = await page.title();
    findings.stillOnLoginPage = page.url().includes('showLogin');
    findings.signInButtonStillPresent = await page
      .getByRole('button', { name: 'Sign In' })
      .count();
    findings.failureMessage = await page
      .locator('.errorMessage')
      .allInnerTexts()
      .catch(() => []);

    findings.headings = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((el) => ({ tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim() }))
        .filter((h) => h.text.length > 0)
        .slice(0, 25),
    );
    findings.landmarks = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role], nav, header, main'))
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          id: el.id || null,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        }))
        .slice(0, 30),
    );
    findings.links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a'))
        .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((t) => t.length > 0)
        .slice(0, 40),
    );
    findings.bodyTextStart = (await page.locator('body').innerText())
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 800);

    await page.screenshot({ path: path.join(REPORT_DIR, 'ETA-351-home-page.png'), fullPage: true });
    findings.status = 'OBSERVED';
  } catch (error) {
    findings.status = 'FAILED';
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }

  const out = path.join(REPORT_DIR, 'ETA-351-home-page-probe.json');
  fs.writeFileSync(out, JSON.stringify(findings, null, 2) + '\n', 'utf8');
  console.log('status: ' + findings.status);
  if (findings.error) console.log('error : ' + findings.error);
  console.log('url   : ' + findings.landedUrl);
  console.log('title : ' + findings.title);
  console.log('still on login page: ' + findings.stillOnLoginPage);
  console.log('failure message    : ' + JSON.stringify(findings.failureMessage));
  console.log('\nheadings:\n' + JSON.stringify(findings.headings ?? null, null, 2));
  console.log('\nlandmarks:\n' + JSON.stringify(findings.landmarks ?? null, null, 2).slice(0, 2000));
  console.log('\nlinks:\n' + JSON.stringify(findings.links ?? null));
  console.log('\nbody start:\n' + (findings.bodyTextStart ?? '(none)'));
  console.log('\nreport -> ' + out);
}

await main();

/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/eta-411-navigation-validation.ts
 *
 * PLAYWRIGHT_VALIDATION for TP-ETA-411-001, run as a direct probe because the
 * Playwright MCP server exposes no tools in this session. The evidence is
 * scripted navigation, not MCP, and the report records that plainly.
 *
 * Three questions this probe exists to answer, in order of how much they matter:
 *
 *   1. Do the dashboard-icon locator and the header-link locator resolve to
 *      DIFFERENT elements? If they do not, TS-ETA-411-003 and TS-ETA-411-008
 *      are one test wearing two identifiers, and two acceptance criteria would
 *      report coverage that only one of them has. RISK-TP-ETA-411-003.
 *
 *   2. Where do the two header links actually go? AC-ETA-411-008 and
 *      AC-ETA-411-009 were approved on the evidence of an href. An href is not
 *      proof of navigation. RISK-TP-ETA-411-001.
 *
 *   3. Does the Command Center control return the user Home from all three
 *      destinations, not just the one that was walked during reconnaissance?
 *
 * This probe OBSERVES. It never edits an approved expectation. A difference
 * between what it sees and what an approved criterion says is recorded as a
 * discrepancy for a human, never absorbed.
 *
 * Exactly one sign-in with correct details, so the failed-attempt lockout
 * counter is untouched. No credential value is printed or written.
 */
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';
const REPORT_PATH = `${REPORT_DIR}/ETA-411-navigation-validation.json`;

const ICON_SCOPE = '#icon-buttons';
const COMMAND_CENTER = '#bannerBackground';

interface NavigationResult {
  entryPoint: string;
  target: string;
  clicked: boolean;
  landedUrl: string | null;
  landedTitle: string | null;
  headings: string[];
  returnedHomeUrl: string | null;
  error: string | null;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 60_000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => undefined);
}

async function headingsOf(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('h1, h2, h3, legend, caption'))
      .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length > 0)
      .slice(0, 25),
  );
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

async function returnHome(page: Page, homeUrl: string): Promise<string | null> {
  try {
    await page.locator(COMMAND_CENTER).first().click({ timeout: 15_000 });
    await settle(page);
    return page.url();
  } catch {
    // Fall back to a direct visit so the probe can keep going; the failure to
    // return is already recorded by the null above being replaced with this note.
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await settle(page);
    return null;
  }
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const findings: Record<string, unknown> = {
    probe: 'ETA-411-navigation-validation',
    story: 'ETA-411',
    testPlanId: 'TP-ETA-411-001',
    stage: 'PLAYWRIGHT_VALIDATION',
    evidenceSource:
      'Scripted Playwright navigation. The Playwright MCP server exposed no tools in this ' +
      'session, so this is the documented fallback. Every destination below was reached by ' +
      'an actual click, not inferred from a link address.',
    startedAt: new Date().toISOString(),
    note: 'Observation only. No approved expectation was edited to match what was seen.',
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await signIn(page);
    const homeUrl = page.url();
    findings.homeUrl = homeUrl;
    findings.homeTitle = await page.title();

    // --- Question 1: are the two entry points distinct? ----------------------
    const ambiguity: Record<string, unknown> = {};
    for (const name of ['New Transaction', 'Workspace']) {
      const unscoped = await page.getByRole('link', { name, exact: true }).count();
      const scopedIcon = await page
        .locator(ICON_SCOPE)
        .getByRole('link', { name, exact: true })
        .count();
      ambiguity[name] = { unscopedMatches: unscoped, scopedToIconContainer: scopedIcon };
    }
    findings.locatorAmbiguity = ambiguity;

    findings.iconContainer = await page.evaluate((scope) => {
      const root = document.querySelector(scope);
      if (!root) return null;
      return {
        found: true,
        links: Array.from(root.querySelectorAll('a')).map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
          href: el.getAttribute('href'),
          elementId: el.id || null,
          className: typeof el.className === 'string' ? el.className.trim() || null : null,
        })),
      };
    }, ICON_SCOPE);

    findings.headerLinks = await page.evaluate((scope) =>
      Array.from(document.querySelectorAll('a'))
        .filter((el) => !el.closest(scope))
        .filter((el) => {
          const cls = typeof el.className === 'string' ? el.className : '';
          return /new_transaction|workspace/i.test(cls) || el.id === 'header';
        })
        .map((el) => ({
          text: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
          href: el.getAttribute('href'),
          elementId: el.id || null,
          className: typeof el.className === 'string' ? el.className.trim() || null : null,
          parentId: el.parentElement?.id || null,
          parentClass:
            typeof el.parentElement?.className === 'string'
              ? el.parentElement.className.trim() || null
              : null,
        })),
      ICON_SCOPE,
    );

    findings.commandCenterControl = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        elementId: el.id || null,
        className: typeof el.className === 'string' ? el.className.trim() || null : null,
        text: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
        ariaLabel: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        role: el.getAttribute('role'),
        backgroundImage: style.backgroundImage === 'none' ? null : style.backgroundImage,
        cursor: style.cursor,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    }, COMMAND_CENTER);

    // --- Questions 2 and 3: walk every entry point --------------------------
    const walks: NavigationResult[] = [];

    for (const name of ['New Transaction', 'Workspace', 'Preferences']) {
      const result: NavigationResult = {
        entryPoint: `dashboard icon: ${name}`,
        target: name,
        clicked: false,
        landedUrl: null,
        landedTitle: null,
        headings: [],
        returnedHomeUrl: null,
        error: null,
      };
      try {
        await page.locator(ICON_SCOPE).getByRole('link', { name, exact: true }).first().click({ timeout: 20_000 });
        result.clicked = true;
        await settle(page);
        result.landedUrl = page.url();
        result.landedTitle = await page.title();
        result.headings = await headingsOf(page);
        result.returnedHomeUrl = await returnHome(page, homeUrl);
      } catch (error) {
        result.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
        await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await settle(page);
      }
      walks.push(result);
    }

    for (const name of ['New Transaction', 'Workspace']) {
      const result: NavigationResult = {
        entryPoint: `header link: ${name}`,
        target: name,
        clicked: false,
        landedUrl: null,
        landedTitle: null,
        headings: [],
        returnedHomeUrl: null,
        error: null,
      };
      try {
        const header = page.getByRole('link', { name, exact: true });
        const total = await header.count();
        const scoped = await page.locator(ICON_SCOPE).getByRole('link', { name, exact: true }).count();
        // Take a match that is NOT inside the icon container. If the counts are
        // equal there is no separate header link and that is the finding.
        if (total <= scoped) {
          result.error = `No link named "${name}" exists outside ${ICON_SCOPE}.`;
        } else {
          const candidates = await page
            .locator(`a:not(${ICON_SCOPE} a)`)
            .filter({ hasText: name })
            .all();
          if (candidates.length === 0) {
            result.error = `Could not isolate a header link named "${name}".`;
          } else {
            await candidates[0].click({ timeout: 20_000 });
            result.clicked = true;
            await settle(page);
            result.landedUrl = page.url();
            result.landedTitle = await page.title();
            result.headings = await headingsOf(page);
            result.returnedHomeUrl = await returnHome(page, homeUrl);
          }
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
      }
      if (page.url() !== homeUrl) {
        await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await settle(page);
      }
      walks.push(result);
    }

    findings.walks = walks;
  } catch (error) {
    findings.fatalError = error instanceof Error ? error.message : String(error);
  } finally {
    findings.finishedAt = new Date().toISOString();
    await context.close();
    await browser.close();
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(findings, null, 2)}\n`, 'utf8');
    console.log(`Report written to ${REPORT_PATH}`);
  }
}

await main();

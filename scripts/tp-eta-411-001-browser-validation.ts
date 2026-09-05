/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/tp-eta-411-001-browser-validation.ts
 *
 * PLAYWRIGHT_VALIDATION for TP-ETA-411-001, run as a direct scripted probe because the
 * Playwright MCP server exposes no tools in this session. The report records that plainly
 * so nobody later mistakes scripted evidence for MCP evidence.
 *
 * Two things make this run different from the ETA-411 reconnaissance probes:
 *
 *   1. The environment moved from qa1 to qa5. Every locator, URL and menu entry recorded
 *      in reports/validation/ETA-411-*.json was observed on qa1 and is therefore a prior
 *      expectation here, not a fact. Divergence is recorded, never absorbed.
 *   2. Gate 3 is approved, so the job is now to prove each MCP_VALIDATION_REQUIRED locator
 *      resolves to exactly one element and reaches the destination the design claims.
 *
 * This probe OBSERVES. It never edits an approved expectation.
 *
 * Exactly one sign-in with correct details, so the failed-attempt lockout counter is
 * untouched. The unauthenticated check enters no credential at all. No credential value
 * is printed or written.
 */
import { chromium } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';
const REPORT_PATH = `${REPORT_DIR}/TP-ETA-411-001-browser-validation.json`;

const ICON_SCOPE = '#icon-buttons';
const COMMAND_CENTER = '#bannerBackground';

const DASHBOARD_ICONS = ['New Transaction', 'Workspace', 'Preferences'];
const MENU_ENTRIES = ['New Transaction', 'Workspace', 'Home'];
const GROUPED_ENTRIES = ['Organization', 'Vault'];

interface LocatorCheck {
  purpose: string;
  candidate: string;
  matches: number;
  visible: boolean | null;
  accessibleName: string | null;
  note: string | null;
}

interface Walk {
  entryPoint: string;
  target: string;
  startedFrom: string;
  clicked: boolean;
  landedUrl: string | null;
  landedTitle: string | null;
  headings: string[];
  error: string | null;
  errorDetail: string | null;
  failureDiagnosis: unknown;
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

/**
 * Organization and Vault sit in a submenu whose ul carries class eo-hidden, so they are
 * not in the accessibility tree until the 'more' section is opened. Which control opens it
 * is a discovery, not an assumption.
 */
async function openMenu(page: Page): Promise<string | null> {
  const probe = page.locator('[id="header.preferences.vault"]').first();
  if (await probe.isVisible().catch(() => false)) return 'already-visible';

  // There are several li.section.more.dropdownMenu siblings (Analytics, Preferences, Help),
  // so the section must be identified by what it contains, not by position.
  const candidates = [
    'li.section:has([id="header.preferences.org"])',
    '#menuContainer li.dropdownMenu:has([id="header.preferences.org"])',
  ];
  for (const candidate of candidates) {
    const trigger = page.locator(candidate).first();
    if ((await trigger.count()) === 0) continue;
    await trigger.hover({ timeout: 5_000 }).catch(() => undefined);
    if (await probe.isVisible().catch(() => false)) return `hover: ${candidate}`;
    await trigger.click({ timeout: 5_000 }).catch(() => undefined);
    if (await probe.isVisible().catch(() => false)) return `click: ${candidate}`;
  }
  return null;
}

/** A click that times out is usually intercepted; this records what is actually on top. */
async function diagnoseClickTarget(page: Page, selector: string): Promise<unknown> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const centre = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return {
      found: true,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      display: style.display,
      visibility: style.visibility,
      pointerEvents: style.pointerEvents,
      elementAtCentre: centre
        ? {
            tag: centre.tagName.toLowerCase(),
            elementId: centre.id || null,
            className:
              typeof centre.className === 'string' ? centre.className.trim() || null : null,
          }
        : null,
      isSelf: centre === el,
    };
  }, selector);
}

async function checkLocator(
  page: Page,
  purpose: string,
  candidate: string,
  locator: ReturnType<Page['locator']>,
): Promise<LocatorCheck> {
  const matches = await locator.count().catch(() => -1);
  const first = locator.first();
  return {
    purpose,
    candidate,
    matches,
    visible: matches > 0 ? await first.isVisible().catch(() => null) : null,
    accessibleName:
      matches > 0
        ? await first.evaluate((el) => el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').replace(/\s+/g, ' ').trim() || null).catch(() => null)
        : null,
    note: matches === 1 ? null : 'Does not resolve to exactly one element.',
  };
}

async function walkFrom(
  page: Page,
  homeUrl: string,
  entryPoint: string,
  target: string,
  locator: ReturnType<Page['locator']>,
  diagnosisSelector: string | null,
  startUrl?: string,
): Promise<Walk> {
  const walk: Walk = {
    entryPoint,
    target,
    startedFrom: startUrl ?? homeUrl,
    clicked: false,
    landedUrl: null,
    landedTitle: null,
    headings: [],
    error: null,
    errorDetail: null,
    failureDiagnosis: null,
  };
  try {
    if (startUrl) {
      await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await settle(page);
    }
    await locator.first().click({ timeout: 20_000 });
    walk.clicked = true;
    await settle(page);
    walk.landedUrl = page.url();
    walk.landedTitle = await page.title();
    walk.headings = await headingsOf(page);
  } catch (error) {
    walk.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
    // Playwright names the actionability check that failed only in the full message.
    walk.errorDetail = error instanceof Error ? error.message.slice(0, 1200) : String(error);
    // Diagnose at the moment of failure: a click that times out is usually intercepted,
    // and guessing which overlay did it would be inventing evidence.
    walk.failureDiagnosis = await page
      .evaluate((sel) => {
        const dialogs = Array.from(document.querySelectorAll('.ui-dialog, [role="dialog"]'))
          .filter((d) => window.getComputedStyle(d).display !== 'none')
          .map((d) => (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120));
        const el = sel ? document.querySelector(sel) : null;
        if (!el) return { selectorResolved: false, visibleDialogs: dialogs };
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const centre = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return {
          selectorResolved: true,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          ancestorHidden: Boolean(el.closest('.eo-hidden')),
          isSelf: centre === el,
          elementAtCentre: centre
            ? {
                tag: centre.tagName.toLowerCase(),
                elementId: centre.id || null,
                className:
                  typeof centre.className === 'string' ? centre.className.trim() || null : null,
              }
            : null,
          // Playwright clicks the centre of the visible portion, which is not always the
          // geometric centre, so the whole box is sampled to find the real interceptor.
          hitTargets: [0.1, 0.3, 0.5, 0.7, 0.9].map((fraction) => {
            const hit = document.elementFromPoint(
              rect.left + rect.width * fraction,
              rect.top + rect.height / 2,
            );
            return hit
              ? {
                  fraction,
                  tag: hit.tagName.toLowerCase(),
                  elementId: hit.id || null,
                  className:
                    typeof hit.className === 'string' ? hit.className.trim() || null : null,
                  text: (hit.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) || null,
                  outerHtml: hit.outerHTML.slice(0, 200),
                }
              : { fraction, tag: null };
          }),
          visibleDialogs: dialogs,
        };
      }, diagnosisSelector)
      .catch(() => null);
  }
  // Return Home directly, never via Command Center: that control is what
  // TS-ETA-411-006 exists to prove and borrowing it would make the evidence circular.
  await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => undefined);
  await settle(page);
  return walk;
}

async function validateSignedIn(page: Page, findings: Record<string, unknown>): Promise<void> {
  await signIn(page);
  const homeUrl = page.url();
  findings.homeUrl = homeUrl;
  findings.homeTitle = await page.title();

  const locatorChecks: LocatorCheck[] = [];

  for (const name of DASHBOARD_ICONS) {
    locatorChecks.push(
      await checkLocator(
        page,
        `Dashboard icon: ${name} (TS-ETA-411-001, TS-ETA-411-002)`,
        `page.locator('${ICON_SCOPE}').getByRole('link', { name: '${name}', exact: true })`,
        page.locator(ICON_SCOPE).getByRole('link', { name, exact: true }),
      ),
    );
    locatorChecks.push(
      await checkLocator(
        page,
        `Unscoped control: ${name} - recorded to show why the icon locator must be scoped`,
        `page.getByRole('link', { name: '${name}', exact: true })`,
        page.getByRole('link', { name, exact: true }),
      ),
    );
  }

  const openedBy = await openMenu(page);
  findings.menuTrigger = openedBy;

  for (const name of [...MENU_ENTRIES, ...GROUPED_ENTRIES]) {
    locatorChecks.push(
      await checkLocator(
        page,
        `Navigation menu entry: ${name}`,
        `page.getByRole('link', { name: '${name}', exact: true })`,
        page.getByRole('link', { name, exact: true }),
      ),
    );
  }

  // The ids carry a dot, so they need an attribute selector rather than #id.
  const idCandidates: Array<[string, string]> = [
    ['Menu entry Home', 'header.home'],
    ['Menu entry New Transaction', 'header.new_transaction'],
    ['Menu entry Workspace', 'header.workspace'],
    ['Menu entry Organization, beneath Preferences', 'header.preferences.org'],
    ['Menu entry Vault, beneath Preferences', 'header.preferences.vault'],
  ];
  for (const [purpose, id] of idCandidates) {
    locatorChecks.push(
      await checkLocator(
        page,
        `${purpose} - id-based alternative`,
        `page.locator('[id="${id}"]')`,
        page.locator(`[id="${id}"]`),
      ),
    );
  }

  findings.homeLinkClickDiagnosis = await diagnoseClickTarget(page, '[id="header.home"]');
  findings.preferencesGroupingLabel = await page.evaluate(() => {
    const org = document.querySelector('[id="header.preferences.org"]');
    const section = org?.closest('li.section') ?? null;
    if (!section) return null;
    const label = section.querySelector(':scope > a, :scope > span, :scope > div');
    return {
      sectionClass:
        typeof section.className === 'string' ? section.className.trim() || null : null,
      labelTag: label ? label.tagName.toLowerCase() : null,
      labelText: label ? (label.textContent || '').replace(/\s+/g, ' ').trim() : null,
      isLink: label ? label.tagName.toLowerCase() === 'a' : null,
      href: label ? label.getAttribute('href') : null,
    };
  });

  locatorChecks.push(
    await checkLocator(
      page,
      'Command Center (TS-ETA-411-006) - string selector, no accessible name exists',
      `page.locator('${COMMAND_CENTER}')`,
      page.locator(COMMAND_CENTER),
    ),
  );

  findings.locatorChecks = locatorChecks;

  findings.commandCenterControl = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
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
    };
  }, COMMAND_CENTER);

  // The 'Preferences' grouping is a heading over two entries, not a link (AMB-ETA-411-007).
  // Its markup is dumped rather than asserted, so a locator can be chosen from evidence.
  findings.preferencesGrouping = await page.evaluate(() => {
    const vault = Array.from(document.querySelectorAll('a')).find(
      (el) => (el.textContent || '').trim() === 'Vault',
    );
    if (!vault) return null;
    const ancestry: unknown[] = [];
    let node: HTMLElement | null = vault.parentElement;
    for (let depth = 0; depth < 5 && node; depth += 1) {
      ancestry.push({
        depth,
        tag: node.tagName.toLowerCase(),
        elementId: node.id || null,
        className: typeof node.className === 'string' ? node.className.trim() || null : null,
        ownText: Array.from(node.childNodes)
          .filter((n) => n.nodeType === 3)
          .map((n) => (n.textContent || '').replace(/\s+/g, ' ').trim())
          .filter((t) => t.length > 0),
      });
      node = node.parentElement;
    }
    return { vaultHref: vault.getAttribute('href'), ancestry };
  });

  findings.menuInventory = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
        href: el.getAttribute('href'),
        elementId: el.id || null,
      }))
      .filter((entry) => entry.text !== null),
  );

  const walks: Walk[] = [];

  for (const name of DASHBOARD_ICONS) {
    walks.push(
      await walkFrom(
        page,
        homeUrl,
        'dashboard icon',
        name,
        page.locator(ICON_SCOPE).getByRole('link', { name, exact: true }),
        null,
      ),
    );
  }

  const menuIds: Record<string, string> = {
    'New Transaction': 'header.new_transaction',
    Workspace: 'header.workspace',
    Home: 'header.home',
    Organization: 'header.preferences.org',
    Vault: 'header.preferences.vault',
  };
  for (const name of [...MENU_ENTRIES, ...GROUPED_ENTRIES]) {
    // Only the grouped entries need the dropdown. Opening it for a top-level entry
    // leaves the submenu covering the nav bar, and the click is then intercepted.
    if (GROUPED_ENTRIES.includes(name)) await openMenu(page);
    const selector = `[id="${menuIds[name]}"]`;
    // Clicking Home while already on Home would prove nothing, so it starts from Workspace.
    const startUrl =
      name === 'Home' ? `${new URL(homeUrl).origin}/ssweb/setup/workspace/workspace.eo` : undefined;
    walks.push(
      await walkFrom(
        page,
        homeUrl,
        'navigation menu',
        name,
        page.locator(selector),
        selector,
        startUrl,
      ),
    );
  }

  findings.walks = walks;

  // TS-ETA-411-006: Command Center from each of the five non-Home modules.
  const commandCenterReturns: unknown[] = [];
  const modules: Array<[string, string]> = [
    ['New Transaction', '/ssweb/setup/container/ct/newPackage.eo'],
    ['Workspace', '/ssweb/setup/workspace/workspace.eo'],
    ['Preferences', '/ssweb/setup/prefs/preferences.eo'],
    ['Organization', '/ssweb/setup/prefs/preferences.eo'],
    ['Vault', '/ssweb/setup/vault/vault.eo'],
  ];
  const origin = new URL(homeUrl).origin;
  for (const [name, path] of modules) {
    const entry: Record<string, unknown> = { module: name, visited: `${origin}${path}` };
    try {
      await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await settle(page);
      entry.startedAt = page.url();
      await page.locator(COMMAND_CENTER).first().click({ timeout: 20_000 });
      await settle(page);
      entry.returnedTo = page.url();
      entry.returnedHome = page.url() === homeUrl;
    } catch (error) {
      entry.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
      entry.returnedHome = false;
    }
    commandCenterReturns.push(entry);
  }
  findings.commandCenterReturns = commandCenterReturns;
}

/** TS-ETA-411-007 runs in its own context so it is genuinely unauthenticated. */
async function validateUnauthenticated(
  browser: Browser,
  homeUrl: string,
  findings: Record<string, unknown>,
): Promise<void> {
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const origin = new URL(homeUrl).origin;
  const result: Record<string, unknown> = {
    requested: `${origin}/ssweb/setup/workspace/workspace.eo`,
    credentialEntered: false,
  };
  try {
    await page.goto(result.requested as string, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await settle(page);
    result.landedUrl = page.url();
    result.landedTitle = await page.title();
    result.signInFormPresent = (await page.locator('#eo_cc_login').count()) > 0;
    result.messages = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.error, .errors, .message, .alert, [class*="error"], [class*="message"]'))
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          elementId: el.id || null,
          className: typeof el.className === 'string' ? el.className.trim() || null : null,
          text: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
        }))
        .filter((entry) => entry.text !== null && entry.text.length > 0)
        .slice(0, 20),
    );
  } catch (error) {
    result.error = error instanceof Error ? error.message.split('\n')[0] : String(error);
  }
  findings.unauthenticated = result;
  await context.close();
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const findings: Record<string, unknown> = {
    probe: 'TP-ETA-411-001-browser-validation',
    story: 'ETA-411',
    testPlanId: 'TP-ETA-411-001',
    stage: 'PLAYWRIGHT_VALIDATION',
    evidenceSource:
      'Scripted Playwright navigation. The Playwright MCP server exposed no tools in this ' +
      'session, so this is the documented fallback. Every destination was reached by an ' +
      'actual click unless the record says otherwise.',
    environmentNote:
      'Run against PLAYWRIGHT_BASE_URL, which now points at qa5. All earlier ETA-411 ' +
      'evidence was gathered on qa1 and is treated here as prior expectation, not fact.',
    startedAt: new Date().toISOString(),
    note: 'Observation only. No approved expectation was edited to match what was seen.',
  };

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await validateSignedIn(page, findings);
    await validateUnauthenticated(browser, findings.homeUrl as string, findings);
  } catch (error) {
    findings.fatalError = error instanceof Error ? error.message : String(error);
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

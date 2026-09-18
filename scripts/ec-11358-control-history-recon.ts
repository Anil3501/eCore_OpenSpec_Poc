/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ec-11358-control-history-recon.ts
 *
 * PLAYWRIGHT_VALIDATION reconnaissance for TP-EC-11358-001, run as a direct
 * Playwright probe because the Playwright MCP server exposes no browser tools in
 * this session. The evidence is scripted navigation, not MCP, and the report
 * says so plainly.
 *
 * This probe OBSERVES and never edits an approved expectation. It answers, in
 * order of how much they matter, three questions that gate the rest of the work:
 *
 *   1. Does the configured account land in the SAME environment/org that holds
 *      the known transferred document (QA3, PamQA3 org, TransactionID 9045126 /
 *      DocID 9045127, from EC-11358 comment 198635)? If not, the Control History
 *      table cannot be reached with these credentials and the stage is BLOCKED
 *      on test-data access, not fabricated as validated.
 *
 *   2. How is the Document Activity History Report reached from the signed-in
 *      Home page? The navigation path is unknown; this records the real links.
 *
 *   3. Which `.eo` calls does the application actually issue while a user reaches
 *      and opens a document? This seeds the search for eoRequestExport and
 *      eoGetDocumentActivityHistoryReport without guessing their shapes.
 *
 * No destructive `.eo` verb is invoked. Only sign-in and navigation happen here.
 * No credential value is printed or written.
 */
import { chromium } from '@playwright/test';
import type { Page, Request as PwRequest } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';
const REPORT_PATH = `${REPORT_DIR}/EC-11358-control-history-recon.json`;

const KNOWN_TRANSACTION_ID = '9045126';
const KNOWN_DOC_ID = '9045127';
const KNOWN_ORG = 'PamQA3';

interface EoCall {
  method: string;
  path: string;
  resourceType: string;
  status: number | null;
}

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

async function navLinksOf(page: Page): Promise<Array<Record<string, string | null>>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('a'))
      .map((el) => ({
        text: (el.textContent || '').replace(/\s+/g, ' ').trim() || null,
        href: el.getAttribute('href'),
        elementId: el.id || null,
      }))
      .filter((l) => (l.text && l.text.length > 0) || (l.href && /\.eo/i.test(l.href)))
      .slice(0, 120),
  );
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const baseUrl = env.requireBaseUrl();
  const login = env.requireEcoreLogin();

  const findings: Record<string, unknown> = {
    probe: 'EC-11358-control-history-recon',
    story: 'EC-11358',
    testPlanId: 'TP-EC-11358-001',
    stage: 'PLAYWRIGHT_VALIDATION',
    evidenceSource:
      'Scripted Playwright navigation. The Playwright MCP server exposed no browser tools in ' +
      'this session, so this is the documented fallback. Observation only; no approved ' +
      'expectation was edited and no destructive .eo verb was invoked.',
    startedAt: new Date().toISOString(),
    environment: {
      baseUrlHost: new URL(baseUrl).host,
      baseUrlMentionsQa3: baseUrl.toLowerCase().includes('qa3'),
      configuredOrgMatchesKnownOrg: login.organization.toLowerCase() === KNOWN_ORG.toLowerCase(),
      knownTransactionId: KNOWN_TRANSACTION_ID,
      knownDocId: KNOWN_DOC_ID,
      knownOrg: KNOWN_ORG,
    },
  };

  const eoCalls: EoCall[] = [];
  const pending = new Map<PwRequest, EoCall>();

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('request', (req) => {
    const url = req.url();
    if (/\.eo(\?|$)/i.test(url)) {
      const call: EoCall = {
        method: req.method(),
        path: new URL(url).pathname,
        resourceType: req.resourceType(),
        status: null,
      };
      pending.set(req, call);
      eoCalls.push(call);
    }
  });
  page.on('response', (res) => {
    const call = pending.get(res.request());
    if (call) call.status = res.status();
  });

  try {
    await signIn(page);
    findings.homeUrl = page.url();
    findings.homeTitle = await page.title();
    findings.homeNavLinks = await navLinksOf(page);

    // Reconnaissance only: visit the workspace landing so we can see the real
    // navigation and the .eo traffic the application issues on the way. We do
    // NOT invoke any transaction-mutating verb.
    const workspaceLink = page.getByRole('link', { name: /workspace/i }).first();
    if (await workspaceLink.count()) {
      await workspaceLink.click({ timeout: 20_000 }).catch(() => undefined);
      await settle(page);
      findings.workspaceUrl = page.url();
      findings.workspaceTitle = await page.title();
      findings.workspaceNavLinks = await navLinksOf(page);
      findings.workspaceHeadings = await page.evaluate(() =>
        Array.from(document.querySelectorAll('h1, h2, h3, legend, caption, th'))
          .map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
          .filter((t) => t.length > 0)
          .slice(0, 40),
      );
    } else {
      findings.workspaceUrl = null;
      findings.workspaceNote = 'No Workspace link found on Home.';
    }
  } catch (err) {
    findings.error = err instanceof Error ? err.message : String(err);
  } finally {
    findings.eoCallsObserved = eoCalls;
    findings.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(findings, null, 2) + '\n');
    await browser.close();
  }

  console.log('Recon written to', REPORT_PATH);
  console.log('baseUrl host:', (findings.environment as Record<string, unknown>).baseUrlHost);
  console.log(
    'org matches PamQA3:',
    (findings.environment as Record<string, unknown>).configuredOrgMatchesKnownOrg,
  );
  console.log('base mentions qa3:', (findings.environment as Record<string, unknown>).baseUrlMentionsQa3);
  console.log('.eo calls observed:', eoCalls.length);
}

main().catch((err) => {
  console.error('Recon probe failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

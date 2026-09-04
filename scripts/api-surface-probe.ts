/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/api-surface-probe.ts
 *
 * Answers one question before any API test plan is written: does eCore expose
 * an API surface that the approved ETA-351 and ETA-411 flows actually use?
 *
 * The framework forbids authoring an endpoint, so a revised test plan cannot be
 * proposed from imagination. This drives the already-approved UI flows and
 * records the calls the application really makes, which is the only legitimate
 * source of a contract marked OBSERVED.
 *
 * What it records: method, path, query PARAMETER NAMES, resource type, status,
 * content type, and for JSON responses the top-level key names.
 * What it never records: request bodies (the sign-in POST carries the
 * password), response values, headers, cookies, or query parameter values.
 * Shape is what a contract needs; values are what a leak needs.
 *
 * OBSERVED is evidence of what the application does, never authority for what
 * it should do. Only a human at Gate 2 can turn any of this into an assertion.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/utils/env.ts';

const REPORT_DIR = 'reports/validation';
const REPORT_PATH = `${REPORT_DIR}/api-surface-probe.json`;

interface ObservedCall {
  phase: string;
  method: string;
  path: string;
  queryParamNames: string[];
  resourceType: string;
  status: number | null;
  contentType: string | null;
  jsonTopLevelKeys: string[] | null;
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const login = env.requireEcoreLogin();

  const calls: ObservedCall[] = [];
  let phase = 'initial-load';

  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('response', async (response) => {
    const requested = response.request();
    let parsed: URL;
    try {
      parsed = new URL(response.url());
    } catch {
      return;
    }

    const contentType = response.headers()['content-type'] ?? null;
    let jsonTopLevelKeys: string[] | null = null;

    if (contentType?.includes('json')) {
      try {
        const body: unknown = await response.json();
        if (body !== null && typeof body === 'object') {
          jsonTopLevelKeys = Array.isArray(body)
            ? ['(array)']
            : Object.keys(body as Record<string, unknown>);
        }
      } catch {
        jsonTopLevelKeys = null;
      }
    }

    calls.push({
      phase,
      method: requested.method(),
      path: parsed.pathname,
      queryParamNames: Array.from(new Set([...parsed.searchParams.keys()])),
      resourceType: requested.resourceType(),
      status: response.status(),
      contentType,
      jsonTopLevelKeys,
    });
  });

  try {
    await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

    phase = 'sign-in';
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
    await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

    const homeUrl = page.url();

    // The three ETA-411 destinations, each followed by a return Home so the
    // observation matches the approved navigation scenarios.
    const destinations = ['New Transaction', 'Workspace', 'Preferences'];
    for (const destination of destinations) {
      phase = destination.toLowerCase().replace(/\s+/g, '-');
      const link = page.getByRole('link', { name: destination }).first();
      if ((await link.count()) === 0) continue;
      await link.click().catch(() => undefined);
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);

      phase = `return-home-from-${phase}`;
      await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const jsonCalls = calls.filter((call) => call.contentType?.includes('json'));
  const xhrCalls = calls.filter((call) => ['xhr', 'fetch'].includes(call.resourceType));
  const distinctJsonPaths = Array.from(new Set(jsonCalls.map((call) => `${call.method} ${call.path}`)));
  const distinctXhrPaths = Array.from(new Set(xhrCalls.map((call) => `${call.method} ${call.path}`)));

  const report = {
    probe: 'api-surface',
    stories: ['ETA-351', 'ETA-411'],
    startedAt: new Date().toISOString(),
    scope:
      'Observation of the approved UI flows only. Records what the application does, never what ' +
      'it should do. No request body, response value, header, cookie or query value is recorded. ' +
      'Nothing here is a contract until a human approves it at Gate 2.',
    contractSource: 'OBSERVED',
    summary: {
      totalResponses: calls.length,
      jsonResponses: jsonCalls.length,
      xhrOrFetchResponses: xhrCalls.length,
      distinctJsonEndpoints: distinctJsonPaths.length,
      distinctXhrEndpoints: distinctXhrPaths.length,
      byResourceType: calls.reduce<Record<string, number>>((acc, call) => {
        acc[call.resourceType] = (acc[call.resourceType] ?? 0) + 1;
        return acc;
      }, {}),
    },
    distinctJsonEndpoints: distinctJsonPaths,
    distinctXhrEndpoints: distinctXhrPaths,
    calls,
  };

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Total responses observed: ${calls.length}`);
  console.log(`JSON responses:           ${jsonCalls.length}`);
  console.log(`XHR/fetch responses:      ${xhrCalls.length}`);
  console.log(`Distinct JSON endpoints:  ${distinctJsonPaths.length}`);
  console.log(`Distinct XHR endpoints:   ${distinctXhrPaths.length}`);
  console.log(`By resource type: ${JSON.stringify(report.summary.byResourceType)}`);
  if (distinctXhrPaths.length > 0) console.log(`\nXHR/fetch:\n  ${distinctXhrPaths.join('\n  ')}`);
  if (distinctJsonPaths.length > 0) console.log(`\nJSON:\n  ${distinctJsonPaths.join('\n  ')}`);
  console.log(`\nReport: ${REPORT_PATH}`);
}

await main();

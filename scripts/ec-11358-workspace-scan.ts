/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ec-11358-workspace-scan.ts [transaction-id]
 *
 * PLAYWRIGHT_VALIDATION follow-up for TP-EC-11358-001. The recon proved the
 * known transferred document (9045127, PamQA3 org, QA3) is unreachable from the
 * configured account. Before treating the stage as hard-blocked, this probe
 * asks the question that could unblock it here: does THIS org hold any
 * transaction whose document history shows a "Control History" section?
 *
 * It OBSERVES only. It submits the Workspace search (a read), reads the grid via
 * the DataTables envelope the app returns, and — for a bounded number of
 * transactions — opens the document history and looks for the literal marker
 * "Control History". It invokes no transaction-mutating .eo verb, creates no
 * transfer, and edits no approved expectation. No credential value is printed.
 */
import { chromium } from '@playwright/test';
import type { Page, Request as PwRequest, Response as PwResponse } from '@playwright/test';
import fs from 'node:fs';
import { env } from '../src/utils/env.ts';
import { computeResponseShapeHash, describeResponseShape } from '../src/utils/api-contract-shape.ts';
import { extractPdfText } from '../src/utils/pdf-text.ts';

const REPORT_DIR = 'reports/validation';
const REPORT_PATH = `${REPORT_DIR}/EC-11358-workspace-scan.json`;
const MAX_TRANSACTIONS_TO_OPEN = 50;
const TARGET_TRANSACTION_ID = process.argv[2];

interface TargetContractObservation {
  method: string;
  path: string;
  status: number | null;
  requestShape: {
    contentType: string | null;
    queryParameterNames: string[];
    formFieldNames: string[];
  };
  responseShape: {
    contentType: string | null;
    bodyKind: 'JSON' | 'TEXT' | 'BINARY';
    shapeDescription: string;
    responseShapeHash: string;
  } | null;
}

function requestShapeOf(request: PwRequest): TargetContractObservation['requestShape'] {
  const url = new URL(request.url());
  const contentType = request.headers()['content-type'] ?? null;
  const postData = request.postData();
  const formFieldNames =
    postData && contentType?.includes('application/x-www-form-urlencoded')
      ? [...new Set([...new URLSearchParams(postData).keys()])].sort()
      : [];
  return {
    contentType,
    queryParameterNames: [...new Set([...url.searchParams.keys()])].sort(),
    formFieldNames,
  };
}

async function responseShapeOf(response: PwResponse): Promise<NonNullable<TargetContractObservation['responseShape']>> {
  const contentType = response.headers()['content-type'] ?? null;
  const body = await response.body();
  if (contentType?.includes('json')) {
    const parsed = JSON.parse(body.toString('utf8')) as unknown;
    return {
      contentType,
      bodyKind: 'JSON',
      shapeDescription: describeResponseShape(parsed),
      responseShapeHash: computeResponseShapeHash(parsed),
    };
  }
  if (/text|html|xml|javascript/i.test(contentType ?? '')) {
    const text = body.toString('utf8');
    return {
      contentType,
      bodyKind: 'TEXT',
      shapeDescription: describeResponseShape(text),
      responseShapeHash: computeResponseShapeHash(text),
    };
  }
  const redactedBinaryShape = { body: 'binary' };
  return {
    contentType,
    bodyKind: 'BINARY',
    shapeDescription: describeResponseShape(redactedBinaryShape),
    responseShapeHash: computeResponseShapeHash(redactedBinaryShape),
  };
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
  await page.getByRole('link', { name: 'Logout', exact: true }).waitFor({ state: 'visible', timeout: 60_000 });
  await settle(page);
}

async function main(): Promise<void> {
  if (TARGET_TRANSACTION_ID && !/^\d+$/.test(TARGET_TRANSACTION_ID)) {
    throw new Error('When provided, the eCore Transaction ID must be numeric.');
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const findings: Record<string, unknown> = {
    probe: 'EC-11358-workspace-scan',
    story: 'EC-11358',
    testPlanId: 'TP-EC-11358-001',
    stage: 'PLAYWRIGHT_VALIDATION',
    evidenceSource:
      'Scripted Playwright navigation (no Playwright MCP browser tools in this session). ' +
      'Observation only; no transaction-mutating .eo verb invoked, no approved expectation edited. ' +
      'When the headless layout keeps the loaded snapshot pane hidden, the probe dispatches the ' +
      'application-owned delegated click on its observed .viewDocumentHistory element.',
    startedAt: new Date().toISOString(),
    baseUrlHost: new URL(env.requireBaseUrl()).host,
    targetTransactionId: TARGET_TRANSACTION_ID ?? null,
  };

  let workspaceTableData: { recordsTotal?: number; recordsFiltered?: number; rowCount?: number } | null = null;
  const reportApiHits: Array<{ path: string; method: string; status: number | null }> = [];
  const targetContractObservations: TargetContractObservation[] = [];
  const targetResponseCaptures: Promise<void>[] = [];
  const approvedReportSurfacesDriven: string[] = [];
  const workspaceCalls: Array<{ path: string; method: string; status: number | null }> = [];
  const allEoCalls: Array<{ path: string; method: string; status: number | null }> = [];
  const pending = new Map<PwRequest, { path: string; method: string; status: number | null }>();
  const pendingWorkspaceCalls = new Map<PwRequest, { path: string; method: string; status: number | null }>();
  const pendingEoCalls = new Map<PwRequest, { path: string; method: string; status: number | null }>();

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  const workspaceUrl = new URL('/ssweb/setup/workspace/workspace.eo', env.requireBaseUrl()).toString();

  page.on('request', (req) => {
    const url = req.url();
    if (/\.eo(?:\?|$)/i.test(url)) {
      const call = { path: new URL(url).pathname, method: req.method(), status: null as number | null };
      pendingEoCalls.set(req, call);
      allEoCalls.push(call);
    }
    if (/\/workspace\/.*\.eo(?:\?|$)/i.test(url)) {
      const call = { path: new URL(url).pathname, method: req.method(), status: null as number | null };
      pendingWorkspaceCalls.set(req, call);
      workspaceCalls.push(call);
    }
    if (/eoRequestExport|eoGetDocumentActivityHistoryReport|viewDocumentHistory/i.test(url)) {
      const hit = { path: new URL(url).pathname, method: req.method(), status: null as number | null };
      pending.set(req, hit);
      reportApiHits.push(hit);
    }
    if (/eoRequestExport|eoGetDocumentActivityHistoryReport/i.test(url)) {
      targetContractObservations.push({
        method: req.method(),
        path: new URL(url).pathname,
        status: null,
        requestShape: requestShapeOf(req),
        responseShape: null,
      });
    }
  });
  page.on('response', (res: PwResponse) => {
    const hit = pending.get(res.request());
    if (hit) hit.status = res.status();
    const workspaceCall = pendingWorkspaceCalls.get(res.request());
    if (workspaceCall) workspaceCall.status = res.status();
    const eoCall = pendingEoCalls.get(res.request());
    if (eoCall) eoCall.status = res.status();
    const target = targetContractObservations.find(
      (observation) => observation.path === new URL(res.url()).pathname && observation.status === null,
    );
    if (target) {
      target.status = res.status();
      targetResponseCaptures.push(
        responseShapeOf(res)
          .then((shape) => {
            target.responseShape = shape;
          })
          .catch(() => undefined),
      );
    }
  });
  const transactionsOpened: Array<{
    ref: string;
    url?: string;
    historyUrl?: string;
    controlHistoryFound: boolean;
    historySummary?: string;
    historyResponseKeys?: string[];
    historyTables?: Array<{ headers: string[]; rowCount: number; text: string }>;
    controllerHistory?: {
      path: string;
      status: number;
      text: string;
      tables: Array<{ headers: string[]; rowCount: number; text: string }>;
    };
    downloadedReport?: {
      suggestedFilename: string;
      textLength: number;
      controlHistoryFound: boolean;
      controlHistoryExcerpt?: string;
      confirmedTransferFound: boolean;
      confirmedTransferExcerpt?: string;
    };
    documentMenuState?: {
      triggerCount: number;
      triggerVisibleBefore: boolean;
      historyVisibleBefore: boolean;
      historyVisibleAfter: boolean;
    };
    historyControls?: Array<{ text: string; href: string | null; id: string | null }>;
    snapshotElements?: Array<{
      tag: string;
      id: string | null;
      className: string | null;
      text: string;
      hasOnClick: boolean;
    }>;
    snapshotResponse?: {
      status: number;
      contentType: string | null;
      text: string;
      controls: Array<{
        tag: string;
        id: string | null;
        text: string;
        href: string | null;
        onClick: string | null;
        className: string | null;
        parentClassName: string | null;
        previousSiblingClassName: string | null;
        previousSiblingText: string;
      }>;
    };
    note: string;
  }> = [];

  try {
    await signIn(page);
    await page.goto(workspaceUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    await settle(page);

    const transactionIdInput = page.locator('#searchSid');
    await page.locator('#searchCreatedAfter').clear();
    await page.locator('#searchCreatedBefore').clear();
    await transactionIdInput.fill(TARGET_TRANSACTION_ID ?? '');

    // Arm the response wait before submitting so a fast DataTables response is captured.
    const searchButton = page.locator('#submitSearchForm');
    const tableResponse = page.waitForResponse(/getWorkspaceTableData\.eo/i, { timeout: 30_000 });
    await searchButton.click({ timeout: 20_000 });
    const response = await tableResponse;
    try {
      const body = await response.json();
      workspaceTableData = {
        recordsTotal: body?.recordsTotal,
        recordsFiltered: body?.recordsFiltered,
        rowCount: Array.isArray(body?.data) ? body.data.length : undefined,
      };
    } catch (err) {
      findings.workspaceTableDataParseError = err instanceof Error ? err.message : String(err);
      findings.workspaceTableDataContentType = response.headers()['content-type'] ?? null;
    }
    await settle(page);
    await page.locator('table tbody tr a').first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);

    const pageLengthSelect = page.locator('select[aria-controls="datatable"]');
    if ((await pageLengthSelect.count()) === 1) {
      const options = await pageLengthSelect.locator('option').allTextContents();
      findings.pageLengthOptions = options.map((option) => option.trim());
      if (options.some((option) => option.trim() === '100')) {
        const expandedResponsePromise = page.waitForResponse(/getWorkspaceTableData\.eo/i, { timeout: 30_000 });
        await pageLengthSelect.selectOption({ label: '100' });
        const expandedResponse = await expandedResponsePromise;
        const expandedBody = await expandedResponse.json();
        workspaceTableData = {
          recordsTotal: expandedBody?.recordsTotal,
          recordsFiltered: expandedBody?.recordsFiltered,
          rowCount: Array.isArray(expandedBody?.data) ? expandedBody.data.length : undefined,
        };
        await page.locator('table#datatable tbody tr').first().waitFor({ state: 'visible', timeout: 30_000 });
      }
    }

    findings.workspaceTableData = workspaceTableData;
    findings.renderedTables = await page.locator('table').evaluateAll((tables) =>
      tables.map((table) => ({
        id: table.id || null,
        headers: Array.from(table.querySelectorAll('th'))
          .map((header) => (header.textContent || '').replace(/\s+/g, ' ').trim())
          .filter(Boolean),
        rowCount: table.querySelectorAll('tbody tr').length,
        links: Array.from(table.querySelectorAll('tbody tr a')).slice(0, 5).map((link) => ({
          text: (link.textContent || '').replace(/\s+/g, ' ').trim(),
          href: link.getAttribute('href'),
          hasOnClick: link.hasAttribute('onclick'),
        })),
      })),
    );
    findings.searchState = {
      url: page.url(),
      transactionId: await transactionIdInput.inputValue(),
      formAction: await searchButton.evaluate((button) => button.closest('form')?.getAttribute('action') ?? null),
      tableText: await page.locator('table#DataTables_Table_0').innerText().catch(() => null),
    };

    // Enumerate grid rows (DataTables). Capture a link per row if present.
    const rows = page.locator('table#datatable tbody tr');
    const rowTotal = await rows.count();
    findings.gridRowsRendered = rowTotal;
    findings.firstResultRow = await rows.first().evaluate((row) => ({
      id: row.id || null,
      className: row.className || null,
      attributes: Array.from(row.attributes).map((attribute) => ({
        name: attribute.name,
        value: attribute.value,
      })),
      cells: Array.from(row.querySelectorAll('td')).map((cell) => ({
        className: cell.className || null,
        text: (cell.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
      })),
    }));
    findings.interactionEvents = await page.evaluate(() => {
      const jq = (window as typeof window & {
        jQuery?: { _data?: (element: Element, key: string) => Record<string, unknown> | undefined };
      }).jQuery;
      const eventTypes = (element: Element | null): string[] =>
        element && jq?._data ? Object.keys(jq._data(element, 'events') ?? {}) : [];
      return {
        firstResultRow: eventTypes(document.querySelector('table#datatable tbody tr')),
        snapshotToggler: eventTypes(document.querySelector('#snapshot-toggler')),
      };
    });

    const openable: Array<{ ref: string }> = await page.evaluate(() => {
      const out: Array<{ ref: string }> = [];
      const trs = document.querySelectorAll('table#datatable tbody tr');
      trs.forEach((tr) => {
        const txt = (tr.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
        if (txt) out.push({ ref: txt });
      });
      return out.slice(0, 20);
    });
    findings.sampleRows = openable;

    const initialSnapshotToggler = page.locator('#snapshot-toggler');
    if (await initialSnapshotToggler.isVisible()) {
      await initialSnapshotToggler.click();
      await page.locator('#snapshot').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    }

    const restoreWorkspaceGrid = async (): Promise<void> => {
      await page.goto(workspaceUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await page.locator('#searchCreatedAfter').clear();
      await page.locator('#searchCreatedBefore').clear();
      await page.locator('#searchSid').fill(TARGET_TRANSACTION_ID ?? '');
      await Promise.all([
        page.waitForResponse(/getWorkspaceTableData\.eo/i, { timeout: 30_000 }),
        page.locator('#submitSearchForm').click({ timeout: 20_000 }),
      ]);
      await settle(page);
      const lengthSelect = page.locator('select[aria-controls="datatable"]');
      if ((await lengthSelect.count()) === 1) {
        const options = await lengthSelect.locator('option').allTextContents();
        if (options.some((option) => option.trim() === '100')) {
          await Promise.all([
            page.waitForResponse(/getWorkspaceTableData\.eo/i, { timeout: 30_000 }),
            lengthSelect.selectOption({ label: '100' }),
          ]);
        }
      }
      await page.locator('table#datatable tbody tr').first().waitFor({ state: 'visible', timeout: 30_000 });
    };

    // Open each candidate in an isolated Workspace view because its snapshot
    // overlays the grid and intercepts clicks intended for later rows.
    const limit = Math.min(rowTotal, MAX_TRANSACTIONS_TO_OPEN);
    for (let i = 0; i < limit; i += 1) {
      const row = rows.nth(i);
      const ref = (await row.textContent())?.replace(/\s+/g, ' ').trim().slice(0, 40) ?? `row-${i}`;
      try {
        const [snapshotResponse] = await Promise.all([
          page.waitForResponse(/transactionSnapshot\.eo/i, { timeout: 30_000 }),
          row.click({ timeout: 15_000 }),
        ]);
        const snapshotHtml = await snapshotResponse.text();
        const parsedSnapshot = await page.evaluate((html) => {
          const document = new DOMParser().parseFromString(html, 'text/html');
          return {
            text: (document.body.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 1000),
            controls: Array.from(
              document.querySelectorAll(
                'a, button, input[type=button], input[type=submit], [onclick], [class*="History"], [class*="history"]',
              ),
            )
              .map((control) => ({
                tag: control.tagName.toLowerCase(),
                id: control.id || null,
                text: ((control.textContent || '') || control.getAttribute('value') || '')
                  .replace(/\s+/g, ' ')
                  .trim(),
                href: control.getAttribute('href'),
                onClick: control.getAttribute('onclick'),
                className: control.getAttribute('class'),
                parentClassName: control.parentElement?.getAttribute('class') ?? null,
                previousSiblingClassName: control.previousElementSibling?.getAttribute('class') ?? null,
                previousSiblingText: (control.previousElementSibling?.textContent || '')
                  .replace(/\s+/g, ' ')
                  .trim(),
              }))
              .filter((control) => control.text || control.href || control.onClick || control.className)
              .slice(0, 50),
          };
        }, snapshotHtml);
        await settle(page);
        const snapshotToggler = page.locator('#snapshot-toggler');
        if (await snapshotToggler.getAttribute('class').then((value) => value?.includes('closed') ?? false)) {
          await snapshotToggler.click({ timeout: 15_000 });
          await settle(page);
        }
        let pageText = (await page.locator('body').innerText().catch(() => '')) || '';
        let controlHistoryFound = /control\s+history/i.test(pageText);
        const historyControls = await page.locator('a, button, input[type=button], input[type=submit]').evaluateAll((controls) =>
          controls
            .map((control) => ({
              text: ((control.textContent || '') || control.getAttribute('value') || '').replace(/\s+/g, ' ').trim(),
              href: control.getAttribute('href'),
              id: control.id || null,
              visible: (control as HTMLElement).offsetParent !== null,
            }))
            .filter((control) =>
              control.visible && /history|activity|view|open|document|report/i.test(
                `${control.text} ${control.href ?? ''} ${control.id ?? ''}`,
              ),
            )
            .slice(0, 30)
            .map(({ text, href, id }) => ({ text, href, id })),
        );
        const snapshotElements = await page.locator('div, table, tr, a, button, [onclick]').evaluateAll((elements) =>
          elements
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              id: element.id || null,
              className: element.getAttribute('class'),
              text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240),
              hasOnClick: element.hasAttribute('onclick'),
              visible: (element as HTMLElement).offsetParent !== null,
            }))
            .filter((element) =>
              element.visible && /snapshot|document|history|activity/i.test(
                `${element.id ?? ''} ${element.className ?? ''} ${element.text}`,
              ),
            )
            .slice(0, 30)
            .map(({ tag, id, className, text, hasOnClick }) => ({ tag, id, className, text, hasOnClick })),
        );
        const viewDocumentHistory = page.locator('.viewDocumentHistory').first();
        const documentActionsTrigger = page
          .locator('.snapshot-dropdown-action')
          .filter({ has: page.locator('.document-dropdown-actions') })
          .first();
        const documentMenuState = {
          triggerCount: await documentActionsTrigger.count(),
          triggerVisibleBefore: await documentActionsTrigger.isVisible(),
          historyVisibleBefore: await viewDocumentHistory.isVisible(),
          historyVisibleAfter: false,
        };
        let historyUrl: string | undefined;
        let historySummary: string | undefined;
        let downloadedReport:
          | {
              suggestedFilename: string;
              textLength: number;
              controlHistoryFound: boolean;
              controlHistoryExcerpt?: string;
              confirmedTransferFound: boolean;
              confirmedTransferExcerpt?: string;
            }
          | undefined;
        if ((await viewDocumentHistory.count()) && !(await viewDocumentHistory.isVisible())) {
          if (await documentActionsTrigger.isVisible()) {
            await documentActionsTrigger.hover();
            await viewDocumentHistory.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
            if (!(await viewDocumentHistory.isVisible())) {
              await documentActionsTrigger.click();
              await viewDocumentHistory.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
            }
          } else if (await documentActionsTrigger.count()) {
            await documentActionsTrigger.dispatchEvent('mouseenter');
            await documentActionsTrigger.dispatchEvent('click');
            await viewDocumentHistory.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
          }
        }
        documentMenuState.historyVisibleAfter = await viewDocumentHistory.isVisible();
        let historyResponseKeys: string[] | undefined;
        let historyTables: Array<{ headers: string[]; rowCount: number; text: string }> | undefined;
        let controllerHistory:
          | {
              path: string;
              status: number;
              text: string;
              tables: Array<{ headers: string[]; rowCount: number; text: string }>;
            }
          | undefined;
        if (await viewDocumentHistory.count()) {
          const historyResponsePromise = page.waitForResponse(/viewDocumentHistory\.eo/i, { timeout: 30_000 });
          const controllerHistoryResponsePromise = page.waitForResponse(/getControllerHistory\.eo/i, {
            timeout: 30_000,
          });
          if (await viewDocumentHistory.isVisible()) {
            await viewDocumentHistory.click({ timeout: 15_000 });
          } else {
            await viewDocumentHistory.dispatchEvent('click');
          }
          approvedReportSurfacesDriven.push('View History');
          const [historyResponse, controllerHistoryResponse] = await Promise.all([
            historyResponsePromise,
            controllerHistoryResponsePromise,
          ]);
          const historyBody = await historyResponse.json();
          historyResponseKeys = Object.keys(historyBody);
          const historyHtml = typeof historyBody.content === 'string' ? historyBody.content : '';
          const parsedHistory = await page.evaluate((html) => {
            const document = new DOMParser().parseFromString(html, 'text/html');
            return {
              text: (document.body.textContent || '').replace(/\s+/g, ' ').trim(),
              tables: Array.from(document.querySelectorAll('table')).map((table) => ({
                headers: Array.from(table.querySelectorAll('th'))
                  .map((header) => (header.textContent || '').replace(/\s+/g, ' ').trim())
                  .filter(Boolean),
                rowCount: table.querySelectorAll('tbody tr').length,
                text: (table.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
              })),
            };
          }, historyHtml);
          const renderedHistoryDialog = page.locator('#historyDialog');
          await renderedHistoryDialog.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
          await settle(page);
          const renderedHistory = await renderedHistoryDialog
            .evaluate((dialog) => ({
              text: (dialog.textContent || '').replace(/\s+/g, ' ').trim(),
              tables: Array.from(dialog.querySelectorAll('table')).map((table) => ({
                headers: Array.from(table.querySelectorAll('th'))
                  .map((header) => (header.textContent || '').replace(/\s+/g, ' ').trim())
                  .filter(Boolean),
                rowCount: table.querySelectorAll('tbody tr').length,
                text: (table.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
              })),
            }))
            .catch(() => null);
          pageText = renderedHistory?.text || parsedHistory.text;
          controlHistoryFound = /control\s+history/i.test(pageText);
          historyUrl = new URL(historyResponse.url()).pathname;
          historySummary = pageText.slice(0, 1200);
          historyTables = renderedHistory?.tables || parsedHistory.tables;
          const controllerResponseText = await controllerHistoryResponse.text();
          let controllerHtml = controllerResponseText;
          try {
            const controllerBody = JSON.parse(controllerResponseText);
            controllerHtml = typeof controllerBody.content === 'string' ? controllerBody.content : '';
          } catch {
            // The endpoint may return an HTML fragment directly.
          }
          const parsedControllerHistory = await page.evaluate((html) => {
            const document = new DOMParser().parseFromString(html, 'text/html');
            return {
              text: (document.body.textContent || '').replace(/\s+/g, ' ').trim(),
              tables: Array.from(document.querySelectorAll('table')).map((table) => ({
                headers: Array.from(table.querySelectorAll('th'))
                  .map((header) => (header.textContent || '').replace(/\s+/g, ' ').trim())
                  .filter(Boolean),
                rowCount: table.querySelectorAll('tbody tr').length,
                text: (table.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
              })),
            };
          }, controllerHtml);
          controllerHistory = {
            path: new URL(controllerHistoryResponse.url()).pathname,
            status: controllerHistoryResponse.status(),
            text: parsedControllerHistory.text.slice(0, 1200),
            tables: parsedControllerHistory.tables,
          };
          controlHistoryFound =
            controlHistoryFound ||
            /control\s+history/i.test(parsedControllerHistory.text) ||
            parsedControllerHistory.tables.length > 0;
          await page.screenshot({
            path: `${REPORT_DIR}/EC-11358-${TARGET_TRANSACTION_ID ?? 'workspace'}-view-history.png`,
            fullPage: true,
          });
        }
        const documentHistoryReport = page.locator('a.postlink[href*="/getHistoryReport.eo?dpSid="]').first();
        if (await documentHistoryReport.count()) {
          const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
          if (await documentHistoryReport.isVisible()) {
            await documentHistoryReport.click({ timeout: 15_000 });
          } else {
            await documentHistoryReport.dispatchEvent('click');
          }
          const download = await downloadPromise;
          approvedReportSurfacesDriven.push('Document Download History Report');
          const stream = await download.createReadStream();
          if (stream === null) {
            throw new Error('The document history report download produced no readable stream.');
          }
          const chunks: Buffer[] = [];
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const reportText = await extractPdfText(Buffer.concat(chunks));
          const markerIndex = reportText.search(/controller\s+history/i);
          const transferIndex = reportText.search(/confirmed transfer of control/i);
          downloadedReport = {
            suggestedFilename: download.suggestedFilename(),
            textLength: reportText.length,
            controlHistoryFound: markerIndex >= 0,
            controlHistoryExcerpt:
              markerIndex >= 0
                ? reportText
                    .slice(Math.max(0, markerIndex - 120), markerIndex + 600)
                    .replace(/\s+/g, ' ')
                    .trim()
                : undefined,
            confirmedTransferFound: transferIndex >= 0,
            confirmedTransferExcerpt:
              transferIndex >= 0
                ? reportText
                    .slice(Math.max(0, transferIndex - 120), transferIndex + 600)
                    .replace(/\s+/g, ' ')
                    .trim()
                : undefined,
          };
          controlHistoryFound = controlHistoryFound || downloadedReport.controlHistoryFound;
        }
        const transactionHistoryReport = page
          .locator('a[href*="/getTransactionHistoryReport.eo?transactionSid="]')
          .first();
        if (await transactionHistoryReport.count()) {
          const transactionDownloadPromise = page.waitForEvent('download', { timeout: 30_000 });
          if (await transactionHistoryReport.isVisible()) {
            await transactionHistoryReport.click({ timeout: 15_000 });
          } else {
            await transactionHistoryReport.dispatchEvent('click');
          }
          await transactionDownloadPromise;
          approvedReportSurfacesDriven.push('Transaction Download History Report');
        }
        transactionsOpened.push({
          ref,
          url: page.url(),
          historyUrl,
          controlHistoryFound,
          historySummary,
          historyResponseKeys,
          historyTables,
          controllerHistory,
          downloadedReport,
          documentMenuState,
          historyControls,
          snapshotElements,
          snapshotResponse: {
            status: snapshotResponse.status(),
            contentType: snapshotResponse.headers()['content-type'] ?? null,
            ...parsedSnapshot,
          },
          note: controlHistoryFound ? 'Control History text present on opened view' : 'opened; no Control History text',
        });
      } catch (err) {
        transactionsOpened.push({ ref, controlHistoryFound: false, note: `open failed: ${err instanceof Error ? err.message : String(err)}` });
      }
      await restoreWorkspaceGrid();
    }
  } catch (err) {
    findings.error = err instanceof Error ? err.message : String(err);
  } finally {
    await Promise.all(targetResponseCaptures);
    findings.transactionsOpened = transactionsOpened;
    findings.transactionAttempts = transactionsOpened.length;
    findings.snapshotsOpened = transactionsOpened.filter((transaction) => transaction.snapshotResponse).length;
    findings.historyReportsOpened = transactionsOpened.filter((transaction) => transaction.historyUrl).length;
    findings.controlHistoryFoundAnywhere = transactionsOpened.some((t) => t.controlHistoryFound);
    findings.reportApiHits = reportApiHits;
    findings.targetContractObservations = targetContractObservations;
    findings.approvedReportSurfacesDriven = approvedReportSurfacesDriven;
    findings.workspaceCalls = workspaceCalls;
    findings.allEoCalls = allEoCalls;
    findings.finishedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_PATH, JSON.stringify(findings, null, 2) + '\n');
    await browser.close();
  }

  console.log('Scan written to', REPORT_PATH);
  console.log('workspaceTableData:', JSON.stringify(findings.workspaceTableData));
  console.log('grid rows rendered:', findings.gridRowsRendered);
  console.log('transaction attempts:', findings.transactionAttempts);
  console.log('snapshots opened:', findings.snapshotsOpened);
  console.log('history reports opened:', findings.historyReportsOpened);
  console.log('Control History found anywhere:', findings.controlHistoryFoundAnywhere);
}

main().catch((err) => {
  console.error('Workspace scan failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

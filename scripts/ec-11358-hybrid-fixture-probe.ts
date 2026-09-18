/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ec-11358-hybrid-fixture-probe.ts
 *
 * Read-only EC-11358 HYBRID fixture discovery. Signs in once, opens Workspace,
 * waits for its Work Queue, and records Authorized/Verification batches plus
 * their read-only batch-detail text. It never creates, approves, cancels,
 * prints, verifies, or otherwise changes a Paper Out request.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT } from '../src/utils/artifact-io.ts';
import { env } from '../src/utils/env.ts';

const REPORT_PATH = path.join(PROJECT_ROOT, 'reports', 'validation', 'EC-11358-hybrid-fixture-probe.json');

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const login = env.requireEcoreLogin();
  const findings: Record<string, unknown> = {
    schemaVersion: '1.0.0',
    reportType: 'HYBRID_FIXTURE_PROBE',
    jiraStoryId: 'EC-11358',
    observedAt: new Date().toISOString(),
    evidenceSource: 'Authenticated scripted Playwright read-only observation.',
    targetTransactionId: '16809591',
    targetDocumentId: '16809592',
  };

  try {
    await page.goto(env.requireBaseUrl(), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    const form = page.locator('#eo_cc_login');
    await form.locator('#loginType').selectOption({ label: 'Organization Login' });
    await form.getByRole('textbox', { name: 'Username' }).fill(login.username);
    await form.getByRole('textbox', { name: 'Organization Name' }).fill(login.organization);
    await form.getByPlaceholder('Password').fill(login.password);
    await form.getByRole('button', { name: 'Sign In' }).click();
    await page.getByRole('link', { name: 'Logout', exact: true }).waitFor({ state: 'visible', timeout: 60_000 });

    const workspaceUrl = new URL('/ssweb/setup/workspace/workspace.eo', env.requireBaseUrl()).toString();
    await page.goto(workspaceUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    // VALIDATED - the application marks Work Queue rows with `tr.batch` and
    // exposes lifecycle state through data attributes; confirmed in the
    // existing WorkQueueComponent against QA5.
    const rows = page.locator('tr.batch');
    await rows.first().waitFor({ state: 'attached', timeout: 30_000 }).catch(() => undefined);
    const batches = await rows.evaluateAll((elements) =>
      elements.map((element) => ({
        batchId: element.getAttribute('data-batch-id') ?? (element.id || null),
        batchName: element.getAttribute('data-batch-name'),
        batchStatus: element.getAttribute('data-batch-status'),
        nextStep: element.getAttribute('data-next-step'),
        text: (element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
      })),
    );

    const authorized = batches.filter(
      (batch) => batch.batchStatus === 'Authorized' && batch.nextStep === 'Verification',
    );
    const batchDetails: Array<Record<string, unknown>> = [];
    for (const batch of authorized) {
      if (typeof batch.batchId !== 'string' || !/^\d+$/.test(batch.batchId)) continue;
      const detailUrl = new URL(
        `/ssweb/setup/workspace/workspaceBatch.eo?batch.id=${encodeURIComponent(batch.batchId)}`,
        env.requireBaseUrl(),
      ).toString();
      await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
      batchDetails.push({
        batchId: batch.batchId,
        batchName: batch.batchName,
        referencesTargetTransaction: text.includes('16809591'),
        referencesTargetDocument: text.includes('16809592'),
        textExcerpt: text.slice(0, 1000),
      });
    }

    findings.batchCount = batches.length;
    findings.authorizedBatchCount = authorized.length;
    findings.authorizedBatches = authorized;
    findings.batchDetails = batchDetails;
  } catch (error) {
    findings.error = error instanceof Error ? error.message : String(error);
    process.exitCode = 1;
  } finally {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(findings, null, 2)}\n`);
    await browser.close();
  }

  console.log(
    JSON.stringify({
      report: 'reports/validation/EC-11358-hybrid-fixture-probe.json',
      batchCount: findings.batchCount ?? null,
      authorizedBatchCount: findings.authorizedBatchCount ?? null,
      error: findings.error ?? null,
    }),
  );
}

main().catch((error: unknown) => {
  console.error('EC-11358 hybrid fixture probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
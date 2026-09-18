/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/ec-11358-document-history-api-probe.ts
 *
 * Observes the approved eoGetDocumentActivityHistoryReport integration action
 * after eoLogin. No undocumented request field is sent. The report records
 * response structure and error codes only; credentials, cookies, messages,
 * identifiers, and raw response values are never written.
 */
import { request } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { EoRequestExportClient } from '../src/api/eo-request-export.client.ts';
import { computeResponseShapeHash, describeResponseShape } from '../src/utils/api-contract-shape.ts';
import { PROJECT_ROOT } from '../src/utils/artifact-io.ts';
import { env } from '../src/utils/env.ts';

const REPORT_PATH = path.join(
  PROJECT_ROOT,
  'reports',
  'validation',
  'EC-11358-document-history-api-probe.json',
);
const SOAP_REQUEST_PATH = path.join(
  PROJECT_ROOT,
  'reports',
  'jira',
  'attachments',
  'eoGetDocumentActivityHistoryReport-request-16809592.xml',
);

function responseStructure(
  xml: string,
  contentType: string | undefined,
  contentDisposition: string | undefined,
  location: string | undefined,
): Record<string, unknown> {
  const responseStatus = xml.match(/<response\b[^>]*\bstatus=["']([^"']*)["']/)?.[1] ?? null;
  const errorCodes = [...xml.matchAll(/<code>([^<]*)<\/code>/g)].map((match) => match[1]);
  const elementNames = [
    ...new Set([...xml.matchAll(/<([A-Za-z][A-Za-z0-9:_-]*)(?:\s|>)/g)].map((match) => match[1])),
  ].sort();
  const contractCandidate = responseStatus === 'ok' ? { status: 'ok' } : { status: responseStatus, errorCodes };
  return {
    responseStatus,
    errorCodes,
    elementNames,
    contentType: contentType ?? null,
    contentDisposition: contentDisposition ?? null,
    hasLocation: location !== undefined,
    byteLength: Buffer.byteLength(xml, 'utf8'),
    isPdf: xml.startsWith('%PDF-'),
    contractShape: describeResponseShape(contractCandidate),
    responseShapeHash: computeResponseShapeHash(contractCandidate),
  };
}

async function main(): Promise<void> {
  const context = await request.newContext({ ignoreHTTPSErrors: true });
  try {
    const client = new EoRequestExportClient(context);
    await client.login();

    const response = await context.post(env.requireEoApiConfig().baseUrl, {
      multipart: { action: 'eoGetDocumentActivityHistoryReport' },
    });
    const structure = responseStructure(
      await response.text(),
      response.headers()['content-type'],
      response.headers()['content-disposition'],
      response.headers().location,
    );
    const soapResponse = await context.post(env.requireEoApiConfig().baseUrl, {
      data: fs.readFileSync(SOAP_REQUEST_PATH, 'utf8'),
      headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
    });
    const soapStructure = responseStructure(
      await soapResponse.text(),
      soapResponse.headers()['content-type'],
      soapResponse.headers()['content-disposition'],
      soapResponse.headers().location,
    );
    const report = {
      schemaVersion: '1.0.0',
      reportType: 'API_CONTRACT_PROBE',
      jiraStoryId: 'EC-11358',
      testPlanId: 'TP-EC-11358-001',
      scenarioId: 'TS-EC-11358-007',
      evidenceSource: 'Authenticated scripted API observation; no undocumented request fields sent.',
      observedAt: new Date().toISOString(),
      observations: [
        {
          request: {
            method: 'POST',
            action: 'eoGetDocumentActivityHistoryReport',
            contentType: 'multipart/form-data',
            additionalFields: [],
          },
          response: {
            httpStatus: response.status(),
            ...structure,
          },
        },
        {
          request: {
            method: 'POST',
            contentType: 'text/xml; charset=UTF-8',
            bodyRef: 'reports/jira/attachments/eoGetDocumentActivityHistoryReport-request-16809592.xml',
            soapActionHeader: null,
          },
          response: {
            httpStatus: soapResponse.status(),
            ...soapStructure,
          },
        },
      ],
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    console.log(
      JSON.stringify({
        report: 'reports/validation/EC-11358-document-history-api-probe.json',
        actionOnly: {
          httpStatus: response.status(),
          responseStatus: structure.responseStatus,
          errorCodes: structure.errorCodes,
        },
        rawSoap: {
          httpStatus: soapResponse.status(),
          responseStatus: soapStructure.responseStatus,
          errorCodes: soapStructure.errorCodes,
        },
      }),
    );
  } finally {
    await context.dispose();
  }
}

main().catch((error: unknown) => {
  console.error('EC-11358 document history API probe failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
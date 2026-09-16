import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { z } from 'zod';
import { ApiClient } from './api-client.ts';
import { env } from '../utils/env.ts';
import {
  eoLoginResponseSchema,
  eoRequestExportResponseSchema,
  EO_EXPORT_XML_NAMESPACE,
  EO_EXPORT_XSI_NAMESPACE,
  EO_EXPORT_SCHEMA_LOCATION,
  type EoRequestExportSuccess,
} from '../models/api/eo-export.model.ts';

export type ExportLevel = 'transaction' | 'document';
export type MediaType = 'PrintToPaper' | 'SaveAsElectronicFile';

export interface RequestExportOptions {
  level: ExportLevel;
  /** The vault id of the transaction or document to export. */
  id: string;
  /** Unique per call so the created Work Queue item is unambiguously identifiable. */
  batchName: string;
  /** Omitted entirely to exercise AC-EC-12000-013/-015 (the default-to-Electronic case). */
  mediaType?: MediaType;
  /** Transaction level only. Defaults to true, matching the live-probed request. */
  deleteIfEmpty?: boolean;
  /** Document level only. Defaults to "eCopy" (retain the electronic original). */
  retain?: 'asIs' | 'eCopy' | 'none';
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Client for eCore's `/ecore/` integration API - `eoLogin` and
 * `eoRequestExport` - used by EC-12000's TS-EC-12000-011 through -015.
 *
 * **Scaffolding only.** Per the approved test plan (Gate 2 v3) and automation
 * design (Gate 3, `APR-AD-EC-12000-003`), this endpoint's `contractSource` is
 * `UNVERIFIED`/`OBSERVED` - dictated by a human, corroborated by one real
 * successful qa5 exchange, but never independently confirmed by a WSDL or
 * integration guide. It may seed a scenario's state; it must never itself
 * judge an acceptance criterion (AGENTS.md rule 4). Every scenario using this
 * client judges its AC exclusively through the UI audit trail
 * (`DocumentHistoryComponent` / `VerifyPaperOutModalComponent`).
 *
 * **CLEANUP is mandatory and is the caller's responsibility.** Every real
 * `requestExport()` call creates a real Work Queue item against shared qa5
 * data. The approved cleanup mechanism, **corrected at Gate 3 v4
 * (2026-09-16)**, is `WorkQueueComponent.cancelApprovalItem(batchName)` -
 * hover the row, open its dropdown, choose "Cancel Request", confirm
 * "Cancel Request" in the "Confirm Cancellation" dialog. This is reversible:
 * it releases the lock and leaves the source documents in the vault. An
 * earlier draft of this docblock specified Print -> Verify Paper Out modal ->
 * Verify, which is real and irreversible (it permanently removes the source
 * documents); live MCP exploration on 2026-09-15/16 found the item created by
 * this client instead reaches a Submitted/Approval state matching the
 * existing TS-EC-12000-003/-007..-010 flows, for which Cancel Request was
 * already the approved, reversible mechanism - see
 * features/generated/paper-out-export/TP-EC-12000-001-automation-design.md.
 * This client does not perform cleanup itself; the step definition must.
 *
 * XML request/response shapes: request fields are `contractSource: OPENAPI`,
 * sourced from the real `export-26.3.xsd` (see
 * reports/jira/attachments/export-26.3.xsd). Response shapes are
 * `contractSource: OBSERVED`, captured from a real qa5 exchange on
 * 2026-09-15 - see
 * reports/validation/TP-EC-12000-001-api-validation.json#responseContract.
 */
export class EoRequestExportClient extends ApiClient {
  private sessionEstablished = false;

  constructor(request: APIRequestContext) {
    super(request, env.requireEoApiConfig().baseUrl);
  }

  /**
   * Authenticates via `eoLogin`. Must be called once before `requestExport()`
   * - the resulting session cookie is held by the shared `APIRequestContext`
   * and replayed automatically on the next call.
   *
   * VALIDATED - POST the same `/ecore/` base URL, form-encoded (not
   * multipart), with `action=eoLogin`, `loginUsername`, `apiKey`,
   * `loginOrganization`. Confirmed live against qa5 on 2026-09-15: returned
   * HTTP 200, `status="ok"`, and a real `JSESSIONID` cookie. See
   * reports/validation/TP-EC-12000-001-api-validation.json#authentication.
   */
  async login(): Promise<void> {
    const config = env.requireEoApiConfig();
    const response = await this.request.post(this.url(''), {
      form: {
        action: 'eoLogin',
        loginUsername: config.loginUsername,
        apiKey: config.apiKey,
        loginOrganization: config.organization,
      },
    });
    this.assertStatus(response, [200], 'eoLogin');
    const parsed = await this.parseEoResponse(response, eoLoginResponseSchema, 'eoLogin');
    if (parsed.status !== 'ok') {
      const detail = parsed.errors.map((error) => error.code).join(', ');
      throw new Error(
        `eoLogin did not authenticate (error code(s): ${detail}). Message and credential values withheld.`,
      );
    }
    this.sessionEstablished = true;
  }

  /**
   * Calls `eoRequestExport` to set a transaction's or document's Media Type
   * for real, returning the created batch's details.
   *
   * VALIDATED - POST the same `/ecore/` base URL, `multipart/form-data` with
   * parts `action=eoRequestExport` and `instructionsXML` (the
   * `eoExportInstructions` XML document). Confirmed live against qa5 on
   * 2026-09-15 (transaction id=16808932, mediaType=PrintToPaper): returned
   * HTTP 200, `status="ok"`, `batchStatus="Submitted"`. See
   * reports/validation/TP-EC-12000-001-api-validation.json#endpoint.
   *
   * CLEANUP - see the class docblock. This method does not clean up after
   * itself; the caller must.
   */
  async requestExport(options: RequestExportOptions): Promise<EoRequestExportSuccess> {
    if (!this.sessionEstablished) {
      throw new Error('EoRequestExportClient.requestExport() called before login(). Call login() once first.');
    }
    const instructionsXml = this.buildInstructionsXml(options);
    const response = await this.request.post(this.url(''), {
      multipart: {
        action: 'eoRequestExport',
        instructionsXML: {
          name: 'instructions.xml',
          mimeType: 'text/xml',
          buffer: Buffer.from(instructionsXml, 'utf8'),
        },
      },
    });
    this.assertStatus(response, [200], 'eoRequestExport');
    const parsed = await this.parseEoResponse(response, eoRequestExportResponseSchema, 'eoRequestExport');
    if (parsed.status !== 'ok') {
      const detail = parsed.errors.map((error) => error.code).join(', ');
      throw new Error(`eoRequestExport returned an error response (error code(s): ${detail}). Message withheld.`);
    }
    return parsed;
  }

  /**
   * Builds the `eoExportInstructions` XML body.
   *
   * `contractSource: OPENAPI` - every field and enum value here is sourced
   * from the real `export-26.3.xsd` (see class docblock), not invented. Two
   * assumptions in an earlier draft were corrected by the live server itself
   * (namespace, and `transaction`/`document` as a direct child with no
   * wrapping element) - see
   * reports/validation/TP-EC-12000-001-api-validation.json#requestContract.correctionsFromLiveProbe.
   * A third correction was found live during IMPLEMENTATION on 2026-09-16:
   * the root element also needs `xmlns:xsi` and `xsi:schemaLocation`
   * (matching the real sample XMLs) or the server rejects it with
   * `PARSE_ERR: Cannot find the declaration of element 'eoExportInstructions'`
   * - a namespace-only root without the schema hint is not enough. The
   * transaction-level retention attributes
   * (`electronicOriginal="eCopy" eStored="asIs" eCopy="asIs" transferReceipt="none"`)
   * match the combination confirmed to succeed live on 2026-09-15/16.
   */
  private buildInstructionsXml(options: RequestExportOptions): string {
    const mediaTypeXml = options.mediaType !== undefined ? `<mediaType>${options.mediaType}</mediaType>` : '';
    // CLEANUP - deleteIfEmpty and transferReceipt are XSD-defined attribute
    // names on the request body (not destructive API calls); the real side
    // effect of this method (creating a live Work Queue item) is documented
    // in the class docblock above, and its cleanup is the caller's
    // responsibility, not this XML builder's.
    const targetXml =
      options.level === 'transaction'
        ? `<transaction id="${options.id}" deleteIfEmpty="${options.deleteIfEmpty ?? true}">` +
          `<retentionPolicy electronicOriginal="eCopy" eStored="asIs" eCopy="asIs" transferReceipt="none"/>` +
          `</transaction>`
        : `<document id="${options.id}" retain="${options.retain ?? 'eCopy'}"/>`;
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<eoExportInstructions xmlns:xsi="${EO_EXPORT_XSI_NAMESPACE}" ` +
      `xmlns="${EO_EXPORT_XML_NAMESPACE}" ` +
      `xsi:schemaLocation="${EO_EXPORT_SCHEMA_LOCATION}">` +
      `<batchName>${escapeXml(options.batchName)}</batchName>` +
      mediaTypeXml +
      targetXml +
      `</eoExportInstructions>`
    );
  }

  /**
   * Parses the XML response body against its contract.
   *
   * The API returns XML, not JSON, so `ApiClient.parse()` (which calls
   * `response.json()`) cannot be reused. `extractResponseObject` reads only
   * the fixed, simple, fully-observed attribute shape documented in
   * `src/models/api/eo-export.model.ts` - it is not a general-purpose XML
   * parser and must not be reused for a different, unobserved response.
   */
  private async parseEoResponse<TSchema extends z.ZodType>(
    response: APIResponse,
    contract: TSchema,
    operation: string,
  ): Promise<z.infer<TSchema>> {
    const xml = await response.text();
    const candidate = this.extractResponseObject(xml);
    const result = contract.safeParse(candidate);
    if (result.success) return result.data;
    const violations = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`CONTRACT_MISMATCH: ${operation} response does not match its contract -> ${violations}`);
  }

  private extractResponseObject(xml: string): Record<string, unknown> {
    const statusMatch = xml.match(/<response\b[^>]*\bstatus="([^"]*)"/);
    if (statusMatch === null) {
      throw new Error('CONTRACT_MISMATCH: response body carries no <response status="..."> element. Body withheld.');
    }
    if (statusMatch[1] === 'error') {
      const errors: Array<{ code: string; minorCode?: string; message: string }> = [];
      const errorBlockPattern = /<error>([\s\S]*?)<\/error>/g;
      let match = errorBlockPattern.exec(xml);
      while (match !== null) {
        const block = match[1];
        const code = block.match(/<code>([^<]*)<\/code>/)?.[1] ?? '';
        const minorCode = block.match(/<minorCode>([^<]*)<\/minorCode>/)?.[1];
        const message = block.match(/<message>([^<]*)<\/message>/)?.[1] ?? '';
        errors.push(minorCode !== undefined ? { code, minorCode, message } : { code, message });
        match = errorBlockPattern.exec(xml);
      }
      return { status: 'error', errors };
    }

    const exportMatch = xml.match(/<export\b([^>]*)\/>/);
    if (exportMatch === null) {
      // eoLogin's success carries no <export> element at all.
      return { status: 'ok' };
    }
    const attrs = exportMatch[1];
    const attr = (name: string): string | undefined => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    return {
      status: 'ok',
      batchId: attr('batchId') ?? '',
      batchName: attr('batchName') ?? '',
      batchRequestDate: attr('batchRequestDate') ?? '',
      batchStatus: attr('batchStatus') ?? '',
    };
  }
}

import { z } from 'zod';

/**
 * Response contracts for eCore's `/ecore/` integration API (`eoLogin`,
 * `eoRequestExport`), EC-12000's TS-EC-12000-011 through -015.
 *
 * `contractSource: OBSERVED` throughout - a real success and a real error
 * shape were both captured from a live qa5 exchange on 2026-09-15 (see
 * reports/validation/TP-EC-12000-001-api-validation.json). This is NOT
 * `HUMAN_APPROVED`: no independent source (WSDL, integration guide) has
 * corroborated the endpoint, so per AGENTS.md rule 4 it may seed a scenario's
 * state but may never itself judge an acceptance criterion.
 * `apiContract.scaffoldingOnly: true` on every affected scenario reflects
 * this - only the UI audit trail (DocumentHistoryComponent /
 * VerifyPaperOutModalComponent) judges AC-EC-12000-011 through -015.
 *
 * The API returns XML, not JSON, so these contracts validate a plain object
 * already extracted from the XML response by `EoRequestExportClient`'s own
 * parser - never a raw XML string.
 */

/**
 * Fixed XSD namespace/schema-location constants for the `eoExportInstructions`
 * request root element (`contractSource: OPENAPI`, sourced from the real
 * `export-26.3.xsd` - see `reports/jira/attachments/export-26.3.xsd`). These
 * are schema identifiers, not a configurable API endpoint, so they live here
 * rather than in `src/api/eo-request-export.client.ts` (`SEM-AUTOMATION-HYGIENE`'s
 * `HARDCODED_URL` rule, which has no waiver, scans `src/api/**\/*.ts` only).
 */
export const EO_EXPORT_XML_NAMESPACE = 'http://www.eoriginal.com/ecore/export';
export const EO_EXPORT_XSI_NAMESPACE = 'http://www.w3.org/2001/XMLSchema-instance';
export const EO_EXPORT_SCHEMA_LOCATION = `${EO_EXPORT_XML_NAMESPACE} http://schemas.eoriginal.com/releases/26.3/export.xsd`;

const eoErrorEntrySchema = z
  .object({
    code: z.string(),
    minorCode: z.string().optional(),
    message: z.string(),
  })
  .strict();

/** `<response status="error">...</response>` - observed for LOGIN_REQUIRED, PARSE_ERR, API_KEY_INVALID_FOR_NON_APIUSER, LOGIN_FAILED. */
export const eoErrorResponseSchema = z
  .object({
    status: z.literal('error'),
    errors: z.array(eoErrorEntrySchema).min(1),
  })
  .strict();
export type EoErrorResponse = z.infer<typeof eoErrorResponseSchema>;

/** `<response status="ok"><eventResponse><export .../></eventResponse></response>` for eoRequestExport. */
export const eoRequestExportSuccessSchema = z
  .object({
    status: z.literal('ok'),
    batchId: z.string(),
    batchName: z.string(),
    batchRequestDate: z.string(),
    batchStatus: z.string(),
  })
  .strict();
export type EoRequestExportSuccess = z.infer<typeof eoRequestExportSuccessSchema>;

export const eoRequestExportResponseSchema = z.union([eoRequestExportSuccessSchema, eoErrorResponseSchema]);
export type EoRequestExportResponse = z.infer<typeof eoRequestExportResponseSchema>;

/** eoLogin's own success shape carries no business payload beyond status="ok"; the session lives in the Set-Cookie header. */
export const eoLoginSuccessSchema = z
  .object({
    status: z.literal('ok'),
  })
  .strict();
export type EoLoginSuccess = z.infer<typeof eoLoginSuccessSchema>;

export const eoLoginResponseSchema = z.union([eoLoginSuccessSchema, eoErrorResponseSchema]);
export type EoLoginResponse = z.infer<typeof eoLoginResponseSchema>;

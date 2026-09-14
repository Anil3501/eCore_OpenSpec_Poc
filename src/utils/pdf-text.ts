/**
 * Plain-text extraction from a downloaded PDF buffer.
 *
 * AC-EC-12000-016's activity-history-report assertion, and the Verify Paper
 * Out package download it shares a mechanism with, both render their content
 * as a real PDF - the audit-trail text is FlateDecode-compressed inside the
 * file, so a plain string search on the raw bytes never finds it (confirmed
 * live 2026-09-14; a naive byte search returned nothing even though the text
 * was present). A real parser is mandatory, so this wraps it in one place
 * rather than have every caller learn the same lesson.
 *
 * `pdf-parse@2.x` exposes a class-based API, not the classic v1
 * function-call one (`pdfParse(buffer)` throws `TypeError: pdfParse is not a
 * function` against this version). Its named export also loads correctly
 * through a plain ESM `import` - it is not the CJS-named-export trap this
 * repo otherwise has to guard against - confirmed by executing it directly
 * with `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON` before this file
 * was written.
 */
import { PDFParse } from 'pdf-parse';

/** Extracts the plain text of every page of a PDF, concatenated in order. */
export async function extractPdfText(data: Buffer): Promise<string> {
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

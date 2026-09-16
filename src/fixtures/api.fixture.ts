import { request as playwrightRequest, type APIRequestContext, type BrowserContext } from '@playwright/test';
import { env } from '../utils/env.ts';
import { EoRequestExportClient } from '../api/eo-request-export.client.ts';

/**
 * The transaction/document reached for TS-EC-12000-011 through -015 and the
 * unique batch name(s) their eoRequestExport call(s) create.
 */
export interface HybridExportContext {
  transactionId?: string;
  documentId?: string;
  transactionBatchName?: string;
  documentBatchName?: string;
  transactionCollectionName?: string;
  documentCollectionName?: string;
}

export interface ApiFixtures {
  /**
   * API request context for @interface-api and @interface-hybrid scenarios.
   *
   * Created lazily: a UI-only scenario never touches it, so a repository with no
   * API_BASE_URL configured still runs exactly as it does today.
   */
  apiRequest: APIRequestContext;
  /**
   * EC-12000's TS-EC-12000-011 through -015 (HYBRID). A dedicated
   * APIRequestContext against ECORE_API_BASE_URL, distinct from `apiRequest`.
   */
  eoExportApi: EoRequestExportClient;
  hybridExportContext: HybridExportContext;
}

export const apiFixture = {
  apiRequest: async ({ context }: { context: BrowserContext }, use: (ctx: APIRequestContext) => Promise<void>) => {
    const api = env.requireApiConfig();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (api.authMode === 'BEARER') headers.Authorization = `Bearer ${api.authToken}`;
    if (api.authMode === 'BASIC') headers.Authorization = `Basic ${api.authToken}`;

    const storageState = api.authMode === 'SESSION_COOKIE' ? await context.storageState() : undefined;

    const apiContext = await playwrightRequest.newContext({
      baseURL: api.baseUrl,
      extraHTTPHeaders: headers,
      storageState,
    });
    await use(apiContext);
    await apiContext.dispose();
  },

  // eslint-disable-next-line no-empty-pattern
  eoExportApi: async ({}, use: (client: EoRequestExportClient) => Promise<void>) => {
    const config = env.requireEoApiConfig();
    const apiContext = await playwrightRequest.newContext({ baseURL: config.baseUrl });
    const client = new EoRequestExportClient(apiContext);
    await client.login();
    await use(client);
    await apiContext.dispose();
  },

  // eslint-disable-next-line no-empty-pattern
  hybridExportContext: async ({}, use: (ctx: HybridExportContext) => Promise<void>) => {
    await use({});
  },
};

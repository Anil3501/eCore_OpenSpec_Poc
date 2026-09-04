import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { z } from 'zod';
import { env } from '../utils/env.ts';

/**
 * Base for every capability API client.
 *
 * An API client is the API's page object: it owns endpoints and headers the way
 * a page object owns locators, and nothing above it may know a URL or a status
 * code. Steps call a client; they never touch `request` directly.
 *
 * Two rules are enforced here rather than left to a reviewer:
 *
 * 1. A response is parsed against its whole Zod contract, never spot-checked.
 *    Asserting three fields and ignoring forty is the API equivalent of a test
 *    that passes because it never looked.
 * 2. An unexpected status fails with the status alone. Response bodies are not
 *    interpolated into error messages, because an error body can carry the very
 *    token or personal data the framework is not allowed to log.
 */
export abstract class ApiClient {
  protected readonly request: APIRequestContext;
  private readonly baseUrl: string;

  constructor(request: APIRequestContext) {
    this.request = request;
    this.baseUrl = env.requireApiConfig().baseUrl;
  }

  /** Joins a contract path onto the configured base, preserving any path prefix. */
  protected url(path: string): string {
    return new URL(path.replace(/^\//, ''), this.baseUrl.endsWith('/') ? this.baseUrl : `${this.baseUrl}/`).toString();
  }

  /**
   * Asserts the status is one the approved contract declares.
   *
   * `expected` comes from the test plan's `apiContract.expectedStatusCodes`, so
   * an undeclared status is a contract violation rather than a surprise the
   * client silently tolerates.
   */
  protected assertStatus(response: APIResponse, expected: readonly number[], operation: string): void {
    if (expected.includes(response.status())) return;
    throw new Error(
      `CONTRACT_MISMATCH: ${operation} returned ${response.status()}; the approved contract declares ` +
        `${expected.join(', ')}. Response body withheld - it may contain credentials or personal data.`,
    );
  }

  /** Parses the full response body against its contract. */
  protected async parse<TSchema extends z.ZodType>(
    response: APIResponse,
    contract: TSchema,
    operation: string,
  ): Promise<z.infer<TSchema>> {
    const body: unknown = await response.json();
    const result = contract.safeParse(body);
    if (result.success) return result.data;

    // Field paths and rule messages only. Values stay out of the report.
    const violations = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`CONTRACT_MISMATCH: ${operation} response does not match its contract -> ${violations}`);
  }
}

/**
 * Usage: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/api-layer-probe.ts
 *
 * Proves the API layer actually executes. `npm run typecheck` cannot do this:
 * files here run as ESM under Node 24 type-stripping, so a CommonJS interop
 * failure typechecks cleanly and then throws at runtime. Until something calls
 * it, `src/api/api-client.ts` is unverified code.
 *
 * It also verifies the two claims the client makes about secrets - that an
 * unexpected status reports the status alone, and that a contract violation
 * reports field paths alone. Those are promises about redaction, and a promise
 * nothing checks is a promise waiting to be broken.
 *
 * Runs against a loopback server this script starts and stops itself: no eCore
 * traffic, no credentials, no failed-attempt lockout risk, and deterministic
 * responses so both the success and violation paths can be forced. It proves
 * the plumbing, never the behaviour of the application under test.
 */
import http from 'node:http';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import { request } from '@playwright/test';
import { z } from 'zod';

const REPORT_DIR = 'reports/validation';
const REPORT_PATH = `${REPORT_DIR}/api-layer-probe.json`;

/** Planted in every stub response so a leak into an error message is detectable. */
const CANARY = 'CANARY-SECRET-MUST-NOT-APPEAR';

interface Check {
  name: string;
  passed: boolean;
  detail: string;
}

function startStubServer(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    const url = req.url ?? '';
    res.setHeader('content-type', 'application/json');

    if (url === '/api/v1/health') {
      res.statusCode = 200;
      res.end(JSON.stringify({ status: 'ok', version: '1.0.0' }));
      return;
    }
    if (url === '/api/v1/teapot') {
      res.statusCode = 418;
      res.end(JSON.stringify({ message: CANARY }));
      return;
    }
    if (url === '/api/v1/malformed') {
      res.statusCode = 200;
      res.end(JSON.stringify({ status: CANARY, version: 12345 }));
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'not found' }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function main(): Promise<void> {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const checks: Check[] = [];
  const record = (name: string, passed: boolean, detail: string): void => {
    checks.push({ name, passed, detail });
  };

  const server = await startStubServer();
  const { port } = server.address() as AddressInfo;

  // Path prefix and no trailing slash, so url() is exercised on the branch that
  // silently drops the prefix if the join is written with a plain concatenation.
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  // Set before importing env.ts: dotenv does not override an existing value, so
  // this cannot disturb a real .env, and the import must follow the assignment.
  process.env.API_BASE_URL = baseUrl;
  process.env.API_AUTH_MODE = 'NONE';

  let exitCode = 0;
  try {
    const { env } = await import('../src/utils/env.ts');
    const { ApiClient } = await import('../src/api/api-client.ts');
    record('MODULE_LOADS_AS_ESM', true, 'env.ts and api-client.ts imported without an interop error.');

    const config = env.requireApiConfig();
    record(
      'ENV_RESOLVES_API_CONFIG',
      config.baseUrl === baseUrl && config.authMode === 'NONE',
      `requireApiConfig() returned authMode ${config.authMode} and the configured base URL.`,
    );

    const healthContract = z.object({ status: z.literal('ok'), version: z.string() });

    class ProbeClient extends ApiClient {
      resolve(path: string): string {
        return this.url(path);
      }
      async get(path: string, expected: readonly number[], operation: string) {
        const response = await this.request.get(this.url(path));
        this.assertStatus(response, expected, operation);
        return this.parse(response, healthContract, operation);
      }
      async getUnparsed(path: string, expected: readonly number[], operation: string): Promise<void> {
        const response = await this.request.get(this.url(path));
        this.assertStatus(response, expected, operation);
      }
    }

    const context = await request.newContext();
    const client = new ProbeClient(context);

    try {
      record(
        'URL_PRESERVES_PATH_PREFIX',
        client.resolve('/health') === `${baseUrl}/health`,
        `url('/health') resolved to ${client.resolve('/health')}`,
      );

      const body = await client.get('/health', [200], 'health check');
      record(
        'ROUND_TRIP_AND_CONTRACT_PARSE',
        body.status === 'ok' && body.version === '1.0.0',
        'A real HTTP GET through APIRequestContext parsed against its full Zod contract.',
      );

      // Undeclared status must fail, and must not echo the response body.
      let statusError: Error | undefined;
      try {
        await client.getUnparsed('/teapot', [200], 'teapot call');
      } catch (error) {
        statusError = error as Error;
      }
      const statusMessage = statusError?.message ?? '';
      record(
        'UNDECLARED_STATUS_REJECTED',
        statusMessage.includes('CONTRACT_MISMATCH') && statusMessage.includes('418'),
        statusError ? 'assertStatus threw CONTRACT_MISMATCH naming the status.' : 'assertStatus did NOT throw.',
      );
      record(
        'STATUS_ERROR_WITHHOLDS_BODY',
        statusError !== undefined && !statusMessage.includes(CANARY),
        'Response body stayed out of the status-mismatch error message.',
      );

      // Whole-body parsing must fail, reporting field paths but no values.
      let contractError: Error | undefined;
      try {
        await client.get('/malformed', [200], 'malformed call');
      } catch (error) {
        contractError = error as Error;
      }
      const contractMessage = contractError?.message ?? '';
      record(
        'CONTRACT_VIOLATION_REJECTED',
        contractMessage.includes('CONTRACT_MISMATCH') &&
          contractMessage.includes('status') &&
          contractMessage.includes('version'),
        contractError
          ? 'parse() reported every violating field path, not just the first.'
          : 'parse() did NOT throw on a malformed body.',
      );
      record(
        'CONTRACT_ERROR_WITHHOLDS_VALUES',
        contractError !== undefined && !contractMessage.includes(CANARY),
        'Rejected field values stayed out of the contract-violation error message.',
      );
    } finally {
      await context.dispose();
    }
  } catch (error) {
    record('PROBE_COMPLETED', false, `Unhandled failure: ${(error as Error).message}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  const failed = checks.filter((check) => !check.passed);
  exitCode = failed.length === 0 ? 0 : 1;

  fs.writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        probe: 'api-layer',
        startedAt: new Date().toISOString(),
        scope:
          'Plumbing only, against a loopback stub server. Proves the API client executes, joins ' +
          'URLs, enforces declared status codes, parses whole contracts and withholds secrets. ' +
          'It observes nothing about the application under test and is not evidence for any ' +
          'acceptance criterion.',
        notCovered: [
          'The apiRequest fixture, which needs a browser context and is exercised by a real run.',
          'BEARER, BASIC and SESSION_COOKIE auth modes.',
        ],
        result: failed.length === 0 ? 'PASSED' : 'FAILED',
        checks,
      },
      null,
      2,
    )}\n`,
  );

  for (const check of checks) {
    console.log(`${check.passed ? 'PASS' : 'FAIL'}  ${check.name} - ${check.detail}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed. Report: ${REPORT_PATH}`);
  process.exitCode = exitCode;
}

await main();

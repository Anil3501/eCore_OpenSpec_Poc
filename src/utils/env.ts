/**
 * Centralized, typed environment loader.
 *
 * Rules enforced here:
 * - `.env` is the only runtime source of developer-specific configuration.
 * - Secret values are never printed, logged, or embedded in error messages.
 * - Scaffolding never fails when PLAYWRIGHT_BASE_URL / TEST_USERNAME /
 *   TEST_PASSWORD are empty. Those are required lazily, only at the point of
 *   browser execution or authenticated scenarios.
 * - Page objects, fixtures and step definitions must import from this module
 *   instead of reading `process.env` directly.
 */
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ path: path.resolve(process.cwd(), '.env'), quiet: true });

export const TEST_ENVIRONMENTS = ['local', 'dev', 'qa', 'uat', 'staging'] as const;
export type TestEnvironment = (typeof TEST_ENVIRONMENTS)[number];

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);
const FALSE_VALUES = new Set(['false', '0', 'no', 'off']);

const optionalTrimmed = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined || value === '' ? undefined : value));

/** Builds a boolean-compatible parser that falls back to `fallback` when unset. */
function booleanCompatible(variableName: string, fallback: boolean) {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === undefined ? '' : value.toLowerCase()))
    .superRefine((value, ctx) => {
      if (value === '') return;
      if (!TRUE_VALUES.has(value) && !FALSE_VALUES.has(value)) {
        ctx.addIssue({
          code: 'custom',
          message: `${variableName} must be a boolean-compatible value (true/false/1/0/yes/no/on/off) or empty.`,
        });
      }
    })
    .transform((value) => (value === '' ? fallback : TRUE_VALUES.has(value)));
}

const environmentSchema = z.object({
  PLAYWRIGHT_BASE_URL: optionalTrimmed,
  TEST_ENVIRONMENT: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === undefined || value === '' ? 'qa' : value.toLowerCase()))
    .pipe(z.enum(TEST_ENVIRONMENTS)),
  HEADLESS: booleanCompatible('HEADLESS', true),
  // On by default: the execution report and the coverage report are produced by
  // the same run, so no second command is ever needed to see coverage.
  COVERAGE_ENABLED: booleanCompatible('COVERAGE_ENABLED', true),
  COVERAGE_INCLUDE_THIRD_PARTY: booleanCompatible('COVERAGE_INCLUDE_THIRD_PARTY', false),
  TEST_USERNAME: optionalTrimmed,
  TEST_PASSWORD: optionalTrimmed,
  ECORE_LOGIN_TYPE: optionalTrimmed,
  ECORE_USERNAME: optionalTrimmed,
  ECORE_ORGANIZATION: optionalTrimmed,
  ECORE_ORGANIZATION_ID: optionalTrimmed,
  ECORE_PASSWORD: optionalTrimmed,
  JIRA_URL: optionalTrimmed,
  JIRA_EMAIL: optionalTrimmed,
  JIRA_API_TOKEN: optionalTrimmed,
  JIRA_PROJECT_KEY: optionalTrimmed,
  JIRA_BUG_PROJECT_KEY: optionalTrimmed,
  JIRA_BUG_ISSUE_TYPE: optionalTrimmed,
  JIRA_BUG_ASSIGNEE_ACCOUNT_ID: optionalTrimmed,
  JIRA_BUG_LINK_TYPE: optionalTrimmed,
  // Kill-switch. A trace.zip can embed request headers and form values, so a
  // team that does not trust its Jira project can turn attachment off entirely.
  BUG_ATTACH_TRACE: booleanCompatible('BUG_ATTACH_TRACE', true),
});

const parsed = environmentSchema.safeParse({
  PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL,
  TEST_ENVIRONMENT: process.env.TEST_ENVIRONMENT,
  HEADLESS: process.env.HEADLESS,
  COVERAGE_ENABLED: process.env.COVERAGE_ENABLED,
  COVERAGE_INCLUDE_THIRD_PARTY: process.env.COVERAGE_INCLUDE_THIRD_PARTY,
  TEST_USERNAME: process.env.TEST_USERNAME,
  TEST_PASSWORD: process.env.TEST_PASSWORD,
  ECORE_LOGIN_TYPE: process.env.ECORE_LOGIN_TYPE,
  ECORE_USERNAME: process.env.ECORE_USERNAME,
  ECORE_ORGANIZATION: process.env.ECORE_ORGANIZATION,
  ECORE_ORGANIZATION_ID: process.env.ECORE_ORGANIZATION_ID,
  ECORE_PASSWORD: process.env.ECORE_PASSWORD,
  JIRA_URL: process.env.JIRA_URL,
  JIRA_EMAIL: process.env.JIRA_EMAIL,
  JIRA_API_TOKEN: process.env.JIRA_API_TOKEN,
  JIRA_PROJECT_KEY: process.env.JIRA_PROJECT_KEY,
  JIRA_BUG_PROJECT_KEY: process.env.JIRA_BUG_PROJECT_KEY,
  JIRA_BUG_ISSUE_TYPE: process.env.JIRA_BUG_ISSUE_TYPE,
  JIRA_BUG_ASSIGNEE_ACCOUNT_ID: process.env.JIRA_BUG_ASSIGNEE_ACCOUNT_ID,
  JIRA_BUG_LINK_TYPE: process.env.JIRA_BUG_LINK_TYPE,
  BUG_ATTACH_TRACE: process.env.BUG_ATTACH_TRACE,
});

if (!parsed.success) {
  // Only variable names and rule descriptions are surfaced - never values.
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration in .env -> ${details}`);
}

const values = parsed.data;

export interface Credentials {
  username: string;
  password: string;
}

/** Full login payload required by the eCore application login page. */
export interface EcoreLogin {
  loginType: string;
  username: string;
  organization: string;
  organizationId: string;
  password: string;
}

/**
 * Jira REST configuration.
 *
 * The configured Atlassian MCP server authenticates with interactive OAuth and
 * does NOT use this token. These values exist only for a direct REST fallback.
 */
export interface JiraConfig {
  url: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

/**
 * Jira bug-filing configuration used by the bug-analyzer agent.
 *
 * `fixVersions` is deliberately absent: it is read verbatim off the story under
 * test and must never be supplied from configuration, because a wrong fix
 * version is indistinguishable from an invented one.
 */
export interface JiraBugConfig {
  /** Falls back to JIRA_PROJECT_KEY when a dedicated bug project is not used. */
  projectKey: string;
  issueType: string;
  assigneeAccountId: string;
  linkType: string;
  /** When false, trace.zip is withheld and the defect records that fact. */
  attachTrace: boolean;
}

/**
 * Browser code-coverage settings.
 *
 * This is JavaScript coverage of the *application under test*, captured from
 * Chromium's V8 coverage API. It is unrelated to - and is never a substitute
 * for - the governed requirement coverage tracked in `traceability/`.
 */
export interface CoverageSettings {
  /** On by default. Set COVERAGE_ENABLED=false to make the fixture a no-op. */
  readonly enabled: boolean;
  /** When false, only scripts served from the base URL origin are recorded. */
  readonly includeThirdParty: boolean;
}

export interface FrameworkEnvironment {
  readonly testEnvironment: TestEnvironment;
  readonly headless: boolean;
  /** Present only when configured. Never assume it exists during scaffolding. */
  readonly baseUrl: string | undefined;
  readonly hasBaseUrl: boolean;
  readonly hasCredentials: boolean;
  readonly hasEcoreLogin: boolean;
  readonly hasJiraConfig: boolean;
  readonly hasJiraBugConfig: boolean;
  readonly coverage: CoverageSettings;
  /** Required lazily, at the point browser execution starts. */
  requireBaseUrl(): string;
  /** Required lazily, only for username-and-password scenarios. */
  requireCredentials(): Credentials;
  /** Required lazily, only for the eCore organization login form. */
  requireEcoreLogin(): EcoreLogin;
  /** Required lazily, only by a direct Jira REST fallback. */
  requireJiraConfig(): JiraConfig;
  /** Required lazily, only when the bug-analyzer files a defect in Jira. */
  requireJiraBugConfig(): JiraBugConfig;
  /** Secret-free description, safe to log or embed in reports. */
  describe(): Record<string, string | boolean>;
}

const hasBaseUrl = values.PLAYWRIGHT_BASE_URL !== undefined;

// Generic credentials fall back to the eCore values so a credential is stored
// exactly once in .env instead of being duplicated.
const resolvedUsername = values.TEST_USERNAME ?? values.ECORE_USERNAME;
const resolvedPassword = values.TEST_PASSWORD ?? values.ECORE_PASSWORD;
const hasCredentials = resolvedUsername !== undefined && resolvedPassword !== undefined;

const ECORE_KEYS = [
  'ECORE_LOGIN_TYPE',
  'ECORE_USERNAME',
  'ECORE_ORGANIZATION',
  'ECORE_ORGANIZATION_ID',
  'ECORE_PASSWORD',
] as const;
const JIRA_KEYS = ['JIRA_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'] as const;

const hasEcoreLogin = ECORE_KEYS.every((key) => values[key] !== undefined);
const hasJiraConfig = JIRA_KEYS.every((key) => values[key] !== undefined);

// The bug project falls back to the story project; only the assignee is truly
// mandatory, because a bug nobody owns is a bug nobody reviews.
const resolvedBugProjectKey = values.JIRA_BUG_PROJECT_KEY ?? values.JIRA_PROJECT_KEY;
const hasJiraBugConfig =
  resolvedBugProjectKey !== undefined && values.JIRA_BUG_ASSIGNEE_ACCOUNT_ID !== undefined;

/** Builds a missing-variable error that names keys only, never values. */
function missingError(keys: readonly string[], purpose: string): Error {
  const missing = keys.filter((key) => values[key as keyof typeof values] === undefined);
  return new Error(
    `Missing configuration for ${purpose}: ${missing.join(', ')}. ` +
      'Set them in your local .env (see .env.example). Values are never logged.',
  );
}

export const env: FrameworkEnvironment = {
  testEnvironment: values.TEST_ENVIRONMENT,
  headless: values.HEADLESS,
  baseUrl: values.PLAYWRIGHT_BASE_URL,
  hasBaseUrl,
  hasCredentials,
  hasEcoreLogin,
  hasJiraConfig,
  hasJiraBugConfig,
  coverage: {
    enabled: values.COVERAGE_ENABLED,
    includeThirdParty: values.COVERAGE_INCLUDE_THIRD_PARTY,
  },

  requireBaseUrl(): string {
    if (!hasBaseUrl) {
      throw new Error(
        'PLAYWRIGHT_BASE_URL is not set. Browser execution is BLOCKED. ' +
          'Set PLAYWRIGHT_BASE_URL in your local .env (see .env.example).',
      );
    }
    return values.PLAYWRIGHT_BASE_URL as string;
  },

  requireCredentials(): Credentials {
    if (!hasCredentials) {
      throw new Error(
        'Missing credentials for an authenticated scenario. Set TEST_USERNAME and ' +
          'TEST_PASSWORD, or ECORE_USERNAME and ECORE_PASSWORD, in your local .env ' +
          '(see .env.example). Values are never logged.',
      );
    }
    return {
      username: resolvedUsername as string,
      password: resolvedPassword as string,
    };
  },

  requireEcoreLogin(): EcoreLogin {
    if (!hasEcoreLogin) {
      throw missingError(ECORE_KEYS, 'the eCore application login');
    }
    return {
      loginType: values.ECORE_LOGIN_TYPE as string,
      username: values.ECORE_USERNAME as string,
      organization: values.ECORE_ORGANIZATION as string,
      organizationId: values.ECORE_ORGANIZATION_ID as string,
      password: values.ECORE_PASSWORD as string,
    };
  },

  requireJiraConfig(): JiraConfig {
    if (!hasJiraConfig) {
      throw missingError(JIRA_KEYS, 'the Jira REST fallback');
    }
    return {
      url: values.JIRA_URL as string,
      email: values.JIRA_EMAIL as string,
      apiToken: values.JIRA_API_TOKEN as string,
      projectKey: values.JIRA_PROJECT_KEY as string,
    };
  },

  requireJiraBugConfig(): JiraBugConfig {
    if (!hasJiraBugConfig) {
      const missing: string[] = [];
      if (resolvedBugProjectKey === undefined) missing.push('JIRA_BUG_PROJECT_KEY (or JIRA_PROJECT_KEY)');
      if (values.JIRA_BUG_ASSIGNEE_ACCOUNT_ID === undefined) missing.push('JIRA_BUG_ASSIGNEE_ACCOUNT_ID');
      throw new Error(
        `Missing configuration for filing a Jira bug: ${missing.join(', ')}. ` +
          'Set them in your local .env (see .env.example). Values are never logged.',
      );
    }
    return {
      projectKey: resolvedBugProjectKey as string,
      issueType: values.JIRA_BUG_ISSUE_TYPE ?? 'Bug',
      assigneeAccountId: values.JIRA_BUG_ASSIGNEE_ACCOUNT_ID as string,
      linkType: values.JIRA_BUG_LINK_TYPE ?? 'Relates',
      attachTrace: values.BUG_ATTACH_TRACE,
    };
  },

  describe(): Record<string, string | boolean> {
    return {
      testEnvironment: values.TEST_ENVIRONMENT,
      headless: values.HEADLESS,
      baseUrlConfigured: hasBaseUrl,
      credentialsConfigured: hasCredentials,
      ecoreLoginConfigured: hasEcoreLogin,
      jiraConfigured: hasJiraConfig,
      jiraBugFilingConfigured: hasJiraBugConfig,
      coverageEnabled: values.COVERAGE_ENABLED,
      coverageIncludesThirdParty: values.COVERAGE_INCLUDE_THIRD_PARTY,
      jiraProjectKey: values.JIRA_PROJECT_KEY ?? '(not set)',
      jiraBugProjectKey: resolvedBugProjectKey ?? '(not set)',
      jiraBugIssueType: values.JIRA_BUG_ISSUE_TYPE ?? 'Bug',
      jiraBugLinkType: values.JIRA_BUG_LINK_TYPE ?? 'Relates',
      bugAttachTrace: values.BUG_ATTACH_TRACE,
    };
  },
};

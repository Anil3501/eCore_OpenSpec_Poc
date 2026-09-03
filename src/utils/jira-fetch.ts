/**
 * Jira issue retrieval for the JIRA_RETRIEVAL workflow stage.
 *
 * Usage:
 *   node src/utils/jira-fetch.ts <ISSUE-KEY>
 *
 * The Atlassian MCP server is the primary Jira access path for this framework.
 * This script is the documented REST fallback described in .env.example, for
 * sessions where the MCP server exposes no issue-fetch tool. It retrieves the
 * issue verbatim so that a human or the requirement-analysis agent can promote
 * it into the governed `requirements/raw/` snapshot.
 *
 * It writes to reports/ only. It never writes a governed artifact, never
 * interprets the story, and never invents a field. Credentials are read through
 * src/utils/env.ts and are never logged, never written to disk and never placed
 * in a URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_ROOT, toRelative } from './artifact-io.ts';
import { env } from './env.ts';

const OUTPUT_DIR = 'reports/jira';

/** Jira issue keys are `PROJECT-123`. Anything else is rejected before it reaches a path or a URL. */
const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]*-\d+$/;

function parseIssueKey(value: string | undefined): string {
  if (value === undefined) {
    throw new Error('No issue key supplied. Usage: node src/utils/jira-fetch.ts <ISSUE-KEY>');
  }
  const key = value.trim().toUpperCase();
  if (!ISSUE_KEY_PATTERN.test(key)) {
    throw new Error(`"${value}" is not a valid Jira issue key. Expected a form such as ETA-351.`);
  }
  return key;
}

/**
 * Builds the request URL from operator-supplied configuration.
 * Enforces https so a misconfigured JIRA_URL cannot send Basic credentials in clear text.
 */
function buildIssueUrl(baseUrl: string, issueKey: string): URL {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new Error('JIRA_URL is not a valid URL. Fix it in your local .env (see .env.example).');
  }
  if (base.protocol !== 'https:') {
    throw new Error(
      `JIRA_URL must use https, found "${base.protocol}". Basic authentication over plain http ` +
        'would expose the API token in transit.',
    );
  }
  const url = new URL(`/rest/api/3/issue/${encodeURIComponent(issueKey)}`, base);
  url.searchParams.set('expand', 'renderedFields,names');
  return url;
}

/** Resolves the output path and proves it stays inside reports/jira before anything is written. */
function resolveOutputPath(issueKey: string): string {
  const root = path.join(PROJECT_ROOT, OUTPUT_DIR);
  const target = path.join(root, `${issueKey}.jira.json`);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside ${OUTPUT_DIR}.`);
  }
  return target;
}

/** Recursively pulls plain text out of an Atlassian Document Format node, for the console preview only. */
function extractAdfText(node: unknown): string {
  if (node === null || typeof node !== 'object') return '';
  const record = node as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  const content = record.content;
  if (!Array.isArray(content)) return '';
  const parts = content.map((child) => extractAdfText(child)).filter((part) => part.length > 0);
  const type = typeof record.type === 'string' ? record.type : '';
  const separator = type === 'paragraph' || type === 'heading' || type === 'listItem' ? '\n' : ' ';
  return parts.join(separator);
}

function fieldsOf(issue: Record<string, unknown>): Record<string, unknown> {
  const fields = issue.fields;
  return fields !== null && typeof fields === 'object' ? (fields as Record<string, unknown>) : {};
}

function namedValue(value: unknown, property: string): string {
  if (value === null || typeof value !== 'object') return '(none)';
  const found = (value as Record<string, unknown>)[property];
  return typeof found === 'string' ? found : '(none)';
}

function countOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function summarise(issue: Record<string, unknown>): string[] {
  const fields = fieldsOf(issue);
  const descriptionText = extractAdfText(fields.description).trim();
  const lines: string[] = [];

  lines.push(`Key           : ${typeof issue.key === 'string' ? issue.key : '(missing)'}`);
  lines.push(`Summary       : ${typeof fields.summary === 'string' ? fields.summary : '(none)'}`);
  lines.push(`Issue type    : ${namedValue(fields.issuetype, 'name')}`);
  lines.push(`Status        : ${namedValue(fields.status, 'name')}`);
  lines.push(`Priority      : ${namedValue(fields.priority, 'name')}`);
  lines.push(`Parent        : ${namedValue(fields.parent, 'key')}`);
  lines.push(`Labels        : ${countOf(fields.labels)}`);
  lines.push(`Components    : ${countOf(fields.components)}`);
  lines.push(`Fix versions  : ${countOf(fields.fixVersions)}`);
  lines.push(`Linked issues : ${countOf(fields.issuelinks)}`);
  lines.push(`Attachments   : ${countOf(fields.attachment)}`);
  lines.push(`Subtasks      : ${countOf(fields.subtasks)}`);
  lines.push(
    `Description   : ${descriptionText.length > 0 ? `${descriptionText.length} characters` : 'EMPTY'}`,
  );

  // A hint for the human only. Whether the story really carries acceptance
  // criteria is a judgement for requirement analysis, not for this script.
  const hasAcHeading = /acceptance\s+criteria/i.test(descriptionText);
  lines.push(`"Acceptance Criteria" phrase present in description: ${hasAcHeading ? 'yes' : 'no'}`);

  return lines;
}

async function main(): Promise<void> {
  const issueKey = parseIssueKey(process.argv[2]);
  const jira = env.requireJiraConfig();
  const url = buildIssueUrl(jira.url, issueKey);

  // Basic auth travels in the header, never in the URL and never in a log line.
  const authorization = `Basic ${Buffer.from(`${jira.email}:${jira.apiToken}`).toString('base64')}`;

  console.log(`Fetching ${issueKey} from ${url.origin} ...`);

  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: authorization, Accept: 'application/json' },
  });

  if (!response.ok) {
    const body = (await response.text()).slice(0, 800);
    console.error(`Jira returned ${response.status} ${response.statusText}.`);
    if (body.length > 0) console.error(body);
    if (response.status === 401 || response.status === 403) {
      console.error(
        'Check JIRA_EMAIL and JIRA_API_TOKEN in your local .env. The token must belong to the ' +
          'same account as the email, and that account needs Browse Projects on this issue.',
      );
    }
    if (response.status === 404) {
      console.error(
        `${issueKey} was not found, or the account cannot see it. Verify the key and JIRA_URL.`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const issue = (await response.json()) as Record<string, unknown>;

  // Identity check. A snapshot of the wrong issue is worse than no snapshot.
  if (issue.key !== issueKey) {
    console.error(
      `Identity mismatch: requested ${issueKey} but Jira returned ` +
        `${typeof issue.key === 'string' ? issue.key : 'an issue with no key'}. Nothing was written.`,
    );
    process.exitCode = 1;
    return;
  }

  const snapshot = {
    _dataClassification: 'REAL_JIRA_DATA',
    retrievalMethod: 'JIRA_REST_API_V3',
    retrievalNote:
      'Retrieved by src/utils/jira-fetch.ts, the documented REST fallback, because the Atlassian ' +
      'MCP server exposed no issue-fetch tool in this session. The issue payload below is verbatim.',
    requestedIssueKey: issueKey,
    requestUrl: url.toString(),
    retrievedAt: new Date().toISOString(),
    issue,
  };

  const outputPath = resolveOutputPath(issueKey);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log('');
  for (const line of summarise(issue)) console.log(line);
  console.log('');
  console.log(`Verbatim snapshot written to ${toRelative(outputPath)}`);
  console.log(
    'This is NOT a governed artifact. The requirement-analysis stage promotes it into ' +
      `requirements/raw/${issueKey}.json.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import fs from 'node:fs';
import path from 'node:path';

import { PROJECT_ROOT, toAbsolute } from './artifact-io.ts';
import {
  assertJiraIssueAllowed,
  assertJiraProjectAllowed,
  type JiraWritePolicy,
} from './jira-policy.ts';

export interface JiraRestConfig {
  url: string;
  email: string;
  apiToken: string;
}

export interface JiraTransportRequest {
  method: 'POST' | 'PUT';
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface JiraTransportResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type JiraTransport = (request: JiraTransportRequest) => Promise<JiraTransportResponse>;

export interface JiraBugCreateRequest {
  projectKey: string;
  issueType: string;
  summary: string;
  description: string;
  assigneeAccountId: string;
  fixVersions: Array<{ id?: string; name?: string }>;
  humanConfirmation: string;
}

function buildUrl(baseUrl: string, endpoint: string): string {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:') {
    throw new Error('JIRA_URL must use https before Jira credentials may be sent.');
  }
  return new URL(endpoint, base).toString();
}

function authorization(config: JiraRestConfig): string {
  return `Basic ${Buffer.from(`${config.email}:${config.apiToken}`, 'utf8').toString('base64')}`;
}

function adf(text: string): Record<string, unknown> {
  const paragraphs = text.split(/\r?\n/).map((line) => ({
    type: 'paragraph',
    content: line.length === 0 ? [] : [{ type: 'text', text: line }],
  }));
  return { type: 'doc', version: 1, content: paragraphs };
}

async function defaultTransport(request: JiraTransportRequest): Promise<JiraTransportResponse> {
  return fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body as BodyInit,
  });
}

async function requireOk(response: JiraTransportResponse, operation: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`${operation} failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function jsonHeaders(config: JiraRestConfig): Record<string, string> {
  return {
    Authorization: authorization(config),
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export async function createJiraComment(
  issueKeyValue: unknown,
  body: string,
  config: JiraRestConfig,
  options: { policy?: JiraWritePolicy; transport?: JiraTransport } = {},
): Promise<{ commentId: string }> {
  const issueKey = assertJiraIssueAllowed(issueKeyValue, 'COMMENT_CREATE', options.policy);
  if (body.trim() === '') throw new Error('Jira comment body must not be empty.');
  const transport = options.transport ?? defaultTransport;
  const response = await transport({
    method: 'POST',
    url: buildUrl(config.url, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`),
    headers: jsonHeaders(config),
    body: JSON.stringify({ body: adf(body) }),
  });
  const result = (await requireOk(response, 'Jira comment creation')) as { id?: unknown };
  if (typeof result.id !== 'string' || result.id.trim() === '') {
    throw new Error('Jira comment creation returned no comment id.');
  }
  return { commentId: result.id };
}

export async function editJiraComment(
  issueKeyValue: unknown,
  commentId: string,
  body: string,
  config: JiraRestConfig,
  options: { policy?: JiraWritePolicy; transport?: JiraTransport } = {},
): Promise<{ commentId: string }> {
  const issueKey = assertJiraIssueAllowed(issueKeyValue, 'COMMENT_EDIT', options.policy);
  if (!/^[0-9]+$/.test(commentId)) {
    throw new Error('Jira comment id must contain digits only.');
  }
  if (body.trim() === '') throw new Error('Jira comment body must not be empty.');
  const transport = options.transport ?? defaultTransport;
  const response = await transport({
    method: 'PUT',
    url: buildUrl(
      config.url,
      `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment/${encodeURIComponent(commentId)}`,
    ),
    headers: jsonHeaders(config),
    body: JSON.stringify({ body: adf(body) }),
  });
  await requireOk(response, 'Jira comment edit');
  return { commentId };
}

function safeAttachmentPath(relativePath: string): string {
  const absolute = toAbsolute(relativePath);
  const relative = path.relative(PROJECT_ROOT, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Jira attachment path must resolve inside the repository.');
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new Error(`Jira attachment does not exist: ${relativePath}`);
  }
  return absolute;
}

export async function uploadJiraAttachments(
  issueKeyValue: unknown,
  relativePaths: string[],
  config: JiraRestConfig,
  options: { policy?: JiraWritePolicy; transport?: JiraTransport } = {},
): Promise<{ uploaded: string[] }> {
  const issueKey = assertJiraIssueAllowed(issueKeyValue, 'ATTACHMENT_UPLOAD', options.policy);
  const absolutePaths = relativePaths.map(safeAttachmentPath);
  if (absolutePaths.length === 0) return { uploaded: [] };

  const form = new FormData();
  for (const absolute of absolutePaths) {
    form.append('file', new Blob([fs.readFileSync(absolute)]), path.basename(absolute));
  }

  const transport = options.transport ?? defaultTransport;
  const response = await transport({
    method: 'POST',
    url: buildUrl(config.url, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/attachments`),
    headers: {
      Authorization: authorization(config),
      Accept: 'application/json',
      'X-Atlassian-Token': 'no-check',
    },
    body: form,
  });
  const result = await requireOk(response, 'Jira attachment upload');
  if (!Array.isArray(result)) {
    throw new Error('Jira attachment upload returned an unexpected response.');
  }
  return {
    uploaded: result
      .map((item) => (item && typeof item === 'object' ? (item as { filename?: unknown }).filename : undefined))
      .filter((value): value is string => typeof value === 'string'),
  };
}

export async function createJiraBug(
  request: JiraBugCreateRequest,
  config: JiraRestConfig,
  options: { policy?: JiraWritePolicy; transport?: JiraTransport } = {},
): Promise<{ issueKey: string }> {
  const projectKey = assertJiraProjectAllowed(request.projectKey, 'BUG_CREATE', options.policy);
  if (request.humanConfirmation.trim() === '') {
    throw new Error('Jira bug creation requires the explicit human confirmation text.');
  }
  if (
    request.summary.trim() === '' ||
    request.description.trim() === '' ||
    request.issueType.trim() === '' ||
    request.assigneeAccountId.trim() === ''
  ) {
    throw new Error('Jira bug creation requires summary, description, issue type, and assignee.');
  }

  const fields: Record<string, unknown> = {
    project: { key: projectKey },
    issuetype: { name: request.issueType },
    summary: request.summary,
    description: adf(request.description),
    assignee: { id: request.assigneeAccountId },
  };
  if (request.fixVersions.length > 0) fields.fixVersions = request.fixVersions;

  const transport = options.transport ?? defaultTransport;
  const response = await transport({
    method: 'POST',
    url: buildUrl(config.url, '/rest/api/3/issue'),
    headers: jsonHeaders(config),
    body: JSON.stringify({ fields }),
  });
  const result = (await requireOk(response, 'Jira bug creation')) as { key?: unknown };
  if (typeof result.key !== 'string' || result.key.trim() === '') {
    throw new Error('Jira bug creation returned no issue key.');
  }
  assertJiraIssueAllowed(result.key, 'BUG_CREATE', options.policy);
  return { issueKey: result.key };
}

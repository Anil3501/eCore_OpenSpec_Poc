import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertJiraIssueAllowed,
  assertExistingJiraIssueFieldMutable,
  assertJiraProjectAllowed,
  JiraPolicyError,
  JiraImmutableFieldError,
  findProhibitedJiraWriteGrants,
  isJiraAmbiguityWritebackEligible,
  parseJiraWritePolicy,
  type JiraWritePolicy,
} from '../../src/utils/jira-policy.ts';
import {
  createJiraBug,
  createJiraComment,
  editJiraComment,
  uploadJiraAttachments,
  type JiraRestConfig,
  type JiraTransport,
} from '../../src/utils/jira-write-client.ts';

const policy: JiraWritePolicy = {
  schemaVersion: '1.0',
  mode: 'TEMPORARY_ALLOWLIST',
  activatedAt: '2026-09-28T13:39:42.575Z',
  allowedProjectKeys: ['ETA'],
  immutableIssueFields: ['description'],
  restrictedOperations: [
    'WORKFLOW_START',
    'COMMENT_CREATE',
    'COMMENT_EDIT',
    'ATTACHMENT_UPLOAD',
    'BUG_CREATE',
  ],
};

const config: JiraRestConfig = {
  url: 'https://jira.example.test',
  email: 'not-used@example.test',
  apiToken: 'not-used',
};

function response(json: unknown): ReturnType<JiraTransport> {
  return Promise.resolve({
    ok: true,
    status: 200,
    async json(): Promise<unknown> {
      return json;
    },
    async text(): Promise<string> {
      return '';
    },
  });
}

test('strict policy parser rejects unknown fields', () => {
  assert.throws(
    () => parseJiraWritePolicy({ ...policy, bypass: true }),
    /Unrecognized key/,
  );
});

test('static grant detection identifies direct Jira writes', () => {
  assert.deepEqual(
    findProhibitedJiraWriteGrants('tools:\n  - atlassian/createJiraIssue\n  - atlassian/getJiraIssue'),
    ['atlassian/createJiraIssue'],
  );
  assert.deepEqual(findProhibitedJiraWriteGrants('tools:\n  - atlassian/getJiraIssue'), []);
});

test('existing Jira descriptions are immutable even for ETA', () => {
  assert.throws(
    () => assertExistingJiraIssueFieldMutable('description', policy),
    JiraImmutableFieldError,
  );
  assert.doesNotThrow(() => assertExistingJiraIssueFieldMutable('labels', policy));
});

test('ambiguity writeback requires a new workflow and a new ETA ticket', () => {
  assert.equal(
    isJiraAmbiguityWritebackEligible(
      'ETA-1',
      '2026-09-28T13:40:00.000Z',
      '2026-09-28T13:41:00.000Z',
      policy,
    ),
    true,
  );
  assert.equal(
    isJiraAmbiguityWritebackEligible(
      'ETA-1',
      '2026-09-28T13:40:00.000Z',
      '2026-09-01T00:00:00.000Z',
      policy,
    ),
    false,
  );
});

test('workflow and write guards permit ETA only', () => {
  assert.equal(assertJiraIssueAllowed('ETA-123', 'WORKFLOW_START', policy), 'ETA-123');
  assert.equal(assertJiraProjectAllowed('ETA', 'BUG_CREATE', policy), 'ETA');

  for (const target of ['EC-12000', 'ABC-1', 'eta-123', '', undefined]) {
    assert.throws(
      () => assertJiraIssueAllowed(target, 'COMMENT_CREATE', policy),
      JiraPolicyError,
    );
  }
});

test('blocked comment operations never invoke transport', async () => {
  let calls = 0;
  const transport: JiraTransport = async () => {
    calls += 1;
    return response({ id: '1' });
  };

  await assert.rejects(
    createJiraComment('EC-1', 'body', config, { policy, transport }),
    JiraPolicyError,
  );
  await assert.rejects(
    editJiraComment('eta-1', '10', 'body', config, { policy, transport }),
    JiraPolicyError,
  );
  assert.equal(calls, 0);
});

test('blocked attachments fail before path access or transport', async () => {
  let calls = 0;
  const transport: JiraTransport = async () => {
    calls += 1;
    return response([]);
  };
  await assert.rejects(
    uploadJiraAttachments('EC-1', ['does-not-exist.zip'], config, { policy, transport }),
    JiraPolicyError,
  );
  assert.equal(calls, 0);
});

test('ETA comments use the injected transport', async () => {
  const requests: string[] = [];
  const transport: JiraTransport = async (request) => {
    requests.push(`${request.method} ${request.url}`);
    return response({ id: '101' });
  };

  assert.deepEqual(
    await createJiraComment('ETA-1', 'Question', config, { policy, transport }),
    { commentId: '101' },
  );
  await editJiraComment('ETA-1', '101', 'Updated', config, { policy, transport });
  assert.equal(requests.length, 2);
  assert.match(requests[0], /ETA-1\/comment$/);
  assert.match(requests[1], /ETA-1\/comment\/101$/);
});

test('bug creation remains gated by project and human confirmation', async () => {
  let calls = 0;
  const transport: JiraTransport = async () => {
    calls += 1;
    return response({ key: 'ETA-900' });
  };
  const base = {
    issueType: 'Bug',
    summary: 'Summary',
    description: 'Description',
    assigneeAccountId: 'account',
    fixVersions: [],
  };

  await assert.rejects(
    createJiraBug(
      { ...base, projectKey: 'ETA', humanConfirmation: '' },
      config,
      { policy, transport },
    ),
    /human confirmation/,
  );
  await assert.rejects(
    createJiraBug(
      { ...base, projectKey: 'EC', humanConfirmation: 'Confirmed' },
      config,
      { policy, transport },
    ),
    JiraPolicyError,
  );
  assert.equal(calls, 0);

  assert.deepEqual(
    await createJiraBug(
      { ...base, projectKey: 'ETA', humanConfirmation: 'Confirmed' },
      config,
      { policy, transport },
    ),
    { issueKey: 'ETA-900' },
  );
  assert.equal(calls, 1);
});

import { z } from 'zod';

/** Shared primitives used by every structured artifact in the framework. */

export const SCHEMA_VERSION = '1.0.0';

export const releaseSchema = z
  .string()
  .regex(/^\d+\.\d+(\.\d+)?$/, 'release must look like "1.0" or "1.0.1"');

export const capabilitySchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'capability must be a kebab-case slug');

export const jiraIdSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9]+-\d+$/, 'jiraId must look like "ABC-123"');

export const requirementIdSchema = z
  .string()
  .regex(/^REQ-[A-Z][A-Z0-9]+-\d+-\d{3}$/, 'requirementId must look like "REQ-ABC-123-001"');

export const acIdSchema = z
  .string()
  .regex(/^AC-[A-Z][A-Z0-9]+-\d+-\d{3}$/, 'acId must look like "AC-ABC-123-001"');

export const testPlanIdSchema = z
  .string()
  .regex(/^TP-[A-Z0-9-]+-\d{3}$/, 'testPlanId must look like "TP-ABC-123-001"');

export const testScenarioIdSchema = z
  .string()
  .regex(/^TS-[A-Z0-9-]+-\d{3}$/, 'testScenarioId must look like "TS-ABC-123-001"');

export const traceIdSchema = z
  .string()
  .regex(/^TRC-[A-Z0-9-]+-\d{3}$/, 'traceId must look like "TRC-ABC-123-001"');

export const ambiguityIdSchema = z
  .string()
  .regex(/^AMB-[A-Z0-9-]+-\d{3}$/, 'ambiguityId must look like "AMB-ABC-123-001"');

export const executionIdSchema = z
  .string()
  .regex(/^EXEC-[A-Z0-9-]+-\d{3}$/, 'executionId must look like "EXEC-ABC-123-001"');

export const defectIdSchema = z
  .string()
  .regex(/^DEF-[A-Z0-9-]+-\d{3}$/, 'defectId must look like "DEF-ABC-123-001"');

export const isoTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'must be an ISO-8601 timestamp');

export const artifactVersionSchema = z.number().int().min(1);

export const sourceTypeSchema = z.enum([
  'EXTRACTED_FROM_JIRA',
  'PROPOSED_BY_REQUIREMENT_ANALYSIS',
  'MODIFIED_DURING_HUMAN_REVIEW',
]);

export const statusSchema = z.enum([
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'DEFERRED',
  'REQUEST_CHANGES',
  'REVIEW_REQUIRED',
]);

export const changeTypeSchema = z.enum([
  'NEW',
  'MODIFIED',
  'REMOVED',
  'UNCHANGED',
  'DEFECT_FIX',
  'REVIEW_REQUIRED',
]);

export const scenarioActionSchema = z.enum([
  'REUSE',
  'UPDATE',
  'CREATE',
  'RETIRE',
  'REGRESSION',
  'REVIEW_REQUIRED',
]);

export const decisionSchema = z.enum(['APPROVE', 'REJECT', 'DEFER', 'REQUEST_CHANGES']);

export const dataClassificationSchema = z.enum(['REAL_JIRA_DATA', 'SAMPLE_DATA']);

export const executionResultSchema = z.enum([
  'PASSED',
  'FAILED',
  'SKIPPED',
  'TIMED_OUT',
  'BLOCKED',
  'NOT_EXECUTED',
]);

export const workflowStageSchema = z.enum([
  'JIRA_RETRIEVAL',
  'REQUIREMENT_NORMALIZATION',
  'AC_ANALYSIS',
  'AC_REVIEW_PACKAGE',
  'AC_APPROVAL',
  'OPENSPEC_GENERATION',
  'TEST_PLAN_GENERATION',
  'TEST_PLAN_APPROVAL',
  'BDD_DESIGN',
  'AUTOMATION_REVIEW_PACKAGE',
  'AUTOMATION_APPROVAL',
  'PLAYWRIGHT_VALIDATION',
  'IMPLEMENTATION',
  'BDD_GENERATION',
  'EXECUTION',
  // Failure-handling branch. Only entered when EXECUTION recorded a failure;
  // an all-green run goes straight from EXECUTION to RTM_UPDATE as before.
  'FAILURE_TRIAGE',
  'LOCATOR_HEALING',
  'BUG_REPORTING',
  'RTM_UPDATE',
  'COMPLETED',
]);

export const workflowStatusSchema = z.enum([
  'NOT_STARTED',
  'IN_PROGRESS',
  'VALIDATION_FAILED',
  'WAITING_FOR_CLARIFICATION',
  'WAITING_FOR_HUMAN',
  'APPROVED',
  'REJECTED',
  'CHANGES_REQUESTED',
  'BLOCKED',
  'COMPLETED',
]);

export const approvalGateSchema = z.enum([
  'ACCEPTANCE_CRITERIA',
  'TEST_PLAN',
  'AUTOMATION_DESIGN',
]);

export type SourceType = z.infer<typeof sourceTypeSchema>;
export type ArtifactStatus = z.infer<typeof statusSchema>;
export type WorkflowStage = z.infer<typeof workflowStageSchema>;
export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type ApprovalGate = z.infer<typeof approvalGateSchema>;
export type Decision = z.infer<typeof decisionSchema>;

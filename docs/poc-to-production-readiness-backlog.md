# POC → Production Readiness Backlog

Tasks to complete before real utilization of the framework. This repository was built as a **Proof
of Concept**; the items below harden it for production use. **This document lists work only — nothing
here is implemented.**

Legend: **[P1]** critical / do first · **[P2]** important · **[P3]** follow-up.

---

## 1. Jira / Requirements Source-of-Truth Integration

- **[P1]** Modify the Jira MCP integration so answered `AMB-*` ambiguities are written back to Jira
  (comment or custom field), making Jira the traceable source of truth alongside framework
  artifacts. *(Your item #1)*
- **[P1]** Confirm/implement Jira MCP attaching the **approved AC set** and **approved test plan**
  back to the story for reference (attachments or linked artifacts). *(Your item #2)*
- **[P2]** Decide and enforce sync direction for `BLOCKER-*` escalations — auto-create/link Jira
  sub-tasks or comments from `blocker-escalation-note` output.
- **[P2]** Replace the interim `npm run jira:fetch` REST fallback assumptions with a validated
  production auth path (service account, least privilege, token rotation).
- **[P2]** Confirm handling for Jira Server/Data Center vs. Cloud (retrieval currently blocks on
  non-Cloud deployments).
- **[P2]** Define field mappings: Jira story fields → `requirements/raw` schema (fixVersions,
  components, labels, acceptance-criteria field location).
- **[P3]** Decide bidirectional status sync (e.g., framework stage/gate status reflected on the
  Jira story).

## 2. CI/CD & Cloud Execution (Azure DevOps)

- **[P1]** Integrate Azure DevOps pipelines so tests run on cloud agents in addition to local runs
  (parallel sharding, headless). *(Your item #3)*
- **[P1]** Add a CI-safe secret/environment injection path (Azure Key Vault or ADO variable groups)
  replacing local `.env`.
- **[P2]** Publish Playwright HTML/JSON reports and coverage as ADO pipeline artifacts; wire
  pass/fail gates.
- **[P2]** Define CI concurrency/worker strategy (currently `workers: 1`, `retries: 1`) for scale
  and flake control.
- **[P2]** Establish branch policy: which stages/gates run in CI vs. locally; forbid `.only`;
  enforce `npm run validate:artifacts` on PR.
- **[P3]** Optionally push execution results / defects to Azure DevOps Test Plans if ADO becomes the
  test-management system.

## 3. Demo / R&D Data Cleanup

- **[P1]** Remove all demo/R&D story references (`ETA-351`, `ETA-411`, `EC-11358`, `EC-12000`)
  without breaking shared files (fixtures, components, page objects, `src/fixtures/test.ts`, lookup
  index). *(Your item #4)*
- **[P1]** Decide what to keep as "reference reading material" vs. delete; if kept, isolate so it
  never backs real coverage numbers.
- **[P2]** Purge demo entries from the RTM, coverage matrices, `traceability/index/lookup.index.json`,
  executions, and workflow instances/history.
- **[P2]** Clean demo-specific probe scripts under `scripts/` and demo validation artifacts under
  `reports/validation/`.
- **[P2]** Reset/scrub sample `test-data/` files and captured screenshots tied to demo stories.
- **[P3]** Remove/replace demo-based worked examples referenced in docs after cleanup.

## 4. Security & Secrets

- **[P1]** Remove/rotate the plaintext token in the repo `.npmrc` (flagged REVIEW_REQUIRED); move to
  secure per-user/CI registry auth.
- **[P1]** Confirm no real credentials in `test-data/`, config, or captured sessions before first
  production use.
- **[P2]** Audit that `.env`, `.npmrc`, `.auth/`, `.playwright-mcp/` remain git-ignored; add a
  pre-commit secret scan.
- **[P2]** Establish credential provisioning for role users (`config/test-users.json` + `.env`
  prefixes) via the secret store.
- **[P3]** Define a secret rotation cadence and ownership.

## 5. Environment & Configuration

- **[P1]** Replace the single `qa5`-centric config with validated multi-environment profiles
  (`config/environments/<profile>.json`), including real targets and `prod` guardrails.
- **[P1]** Verify DNS/VPN/network access strategy for CI agents (qa5 required VPN; runs failed with
  `ERR_NAME_NOT_RESOLVED` without it).
- **[P2]** Confirm base URL, API base URL, and auth mode per environment; document per-env test-data
  expectations.
- **[P2]** Define destructive-action safety per environment (Print/Verify permanently destroys vault
  documents on shared QA).
- **[P3]** Document environment ownership and refresh/reset procedures for test data.

## 6. API Contract Governance

- **[P2]** Establish the process for promoting `OBSERVED` → `HUMAN_APPROVED` contracts at Gate 2 and
  recording `responseShapeHash` at scale.
- **[P2]** Decide whether an OpenAPI/source-of-truth contract can replace observation for the `.eo`
  endpoints actually used.
- **[P2]** Expand `src/api/` clients only for endpoints observed end-to-end; keep the ~178
  `UNVERIFIED` `.eo` paths off-limits until verified.
- **[P3]** Define a contract-drift review cadence using the recorded shape hashes.

## 7. Governance, Roles & Process

- **[P1]** Formalize who holds each human approval gate (Gate 1/2/3) and the SLA/turnaround per gate.
- **[P1]** Define the reviewer/assignee accounts for defect filing
  (`JIRA_BUG_ASSIGNEE_ACCOUNT_ID`) and gate sign-off identities.
- **[P2]** Fix commit identity config (commits currently fall back to auto-detected
  `user.name`/`user.email`).
- **[P2]** Agree the release/versioning scheme feeding `@release-` tags and
  `traceability/releases/*.baseline.json`.
- **[P3]** Define an audit process for approvals and defect evidence.

## 8. Documentation & Onboarding

- **[P2]** Correct the "18-Stage" naming inconsistency in the v1 guide, `README`, and `AGENTS.md`
  (it is 17 happy-path / 20 processing / 21 including `COMPLETED`).
- **[P2]** Consolidate v1/v2 training guides (decide canonical) and update all worked-example
  references after demo cleanup.
- **[P3]** Produce an onboarding runbook for the first real story (preflight → gates → execution →
  archive).

## 9. Scaling & Maintenance

- **[P2]** Validate capability-partitioned RTM + lookup index performance against the target
  (3,000+ tests) before ramp-up.
- **[P2]** Define retention/rotation for `test-results/`, `reports/`, traces, and coverage to control
  repo/artifact growth.
- **[P2]** Add a health-check/regression cadence (smoke on every run, full regression scheduled) and
  a flake-quarantine policy.
- **[P3]** Establish maintenance ownership for `SEM-*` semantic rules, schema/Zod parity, and
  templates/manifest as the schema evolves.

## 10. Reliability & Observability

- **[P2]** Add alerting/notification on CI failures and `ENVIRONMENT_BLOCKER` classifications.
- **[P3]** Decide dashboarding for requirement coverage vs. browser code coverage (keep them clearly
  separated).
- **[P3]** Define trace/screenshot preservation and defect-evidence storage location for audits.

---

## Priority Summary

| Priority | Focus |
| :--- | :--- |
| **P1 (do first)** | Jira write-back for `AMB-*` + AC/test-plan attach, ADO cloud execution + secret injection, demo data removal, `.npmrc` token rotation, multi-environment config + CI network access, gate ownership & assignee accounts. |
| **P2 (important)** | Blocker→Jira sync, CI reporting/policy, RTM/coverage cleanup, secret scanning, API contract promotion process, docs consolidation, retention & regression cadence. |
| **P3 (follow-up)** | Bidirectional status sync, ADO Test Plans, contract-drift cadence, onboarding runbook, dashboards, audit processes. |

> This backlog is a planning artifact only. Convert items into tracked stories/tasks before starting
> implementation.

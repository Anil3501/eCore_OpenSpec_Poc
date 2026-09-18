# Approval Gate 3 — Automation Design Review — TP-EC-11358-001

**Story:** EC-11358 — Phase 2_13: Add new section to Document Activity History Report delineating the control history
**Capability:** `document-activity-history` · **Release:** 26.3
**Approved plan:** `test-plans/approved/TP-EC-11358-001.json` · **Plan version:** 2

> Fill every section. A section with nothing to say should say "None."

---

## What you are being asked to approve

Six Gherkin scenarios in one feature file,
[features/generated/document-activity-history/control-history.feature](../../../features/generated/document-activity-history/control-history.feature),
covering the six approved acceptance criteria of EC-11358 through the on-screen Document Activity
History Report. TS-EC-11358-006 and TS-EC-11358-007 were deferred at Gate 2 because the report APIs
return acknowledgments rather than report content and no safe generated-report retrieval route is
available. The feature file stays in `features/generated/` until this gate is recorded — only
`features/approved/` is compiled by `bddgen`.

Approving this authorises the framework to implement and run these six UI tests. It binds to plan
version 2 and does not authorise either deferred API scenario.

## Scenario-by-scenario design

For each scenario: the Gherkin, the acceptance criterion it covers, its interface, and the page
objects, components or API clients it needs.

**TS-EC-11358-001 — A transferred financial asset shows a consolidated Control History table in its Document Activity History Report** (covers AC-EC-11358-001, UI)

```gherkin
Scenario: A transferred financial asset shows a consolidated Control History table in its Document Activity History Report
  Given a financial asset document that has undergone a confirmed transfer of control
  When I open its Document Activity History Report
  Then a Control History table consolidating the document's transfers is shown
```

Needs: `DocumentActivityHistoryReportPage` (page object, owns the report and Control History table
locators), `ControlHistoryTable` component, a `control-history` step file, and a test-data loader
resolving the seeded transferred document. Sign-in reuses the existing
`organization-login.service.ts` and organization page object from account-access.

**TS-EC-11358-002 — Each Control History row shows the transfer date and both organizations** (covers AC-EC-11358-002, UI)

```gherkin
Scenario: Each Control History row shows the transfer date and both organizations
  Given a Document Activity History Report that shows a Control History table
  When I read each row of the Control History table
  Then each row shows the transfer date
  And each row shows the organization control was transferred from
  And each row shows the organization control was transferred to
```

Needs: `ControlHistoryTable` component exposing per-row structural accessors for the three columns.
Asserts structural presence only (AMB-EC-11358-003); no label or date-format assertion.

**TS-EC-11358-003 — A document with no confirmed transfer shows no Control History table** (covers AC-EC-11358-003, UI)

```gherkin
Scenario: A document with no confirmed transfer shows no Control History table
  Given a document that has no confirmed transfer of control
  When I open its Document Activity History Report
  Then no Control History table is shown
```

Needs: `DocumentActivityHistoryReportPage` with an absence assertion; a test-data reference to a
document with no confirmed transfer.

**TS-EC-11358-004 — Multiple transfers are ordered newest to oldest** (covers AC-EC-11358-004, UI)

```gherkin
Scenario: Multiple transfers are ordered newest to oldest
  Given a document that has undergone more than one confirmed transfer of control
  When I open its Document Activity History Report
  Then the Control History entries run from newest to oldest
  And the oldest entry's transferred-from organization is the original controller
```

Needs: `ControlHistoryTable` component exposing ordered rows; a test-data reference to a document
with at least two confirmed transfers.

**TS-EC-11358-005 — The Control History table appears in the Document Activity History Report UI view** (covers AC-EC-11358-005, UI)

```gherkin
Scenario: The Control History table appears in the Document Activity History Report UI view
  Given a document whose Document Activity History Report contains a Control History table
  When I view the Document Activity History Report on screen
  Then the Control History table appears in the on-screen output
```

Needs: `DocumentActivityHistoryReportPage`. This is the authoritative UI coverage of AC-EC-11358-005.

**TS-EC-11358-008 — Document type determines whether the Control History table is produced** (covers AC-EC-11358-006, UI)

```gherkin
Scenario Outline: Document type determines whether the Control History table is produced
  Given a "<document type>" that has undergone transfers
  When I open its Document Activity History Report
  Then the Control History table is "<presence>"

  Examples:
    | document type            | presence  |
    | Financial Asset          | shown     |
    | Financial Asset Addendum | shown     |
    | Supplemental Doc         | not shown |
```

Needs: `DocumentActivityHistoryReportPage`; test-data references for one Financial Asset with
transfers, one Financial Asset Addendum with transfers and one Supplemental Doc.

Feature files describe business behaviour only — no selectors and no page-object method names. Every
scenario carries `@release-`, `@capability-`, `@req-`, `@ac-`, `@tp-` and `@ts-` tags. No
`@interface-` tag is present because all six scenarios use the default UI interface.

## Locators and contracts

| Element or endpoint | Locator or contract | Status |
| --- | --- | --- |
| Document Activity History Report container | To be resolved at PLAYWRIGHT_VALIDATION | MCP_VALIDATION_REQUIRED |
| Control History table (presence/absence) | To be resolved at PLAYWRIGHT_VALIDATION | MCP_VALIDATION_REQUIRED |
| Control History row — transfer date cell | To be resolved at PLAYWRIGHT_VALIDATION | MCP_VALIDATION_REQUIRED |
| Control History row — transferred-from org cell | To be resolved at PLAYWRIGHT_VALIDATION | MCP_VALIDATION_REQUIRED |
| Control History row — transferred-to org cell | To be resolved at PLAYWRIGHT_VALIDATION | MCP_VALIDATION_REQUIRED |
| Control History row ordering | To be resolved at PLAYWRIGHT_VALIDATION | MCP_VALIDATION_REQUIRED |

QA5 scripted-probe evidence confirms the Control History table, its three headers, and one row for
transaction 16809591 / document 16809592. That observation validates behavior for TS-EC-11358-001,
TS-EC-11358-002, and TS-EC-11358-005, but it is not Playwright MCP accessibility-tree evidence.
Every locator therefore remains `MCP_VALIDATION_REQUIRED`. No `VALIDATED -` waiver and no
`JUSTIFIED-WAIT:` is anticipated; if PLAYWRIGHT_VALIDATION finds no accessible locator for a cell,
the resulting waiver will be listed before implementation.

The two deferred API scenarios are absent from this design. Their observed request and acknowledgment
evidence remains in `reports/validation/TP-EC-11358-001-api-validation.json` for future planning and
does not count as acceptance-criterion coverage.

## Open questions

**Q-EC-11358-001** — Transaction 16809591 / document 16809592 under the configured NSOrg account is
confirmed for the single-transfer precondition used by TS-EC-11358-001, TS-EC-11358-002, and
TS-EC-11358-005. Which concrete documents reproduce the no-transfer precondition, the
multiple-transfer precondition, and the Financial Asset Addendum/Supplemental Doc cases? Those
remaining fixtures must be confirmed at PLAYWRIGHT_VALIDATION; they are never guessed.

Anything an agent would otherwise have to invent — a role, a message, a limit, a policy — belongs
here rather than in the design.

## What this automation deliberately does not assert

- The exact column-header labels, the table heading text, and the date/time format — assertions are
  limited to the structural presence of the three columns (AMB-EC-11358-003). EC-13271 tracks a
  separate date-format defect.
- The UI download, Certified Print package, Paper Out and retention-copy report surfaces — these stay
  manual this release (AMB-EC-11358-002) and are not automated here.
- The transfer workflow itself (Transfer of Control, Pledge, Securitization) — the Confirmed Transfer
  of Control precondition is established as test data, not exercised as behaviour under test.
- The two report APIs. TS-EC-11358-006 and TS-EC-11358-007 are deferred by Gate 2 approval
  `APR-TP-EC-11358-003` and are not executable in this design.

## Risks

| ID | Level | Risk |
| --- | --- | --- |
| RISK-TP-EC-11358-001 | HIGH | The two report APIs return acknowledgments rather than report content. They remain deferred and their evidence must not be used as proof of Control History. |
| RISK-TP-EC-11358-002 | HIGH | The Confirmed Transfer of Control precondition is non-deterministic to reproduce. A scenario that cannot reach the precondition is recorded BLOCKED, never fabricated as passing. |
| RISK-TP-EC-11358-003 | MEDIUM | The story states the columns' meaning but not their labels or date format. Hardening against a label or format could pin a defect (EC-13271) as correct; scenarios assert structural presence only. |
| RISK-AD-EC-11358-001 | MEDIUM | Every Control History locator is unobserved (MCP_VALIDATION_REQUIRED). If PLAYWRIGHT_VALIDATION cannot resolve an accessible locator, implementation is blocked until a waiver is agreed, not forced with a brittle selector. |

## How to record your decision

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Fill `features/generated/document-activity-history/TP-EC-11358-001-automation-approval.template.json`
  and record it as a new versioned approval under `features/approved/document-activity-history/`.
2. Set `decision`, and one entry in `itemDecisions` per scenario.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer Q-EC-11358-001 in `comments`, or explicitly defer concrete test-data selection to
  PLAYWRIGHT_VALIDATION.
5. Run `npm run validate:artifacts`.

Once the approval artifact is on disk, the orchestrator moves the feature file into
`features/approved/document-activity-history/` and proceeds. A file still carrying
`MCP_VALIDATION_REQUIRED` fails the build once it backs approved automation, so the Control History
locators are resolved at PLAYWRIGHT_VALIDATION before the feature is compiled.

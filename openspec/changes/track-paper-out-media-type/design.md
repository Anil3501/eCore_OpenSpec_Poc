## Context

See proposal.md - Why/What Changes for motivation and scope. This capability spans three surfaces:
the Paper Out Request UI, the `eoRequestExport` API contract, and audit/reporting (Additional
Information logging, cover page, activity history reports). No `paper-out-export` capability spec
exists in this repo yet - this is a net-new capability, not a modification. The `eoRequestExport`
request/response contract is not currently documented in this framework's API-surface inventory
(`reports/validation/ecore-api-discovery.json`); per AGENTS.md rule 4, it must never be authored from
ticket text and stays `API_CONTRACT_UNVERIFIED` until observed and human-approved (see
AMB-EC-12000-002 resolution in `requirements/approved/EC-12000.json`).

## Goals / Non-Goals

**Goals:**
- Give both the UI user and the API integrator an explicit way to declare Media Type intent, and make
  that declared intent - not the submission channel - the single source of truth for what is recorded.
- Keep the audit-trail move (Authorized Paper Out → Submitted Paper Out) consistent across UI-only and
  API-only submission paths, at both transaction and document level.
- Preserve backward compatibility for every existing `eoRequestExport` caller that never adopts
  `mediaType`.

**Non-Goals:**
- Retroactively reclassifying or backfilling Media Type on historical transactions/documents.
- Defining or guessing the full `eoRequestExport` request/response shape beyond the single new
  `mediaType` element - the rest of that contract remains out of scope for this change and is captured
  separately (see Decisions, below) only to the extent this feature needs it.
- Redesigning the Paper Out Request modal beyond adding the Media Type section, the acknowledgement
  modal, and the right-side border cleanup explicitly called out in the story.

## Decisions

- **Media Type is derived once, at submission time, from a single normalized value.** Both the UI
  radio-button choice and the API `mediaType` element resolve to the same internal Paper/Electronic
  value before it is persisted, so downstream logging/reporting code has one input shape regardless of
  origin. Alternative considered: branch reporting logic on submission channel (UI vs API) - rejected
  because it would re-introduce exactly the "channel implies Media Type" assumption this story removes.
- **The acknowledgement modal's field-completeness gate reuses the Paper Out Request modal's own
  required-field validation** ("Name of Request:", "Approver:" - resolved via AMB-EC-12000-003) rather
  than introducing a second, parallel validation path. Alternative considered: validate only on submit
  - rejected because the story specifies the acknowledgement modal opens only *after* required fields
  are already satisfied.
- **The `eoRequestExport` API contract is established through observation, not specification.** Per
  AMB-EC-12000-002's resolution, no authoritative contract exists today. The Playwright Test Planner
  will drive the real, approved flow through Playwright MCP at `PLAYWRIGHT_VALIDATION` to capture the
  actual request/response (recorded `OBSERVED`, with a `responseShapeHash`), and only a human reviewer
  can promote it to `HUMAN_APPROVED` at the test-plan gate before any API-facing acceptance criterion
  (AC-EC-12000-005, -006, -011 through -015) can be judged. Alternative considered: author the contract
  from the ticket's `export.xsd` description - rejected outright by AGENTS.md rule 4 (never guess an
  API contract).
- **Audit-trail event source moves, it does not duplicate.** Media Type Additional Information is
  logged once, on Submitted Paper Out, replacing (not supplementing) its prior placement on Authorized
  Paper Out, so a package never carries the same information twice under two different events.

## Risks / Trade-offs

- **[Risk]** The `eoRequestExport` contract may not be observable through a UI-driven Playwright MCP
  session if no in-app flow currently exercises the API request path end-to-end with a `mediaType`
  value. → **Mitigation**: flag this explicitly at `PLAYWRIGHT_VALIDATION`; if unobservable through the
  UI, escalate to a human to supply a direct API test harness or sample payload before Gate 2 can
  approve any API-interface scenario.
- **[Risk]** Moving Additional Information from Authorized Paper Out to Submitted Paper Out could
  break existing automation or reports that read the old event. → **Mitigation**: acceptance criteria
  (AC-EC-12000-016, -017) explicitly assert the new location and explicitly assert no retroactive
  update, so this is a deliberate, visible behavior change rather than a side effect. Any existing
  automation asserting the old event should be reviewed at `IMPLEMENTATION`/`PLAYWRIGHT_VALIDATION`
  time, not silently left in place, for asserting removed behavior.
- **[Trade-off]** Reusing one normalized Media Type value for both UI and API paths simplifies
  reporting but means a defect in the shared determination logic affects both channels simultaneously
  rather than being isolated to one. Accepted because the story's own acceptance criteria (AC-007
  through AC-015) require the two channels to behave identically.

## Migration Plan

- No database backfill and no reprocessing of historical transactions/documents (explicit non-goal;
  AC-EC-12000-017).
- Deploys as an additive UI section, an additive optional API element, and a relocation of an existing
  logging call - no schema removal, no breaking change to `eoRequestExport` callers that omit
  `mediaType`.
- Rollback is a standard code revert; no irreversible data migration is introduced by this change.

## Open Questions

- None that would change the specs, the chosen approach, or the task breakdown. The one open unknown
  at this stage - the authoritative `eoRequestExport` contract shape - is not deferrable in the sense
  of "safely answered later without changing anything": it gates which API-facing acceptance criteria
  can be judged at all, so it is tracked as the resolved-but-not-yet-fulfilled AMB-EC-12000-002 and
  actioned at `PLAYWRIGHT_VALIDATION`, not left as a design-time open question.

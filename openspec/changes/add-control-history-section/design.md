## Context

See [proposal.md](proposal.md) — Why. The requirements are in
[specs/document-activity-history/control-history/spec.md](specs/document-activity-history/control-history/spec.md).

EC-11358 arrives with real acceptance criteria drawn from the story description and authoritative
Product-approved comments, and — unlike a story with deferred ambiguities — its four ambiguities
(`AMB-EC-11358-001` … `AMB-EC-11358-004`) were **resolved** by a human at Gate 1. The design problem
here is therefore not "prevent invention of a business rule that nobody has decided"; it is "carry
the resolutions forward without over-reading them", because two of them (`AMB-002` scope and
`AMB-003` structural-presence-only) deliberately keep the specification weaker than the story's full
verification matrix.

## Goals / Non-Goals

**Goals**

- Keep every specified requirement traceable to exactly one approved acceptance criterion.
- Carry each Gate 1 ambiguity resolution to the point where it constrains a requirement, so a
  downstream stage neither ignores it nor strengthens it beyond what was agreed.
- Keep the report-API surfaces (`eoRequestExport`, `eoGetDocumentActivityHistoryReport`) in scope as
  *behaviour* while keeping their contracts out of the specification until Gate 2.

**Non-Goals**

- Authoring an API contract. Endpoints, request shapes, field names and status codes are unverified
  and belong to Gate 2, not this spec.
- Asserting exact column labels, table heading text or date/time format. `AMB-EC-11358-003` was
  resolved to structural presence only.
- Specifying automation structure, test data or org/credential selection. Those are produced at test
  planning, Playwright validation and implementation.

## Decisions

**Requirements assert what the story and Product-approved comments state, at the strength the Gate 1
resolutions allow.**
`AC-EC-11358-002` names the three columns (transfer date, Transfer From org, Transfer To org) but the
spec asserts only their presence, not their labels or format — the resolution of `AMB-EC-11358-003`.
Writing exact header text would contradict that resolution and would also collide with EC-13271, a
separate date-format defect in the downloaded report.

**The report-API surfaces are specified as places the table must appear, not as contracts.**
`AC-EC-11358-005` lists six surfaces including two APIs. The resolution of `AMB-EC-11358-002` keeps
those two APIs in automation scope, but the framework holds no verified contract for them
(`UNVERIFIED` per [reports/validation/ecore-api-discovery.json](../../../reports/validation/ecore-api-discovery.json)).
The requirement therefore states the *behaviour* — the table appears in that surface's output — and
leaves the contract to be captured from live traffic and converted from `OBSERVED` to
`HUMAN_APPROVED` at Gate 2. An `OBSERVED` contract may drive a scenario to a state but may never
judge an acceptance criterion.

**Preconditions and accounts are named as constraints, not baked into the spec.**
`AMB-EC-11358-001` resolved the Confirmed Transfer of Control precondition to "every change of state
of the document", and `AMB-EC-11358-004` resolved account selection to "the organization accounts
referenced in the story", with the concrete document and credentials confirmed against the
environment during Playwright validation. The spec references these where they constrain a
requirement and leaves the concrete test data to Gate 2.

**Each requirement names the ambiguity that shaped it, inline.**
So a test planner reading a single requirement sees its limitation without cross-referencing a
central section.

## Risks / Trade-offs

- **A downstream stage asserts an API acceptance against observed traffic.** → `AC-EC-11358-005`
  carries `AMB-EC-11358-002` inline; the test plan must mark the two report APIs `OBSERVED` and the
  human must convert them to `HUMAN_APPROVED` at Gate 2 before any assertion. `SEM-API-CONTRACT`
  enforces this at build time.
- **Structural-presence-only is read as a licence to assert labels or date format.** → The spec
  states presence of the three columns only and names `AMB-EC-11358-003`; exact labels and format
  stay deferred, consistent with the open EC-13271 date-format defect.
- **The Confirmed Transfer of Control precondition is non-deterministic to reproduce.** → Test data
  for the transfer-dependent scenarios is established at Gate 2 on the basis agreed in
  `AMB-EC-11358-001`; a scenario that cannot reach the precondition is marked `BLOCKED`, never
  fabricated as passing.
- **The QA host requires environment access that may be unavailable.** → `PLAYWRIGHT_VALIDATION` and
  execution halt as an environment blocker rather than producing a misleading result.

## Migration Plan

Not applicable. This change introduces a new capability specification and no existing behaviour,
data or interface changes.

## Open Questions

None that are safely deferrable in this document's sense. The four ambiguities were resolved at
Gate 1 and are recorded with status `RESOLVED` in
[requirements/approved/EC-11358.json](../../../requirements/approved/EC-11358.json). The one item that
remains genuinely open — the concrete contract for the two report APIs — is not an open question for
this document to answer: it is a Gate 2 obligation, captured from live traffic and approved by a
human, and is deliberately excluded from the specification.

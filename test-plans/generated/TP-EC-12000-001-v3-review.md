# Approval Gate 2 — Test Plan Review — TP-EC-12000-001 v3

| | |
| --- | --- |
| Test plan | `TP-EC-12000-001`, artifactVersion 3 |
| Story | EC-12000 — Phase 2_04: Improve Paper Out/Export to track if saving digital or papering out |
| Capability | `paper-out-export` |
| Release | 26.3 |
| Plan | `test-plans/generated/TP-EC-12000-001.json` |
| Status | PENDING_TEST_PLAN_APPROVAL |
| Supersedes | v2, approved 2026-09-14 (`test-plans/approved/TP-EC-12000-001-approval.json`) |
| v1 review | `test-plans/generated/TP-EC-12000-001-review.md` — retained unchanged |
| v2 review | `test-plans/generated/TP-EC-12000-001-v2-review.md` — retained unchanged |

This is a **revision of an already-approved plan**, not a new one. v2 carried 18 scenarios. This
revision changes **five** scenarios (`TS-EC-12000-011` through `-015`) and adds **nothing new**.
Every other scenario is untouched.

Approving this plan authorises the framework to design/execute automation against the revised
scenarios. It does **not** itself authorise calling `eoRequestExport` in a live test run — see the
open `CLEANUP` question below, which the automation review package (Gate 3) will also have to carry
forward.

---

## Why this revision exists

A human reviewer supplied, in chat, the runtime endpoint they believe `eoRequestExport` is reachable
at:

```
POST ${ecoreBaseUrl}/ecore/  (e.g. https://qa5.eoriginal.org:8443/ecore/)
Content-Type: multipart/form-data
  part "action"          = eoRequestExport
  part "instructionsXML"  = <eoExportInstructions XML file, per export-26.3.xsd>
```

Two new evidence files were also added to `reports/jira/attachments/`:

- `eoRequestExport.xml` — a SoapUI operation config confirming this is a SOAP action
  (`http://www.eoriginal.com/eoRequestExport`), request element `exportRequest`, response element
  `export`, request-response (not one-way). It names no host and no response fields.
- `Paper-Out.xml` — a fourth **request** sample, this time showing the full SOAP envelope
  (`soapenv:Envelope`/`Header`/`Body`) around `eoExportInstructions`, for a transaction-level,
  `mediaType`-omitted case. It is not a response.

**Neither file, nor the dictated endpoint, is independently corroborated.** No WSDL, integration
guide, or captured network trace names this host, method, or content type — it is the reviewer's own
recollection, confirmed twice in chat. Per `AGENTS.md` rule 4's drafting exception this is recorded
as:

- `contractSource: "UNVERIFIED"` (unchanged from v2 — **not** promoted to `HUMAN_APPROVED`)
- `contractProvenance` beginning `AGENT_DRAFTED`, carrying explicit `DICTATED:` (what the reviewer
  supplied) and `PROPOSED:` (the one field the agent filled in — `expectedStatusCodes: [200]`,
  since no success or fault response has ever been seen) segments
- `scaffoldingOnly: true`, unchanged — the API call still only **reaches a state**; it proves
  nothing by itself

**Why it can never become `HUMAN_APPROVED` as things stand:** that status requires a recorded
`responseShapeHash` (`src/utils/api-contract-shape.ts`), which is computed from an actual observed
response body. Nobody has one — the only response evidence anywhere in Jira is a screenshot image,
not transcribed text. So no matter how confident the endpoint dictation is, the *response* side of
this contract is unverifiable by construction, today. This is not a gap this revision tries to close.

## What changes, and what doesn't

| Aspect | v2 | v3 |
| --- | --- | --- |
| `apiContract.path` | `UNVERIFIED — not discoverable through this session's tools` | `${ecoreBaseUrl}/ecore/ ...` (AGENT_DRAFTED, dictated) |
| `apiContract.contractSource` | `UNVERIFIED` | `UNVERIFIED` (unchanged) |
| `apiContract.scaffoldingOnly` | `true` | `true` (unchanged) |
| How AC-011 through -015 are proven | UI audit trail only (`CLR-TP-EC-12000-001`) | **Unchanged** — UI audit trail only |
| `automationCandidate` | `false` | `true` (proposed) |
| `automationDecision` | `REVIEW_REQUIRED` | `AUTOMATE` (proposed — this gate decides) |

The scenarios' **assertions do not change at all.** What changes is that the framework can now
attempt to actually *place the call* that sets state, instead of the call being purely aspirational.
Nothing about how `AC-EC-12000-011` through `-015` are judged is different — they are still judged
exclusively by reading the Submitted Paper Out event's Additional Information in the UI, exactly as
`CLR-TP-EC-12000-001` already decided.

## Scenario-by-scenario

Only the five changed scenarios are listed. The other thirteen are unchanged from approved v2 and
are not re-opened by this revision.

| ID | Scenario | AC | Change |
| --- | --- | --- | --- |
| TS-EC-12000-011 | API mediaType=PrintToPaper at transaction level determines Media Type Paper | AC-EC-12000-011 | `apiContract` endpoint dictated; `automationCandidate` → `true` |
| TS-EC-12000-012 | API mediaType=PrintToPaper at document level determines Media Type Paper | AC-EC-12000-012 | same |
| TS-EC-12000-013 | API mediaType=SaveAsElectronicFile at transaction level determines Media Type Electronic | AC-EC-12000-013 | same |
| TS-EC-12000-014 | API mediaType=SaveAsElectronicFile at document level determines Media Type Electronic | AC-EC-12000-014 | same |
| TS-EC-12000-015 | API call omitting mediaType entirely determines Media Type Electronic | AC-EC-12000-015 | same |

## Open questions

**CLR-TP-EC-12000-004** *(new)* — Three things need your explicit decision, because none of them can
be inferred safely:

1. **Do you accept automating these five scenarios against a dictated-only endpoint?** Understand
   plainly: nothing but your own recollection corroborates it, and its response is completely
   unobserved. If the endpoint is wrong, the call may simply fail (safe), or it may reach an
   unintended host/operation with a real side effect, because this is a genuine request, not an
   observation.
2. **What is the required `CLEANUP` mechanism?** `eoRequestExport`'s own schema carries
   `deleteIfEmpty` and irreversible `retentionPolicy` attributes — it is destructive-by-name
   regardless of HTTP verb, per the API-client layering rule. Does each scenario cancel the
   submitted batch after asserting the audit trail — the same pattern `TS-EC-12000-003` already
   uses — or does something more permanent happen? **Name the exact mechanism; the agent must not
   choose one.**
3. **Fixture reuse.** The only qa5 collection that currently qualifies for Paper Out is already
   consumed sequentially by 8 approved UI scenarios (`TS-EC-12000-003`, `-007` through `-010`,
   `-016`). Confirm whether these 5 new scenarios reuse that same fixture too, or whether a separate
   one must be nominated.

**CLR-TP-EC-12000-002** and **CLR-TP-EC-12000-003** (carried over from v2, still `REVIEW_REQUIRED`
per the plan's `clarifications` array) are unrelated to this revision and are not re-opened by it —
they concern `TS-EC-12000-016`/`-020`/`-017`, none of which are touched here. If they are still open,
please also address them; this review package does not attempt to answer them for you.

## New risks

| ID | Level | Risk |
| --- | --- | --- |
| RISK-TP-EC-12000-005 | HIGH | The endpoint is dictated, not corroborated by any independent source. A wrong endpoint could reach an unintended host/operation with real side effects. Mitigated by `scaffoldingOnly: true` — a wrong or malformed response cannot produce a false pass, because nothing is asserted against it. |
| RISK-TP-EC-12000-006 | HIGH | `eoRequestExport` is destructive-by-name and would now be called for real against the same single shared qa5 fixture already used by 8 approved scenarios. Requires the `CLEANUP` mechanism named in `CLR-TP-EC-12000-004` before Gate 3 may wire it in. |

`RISK-TP-EC-12000-001` through `-004` are unchanged from v1/v2 and are not re-opened here.

## What this revision deliberately does not do

- It does **not** promote the contract to `HUMAN_APPROVED` — that is structurally impossible right
  now (no response evidence exists to hash).
- It does **not** change how any acceptance criterion is judged — the UI audit trail remains the
  sole source of truth for AC-011 through -015.
- It does **not** decide the `CLEANUP` mechanism for you — that is `CLR-TP-EC-12000-004`, and the
  agent will not guess one.
- It does **not** touch `TS-EC-12000-005`/`-006` (also `eoRequestExport`-dependent, but currently
  `DEFERRED` with no scenario drafted at all — out of scope for this revision).

## How to record your decision

A chat message is not an approval. Only a schema-valid artifact on disk counts.

1. Copy `test-plans/generated/TP-EC-12000-001-v3-approval.template.json` to
   `test-plans/approved/TP-EC-12000-001-approval.json`.
2. Set `decision`, and one entry in `itemDecisions` per scenario listed in the template.
3. Fill in `reviewer.name`, `reviewer.role` and `reviewedAt` (ISO 8601, UTC).
4. Answer **CLR-TP-EC-12000-004** in `comments` — all three numbered questions, explicitly.
5. Run `npm run validate:artifacts`.

`artifactVersion` in the approval must be **3** to bind to this revision. The approval currently on
disk is for v2 and does not carry forward — that is deliberate, and it is why this file exists.

Once the approval artifact is on disk, the orchestrator promotes
`test-plans/generated/TP-EC-12000-001.json` to `test-plans/approved/TP-EC-12000-001.json` and
returns to `BDD_DESIGN`/`AUTOMATION_REVIEW_PACKAGE` for the five affected scenarios.

**This revision reopens Gate 3 for TS-EC-12000-011 through -015 only.** Their Gherkin, step
definitions and any API client code will need to be written/regenerated to match; the `CLEANUP`
answer from `CLR-TP-EC-12000-004` must be recorded as a `CLEANUP -` comment on the client method
before it may be called in a real run, per `AGENTS.md`. The thirteen unaffected scenarios keep their
existing Gate 3 approval and are not touched.

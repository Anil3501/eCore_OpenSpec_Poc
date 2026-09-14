# EC-8321 — Framework Readiness Evaluation

**Story:** EC-8321 — *Configurable Paper Out Package via API*
**Evaluated:** 2026-09-10
**Evaluator:** framework readiness review, no artifacts created
**Verdict:** **NOT READY without a scope-currency check and a new API-discovery track.** The story itself is small, clean and entirely text-based (no image-only comments, unlike EC-11358). But it is nearly three years old, targets a **named integration API (`eoLogin`/`eoRequestExport`/`eoAuthorizeExport`/`eoVerifyExport`/`eoLogout`) that the framework's entire API-discovery methodology has never touched and does not even acknowledge exists**, and it directly overlaps with the `eoRequestExport` schema that a much newer story (EC-12000, evaluated previously) also modifies. Automating this today risks encoding a **stale, 2023-era contract** for an endpoint whose real shape has since changed.

This document evaluates only. No governed artifact was created, no stage was executed, and no workflow instance was opened for EC-8321. No file under `requirements/`, `test-plans/`, `features/`, `traceability/`, `workflow/` or `reports/jira/` was written by this review.

---

## 1. What the story actually is

| | |
| --- | --- |
| **Key** | EC-8321 |
| **Project** | **EC** (ECORE) |
| **Type** | **Story** ✅ |
| **Status** | **Closed** — resolution **Done** |
| **Priority** | Medium |
| **Fix Version** | **14.4** — released **2023-09-17** ⚠️ — by far the oldest of the three stories evaluated so far (EC-12000 and EC-11358 are both 26.3, released 2026-05-11) |
| **Created / Updated** | 2023-08-22 / 2024-02-21 — **no activity in ~2.5 years** relative to this evaluation |
| **Parent Epic** | **None** — not attached to any epic |
| **Related issues** | **EC-7372** — "Configurable Paper Out Package" (Closed/Done) — the **predecessor** story that built the UI-side version of this same customization. **EC-8673** — "Add Ability to insert 'Through 3rd Party System' Reference in Paper Out Certification Statement" (Closed/Done) — a **successor** story that adds a further business rule onto the *same* certification statement text this story modifies. |
| **Component** | Core+Mortgage |
| **Reporter** | Rae Kaphle. QA owner: Shreshta Jain. Assignee: none recorded at closure. |
| **Attachments** | **0** — no screenshots, no mockups, no evidence files at all |
| **Comments** | **5**, all real, substantive text (no image-only content — the opposite problem from EC-11358) |
| **Time invested** | **2h spent** against a **5h estimate** — under budget, the only one of the three evaluated stories that came in *under* estimate |
| **QA hours** | Est 3h / Actual 1h |
| **API Test Required?** (`customfield_11451`) | **Yes** — an explicit structured flag on the issue, not just prose |

### Story description (verbatim)
> Currently with [EC-7372] we only support customization of certification statement for Paper Out that occur via Command Center. Full support should also include the API.

### Acceptance criteria (Jira's real "Acceptance Criteria" field, `customfield_10700`)
1. If a vault is configured to support customized Paper Out functionality, all future Paper Out certification documents should contain the customized text in the signature field for Paper Outs that occur:
   - via **API request** (new)
   - via **Command Center** (existing)
2. Customization of the paper out certification document is **only available for Paper Out that occurs at Transaction level via API** (not document level).

### QA acceptance (`customfield_11200`)
> *QA Accepts this solution.*
> *Executed the following series of APIs for Configurable Paper Out ticket: `eoLogin`, `eoRequestExport`, `eoAuthorizeExport`, `eoVerifyExport`, `eoLogout`.*

### Comment thread (real content, no images)
- **Sarah Craten** (customer-facing): a named customer (DealerTrack) needs this via API because their workflow never uses the UI Paper Out.
- **Dan Bender**: links a GitLab merge request (`!3882`) — the actual code change.
- **PJ Disclafani**: hands the ticket to Shreshta Jain for API-side testing.
- **Shreshta Jain**: a full manual test procedure — switch environment to `qa3.eoriginal.org`, call `eoLogin`, call `eoRequestExport` with an uploaded/modified XML file (transaction sid/dpsid substituted), copy the batch id into `eoAuthorizeExport`, copy the `<packagedata>` element out of that response into a text file, upload that file elsewhere and click **"Decode"**, download the resulting **PDF**, and visually check it for the customized text.
- **Rae Kaphle**: "Tested in trunk. Product Approved."

---

## 2. The decisive findings

### 2a. Finding: the named API is a different architecture than anything the framework has discovered
`ecore-api-discovery.json` — the framework's only inventory of eCore's API surface — is built entirely from `PLAYWRIGHT_MCP_AUTHENTICATED_EXPLORATION`: watching what the **browser's AJAX layer** calls while a human/agent navigates the web UI. Its own architectural finding states plainly: *"eCore is a server-rendered Java application... there is no REST resource model... the AJAX endpoints are RPC-style verbs ending in `.eo`... requests are form-encoded."*

EC-8321's QA evidence names **`eoLogin`, `eoRequestExport`, `eoAuthorizeExport`, `eoVerifyExport`, `eoLogout`** — PascalCase operation names with **no `.eo` suffix and no `/ajax/` path**, invoked with **uploaded/downloaded XML files**, chained batch IDs, and a manual **"Decode"** step producing a PDF. None of these five names appear anywhere in `ecore-api-discovery.json`, in either the `OBSERVED` or `UNVERIFIED` (178-path) sections.

**Framework consequence:** This is not simply "one more undiscovered endpoint" (as in EC-11358's `eoGetDocumentActivityHistoryReport` gap). It indicates a **second, separate API surface** — a legacy B2B/XML integration API — that the framework's entire discovery methodology has never been pointed at, because that methodology only watches browser navigation, and this API is evidently invoked by an external tool/script, not by clicking through the Command Center UI. Before any scenario can be authored, this surface needs its **own** discovery pass (e.g. locating and exercising whatever tool QA used — apparently itself a browser page with an "eoLogin"/"eoRequestExport" form and a "Decode" button — through Playwright MCP, or documenting that it is intentionally out of the current framework's reach).

### 2b. Finding: direct schema overlap with a story already flagged as a hybrid-testing risk
`eoRequestExport` is also the exact endpoint modified by **EC-12000** ("Phase 2_04: Improve Paper Out/Export..."), which added an optional `mediaType` element to its request schema in the 26.3 release (2026-05-11) — nearly **three years after** EC-8321 (14.4, 2023-09-17) shipped its own change to the same endpoint's behaviour (injecting customized certification text).

**Framework consequence:** Any test authored today against EC-8321's stated behaviour must be built against **today's** `eoRequestExport` — which per rule 4 ("never guess an API contract") means live discovery, not the 2023-era description in this ticket. A scenario that recreates EC-8321's original XML payload verbatim risks silently failing to account for the newer `mediaType` field, or — worse — passing while validating an incomplete/outdated contract. This is exactly the failure mode `SEM-API-CONTRACT` and the `OBSERVED`-vs-`HUMAN_APPROVED` distinction exist to prevent, and it can only be avoided by treating this as a **fresh, current-state discovery**, not a replay of a stale ticket.

### 2c. Finding: the acceptance criteria describe one layer of certification-text customization; production now has at least three
Reading EC-8321 in isolation, "customized text in the signature field" appears to be the whole rule. But:
- **EC-7372** (predecessor) established the base customization mechanism at Org/BE level for the Command Center (UI) path.
- **EC-8321** (this story) extended that same mechanism to the API path.
- **EC-8673** (successor) added a *further* rule on top of the same certification statement: an authorized-feature-gated 125-character "Through 3rd Party System" phrase inserted at a specific point in the same paragraph this story customizes.

**Framework consequence:** None of the framework's non-invention rules are violated by EC-8321's own criteria — they are explicit and correct as written. But an automation pass that treats EC-8321 as the complete specification of "what the Paper Out certification statement should say today" would be wrong: the actual production text is a composite of at least three stories' rules. Any test plan for EC-8321 needs a companion review of EC-8673 (already closed) to avoid asserting an incomplete/obsolete certification-statement shape.

### 2d. Finding: the test procedure is a stateful, cross-tool workflow the current model doesn't represent
QA's steps are not "call an endpoint, assert the response": they chain **five separate calls across two different tools** (an API-calling page, and a separate decode utility), carry a **batch ID** and a **`<packagedata>` blob** between steps, and end in a **manual visual check of a decoded PDF**. Today's `src/api/ApiClient` model assumes one request → one Zod-validated response. There is no existing pattern in this repo for:
- multi-step ID/data threading across chained API calls, or
- generating/decoding and then asserting against a **PDF artifact** (the same document-content-assertion gap already flagged for EC-11358, §2e/Gap F5 in that story's evaluation — this is independent confirmation the gap is real and recurring, not a one-off).

### 2e. Finding: no visual evidence exists, and the story is stale enough to need revalidation regardless
Zero attachments means there is nothing to cross-check the described PDF signature-field text against. Combined with the ~2.5-year inactivity and the schema overlap in §2b, the safest read is: **the criteria are correct as a historical record, but must be re-verified live against the current application** before being treated as ground truth for a new test.

---

## 3. Stage-by-stage evaluation

| Stage | Verdict | Notes |
| --- | --- | --- |
| **`JIRA_RETRIEVAL`** | ✅ READY | Story exists, resolution=Done, real released fix version, real text throughout (no image-only content). Straightforward retrieval, unlike EC-11358. |
| **`REQUIREMENT_NORMALIZATION`** | ⚠️ READY (with a required companion read) | The 2 criteria are short and unambiguous on their own terms, but normalization should explicitly note the EC-8673 dependency (§2c) so the resulting requirement doesn't imply a complete certification-text specification when it is only one layer of one. |
| **`AC_ANALYSIS`** | ✅ READY | No internal ambiguity — API-only scope, Transaction-level-only constraint, both stated plainly. |
| **`AC_REVIEW_PACKAGE` / Gate 1** | ⚠️ READY (with one required decision) | Gate 1 must decide whether to scope this automation strictly to EC-8321's own criteria (accepting it may not reflect the full current certification-statement text) or to expand scope to also verify against EC-8673's and EC-12000's overlapping rules. Silence on this decision is itself a risk. |
| **`OPENSPEC_GENERATION`** | ⚠️ READY once the API surface is resolved | Behaviour is clear ("given a vault configured for customized paper out, when export occurs via API at transaction level, then certification text includes the custom phrase") but cannot be finalized without knowing which concrete API surface will carry it (§2a). |
| **`TEST_PLAN_GENERATION`** | ⚠️ NOT YET READY | `customfield_11451` ("API Test Required? = Yes") correctly signals this needs API-level testing, but the test plan cannot be written against a contract nobody has observed (§2a, §2b). No itemized scenario matrix exists in Jira (Test History field is empty headers-only, same pattern as EC-11358) — scenarios must be authored fresh: paper out via API with feature enabled/disabled, transaction vs. document level (negative case), UI path regression check. |
| **`TEST_PLAN_APPROVAL` / Gate 2** | ⚠️ NOT YET READY | Cannot approve a plan whose central contract (`eoRequestExport` et al.) is `API_CONTRACT_UNVERIFIED` and whose current shape is known to have changed since this ticket (EC-12000's `mediaType` addition). |
| **`BDD_DESIGN`** | ⚠️ BLOCKED pending discovery | No existing capability directory covers this integration-API surface; a new one is needed, but its design depends entirely on what §2a's discovery pass finds. |
| **`AUTOMATION_REVIEW_PACKAGE` / Gate 3** | ❌ NOT READY | Nothing here is `MCP_VALIDATION_REQUIRED`-ready yet because the surface to validate hasn't been located, let alone exercised. |
| **`IMPLEMENTATION`** | ❌ NOT READY | Blocked behind discovery of the integration API and a decision on the multi-step/PDF-decode workflow (§2d), which has no existing pattern in `src/api/` or `src/utils/` to build from. |

---

## 4. Framework gaps revealed by EC-8321

### Gap F7: A second API surface exists that the discovery methodology has never reached
**What:** `eoLogin`/`eoRequestExport`/`eoAuthorizeExport`/`eoVerifyExport`/`eoLogout` are real, QA-exercised operations that do not appear anywhere in `ecore-api-discovery.json`, and their naming/invocation pattern (file upload, batch ID chaining, a separate "Decode" step) doesn't match the browser-AJAX `.eo` pattern the discovery document describes as eCore's *entire* API surface.
**Why it matters:** The discovery document's architectural finding ("no REST resource model... AJAX endpoints are RPC-style verbs ending in `.eo`") is presented as a complete picture. EC-8321 shows it is **not complete** — there is at least one more API surface, reached through a different tool, that the current discovery methodology (watching browser navigation) structurally cannot see.
**Recommended fix:** Before scoping any story that touches "eoXXX"-named operations (a naming convention distinct from the `.eo`-suffixed AJAX paths), run a dedicated discovery pass against whatever tool exposes them — likely a Command Center "API Tester" page reachable via the browser, which would make it discoverable via Playwright MCP after all, just not through the same navigation paths already explored. Update `ecore-api-discovery.json`'s architectural finding once this is confirmed either way.

### Gap F8: A structured "API Test Required?" signal exists in Jira but isn't consumed anywhere in the framework
**What:** `customfield_11451` is a clean Yes/No flag, present and set to "Yes" on this story, that directly answers the exact question the framework's `@interface-ui`/`@interface-api`/`@interface-hybrid` tagging scheme needs answered at Gate 2.
**Why it matters:** Nothing in `jira-requirement-analysis.agent.md`, the workflow definition, or the Zod requirement model currently looks for this field. It is being computed by product/QA already and then silently discarded.
**Recommended fix:** Have requirement-normalization surface this field's value (when present) into the review package as an observation — not a classification, per the existing rule that interface classification is a Gate 2 testing decision — but currently it isn't even surfaced for a human to weigh.

### Gap F9: No pattern exists for stateful, cross-tool, artifact-producing API workflows
**What:** EC-8321's real test procedure chains multiple calls with data threaded between them and ends in decoding a PDF for visual inspection — not a single request/response pair.
**Why it matters:** This is the second independent story (after EC-11358's Gap F5) to need document-artifact assertion, and the first to need multi-step ID-threading across chained calls. Both point at the same missing capability from different angles.
**Recommended fix:** Treat as a shared design item across both stories rather than solving it twice — a small "chained API call + artifact decode" utility, scoped once both stories are ready to implement.

### Pre-existing/cross-story gaps confirmed here, not new
1. **API contract currency** — reinforces (does not newly introduce) the framework's `OBSERVED` vs `HUMAN_APPROVED` distinction: a 3-year-old ticket's described contract for `eoRequestExport` is now provably out of date (EC-12000 added `mediaType`), which is precisely the scenario that rule exists to guard against.
2. **Test History field empty** — same pattern as EC-11358: Jira's per-scenario test matrix field exists but isn't used; only an aggregate QA comment records acceptance.

---

## 5. Story quality assessment

| Dimension | EC-8321 | EC-11358 (reference) | EC-12000 (reference) |
| --- | --- | --- | --- |
| **Type** | Story ✅ | Story ✅ | Story ✅ |
| **Specification** | 2 short, explicit criteria | 7 explicit criteria | 11 itemized scenarios |
| **Acceptance proof** | "QA Accepts" + named API sequence ✅ | "QA Accepts" + build version ✅ | "QA Accepts" + build version ✅ |
| **Comment quality** | 5 comments, **100% real text** ✅ | 27 comments, **0% extractable text** ❌ | 25 comments, real text ✅ |
| **Attachments** | **0** ❌ (no visual evidence at all) | 14 PNG screenshots (uninterpretable) | 20 files incl. video/evidence |
| **Age** | Created 2023, released 2023-09-17 — **~3 years old** ⚠️ | Created ~2025, released 2026-05-11 | Created ~2025, released 2026-05-11 |
| **Time accounting** | 2h / 5h estimate (under) | 75h / 7h estimate (10.7x over) ⚠️ | 37.75h / 21h estimate (1.8x over) |
| **Related stories** | 2 (predecessor + successor touching the same text) — real scope-currency risk ⚠️ | 1 (related bug, same event dependency) | 1 (parent epic) |
| **API surface known?** | **No — an entirely undiscovered integration API** ❌ | Partial — one named endpoint missing from inventory | Yes — endpoint exists in framework's assumed model |
| **Structured signals used by framework today** | "API Test Required?" flag present but **unused** by the framework | n/a | n/a |

**Summary:** EC-8321 is the cleanest-written of the three stories (no image-only comments, short and unambiguous criteria) but is also the **least automation-ready**, because its entire premise depends on an API surface the framework has never discovered, and because its stated contract is now known to be stale relative to a story already evaluated. This is a "the words are clear but the ground has shifted" risk profile — different from EC-11358 ("the words are clear but we can't reach the target") and from EC-12000 ("the words and target are both fine, but a first-of-kind design choice is needed").

---

## 6. Recommended next steps (evaluation only — no artifacts to create yet)

1. **Run a dedicated discovery pass for the integration API** (`eoLogin`/`eoRequestExport`/`eoAuthorizeExport`/`eoVerifyExport`/`eoLogout`) before writing anything — locate whatever tool QA used (likely a browser-reachable "API Tester" utility) and exercise it via Playwright MCP so these operations move from "unknown" to `OBSERVED` (Gap F7).
2. **Treat `eoRequestExport`'s contract as current-state-unknown**, not as described in this 2023 ticket — confirm its live shape (including the `mediaType` element EC-12000 added) before authoring any scenario against it (§2b).
3. **Pull EC-8673 into the requirement-normalization read** so the resulting requirement doesn't imply EC-8321 is the complete certification-statement specification (§2c).
4. **Surface `customfield_11451` ("API Test Required?")** in the review package as an observation for Gate 2, and consider adding it to the requirement-normalization stage going forward for all stories, not just this one (Gap F8).
5. **Design the chained-call + artifact-decode utility once**, shared with EC-11358's document-assertion need, rather than solving each story's version of the same gap independently (Gap F9).
6. Only after 1–3 are addressed should Gate 1 (`AC_REVIEW_PACKAGE`) actually be opened for EC-8321.

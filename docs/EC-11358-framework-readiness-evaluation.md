# EC-11358 — Framework Readiness Evaluation

**Story:** EC-11358 — *Phase 2_13: Add new section to Document Activity History Report delineating the control history*
**Evaluated:** 2026-09-10
**Evaluator:** framework readiness review, no artifacts created
**Verdict:** **CONDITIONALLY READY — higher risk than prior evaluated stories (EC-12000).** The acceptance criteria are explicit and testable, and the story carries QA acceptance on a released version. But this story is a **first-of-kind capability** (no existing page objects, feature files or API clients for document history reporting), references an **undiscovered API endpoint**, spans **three test surfaces** (live UI, downloaded/printed document, API), and its supporting discussion lives almost entirely in **screenshots the framework cannot read**. Several of these gaps are new — they were not present in the EC-12000 evaluation — and should be resolved or explicitly accepted before Gate 1.

This document evaluates only. No governed artifact was created, no stage was executed, and no workflow instance was opened for EC-11358. No file under `requirements/`, `test-plans/`, `features/`, `traceability/`, `workflow/` or `reports/jira/` was written by this review.

---

## 1. What the story actually is

| | |
| --- | --- |
| **Key** | EC-11358 |
| **Project** | **EC** (ECORE) |
| **Type** | **Story** ✅ |
| **Status** | **Closed** — completed, verified |
| **Resolution** | **Done** |
| **Priority** | Medium |
| **Fix Version** | **26.3** — released 2026-05-11 (same release as EC-12000) ✅ |
| **Parent** | **EC-12623** — "Q2 Article 8 Usability Enhancements" (**Epic, still Open** — the parent initiative has not closed even though this child story has) ⚠️ informational, not a blocker |
| **Linked issue** | **EC-12511** — "Release from Pledge doesn't log Transfer events in Document History" (Story, **Closed/Done**, `Relates`) — see §2d |
| **Component** | Core+Mortgage |
| **Assignee / Reporter** | Reporter: Pam Baumgarten (product). QA owner: Shreshta Jain. |
| **Attachments** | **14 files**, all `image/png` (screenshots/mockups, no video, no exported package samples) |
| **Comments** | **27 comments** (Nov 2025 – Apr 2026) |
| **Time invested** | **75h spent** against a **7h original estimate** — a **~10.7x overrun**, markedly higher variance than EC-12000's 1.8x |
| **QA Hours** | Est 3h / Actual 3h; **"Times in QA" = 3** (rejected/re-tested at least twice before acceptance) |

### Story description (verbatim, condensed)
> When a document is transferred between organizations, the document history retains the auditable events, including all transfer events. This project creates a new **Control History** table in the document history that consolidates all transfers of the document into a table to easily see the chain of control for a financial asset. This is similar to the MERS Controller and Location History table populated in the document history for SMARTDocs. The table includes the date of the transfer and the Transfer From and To Orgs.

### Acceptance criteria (from Jira's actual "Acceptance Criteria" field, `customfield_10700`)
1. Create a new table in the Document Activity History Report (UI and downloaded) called **Control History**.
2. Included only when the Document Designation is a **Financial Asset** or **Financial Asset Addendum**.
3. Sorted by **newest to oldest** events.
4. Entries populated from the **Confirmed Transfer of Control** events for a document.
5. Included in **all instances** of the Document Activity History Report: View History (UI), downloaded history report (UI), Certified Print package, Export(API)/Paper Out(UI) package, and `eoGetDocumentActivityHistoryReport`.
6. Included in **all versions** of a document (Digital Original, retention copy, etc.).
7. Columns: **Date** (`MM/dd/yyyy hh:mm:ss a z`, e.g. `10/05/2026 10:20:18 AM EST`), **Transferred To** (full org name), **Transferred From** (full org name).
8. A "Sample Mockup" is referenced in the criteria text but rendered as an inline image — **not extractable by this review** (see §2c).

### QA acceptance (`customfield_11200`, "QA Feedback and Resolution")
> *QA Accepts the solution*
> *Tested on 26.3+20260427181434*

### Test History field (`customfield_11401`)
Present but **empty** — column headers only (Date / Status / Version / Tester), no rows. Unlike EC-12000, there is **no itemized scenario-by-scenario test matrix** in Jira; only the aggregate QA sign-off comment above.

---

## 2. The decisive findings

### 2a. Finding: The Acceptance Criteria field is correctly populated, but is not returned by default
Unlike EC-12000 (criteria in a non-standard developer field), EC-11358's criteria are in Jira's real **"Acceptance Criteria"** field. In this project that field's ID is `customfield_10700` — note this is a **different field ID** than the one referenced as the "standard field" in the EC-12000 evaluation (`customfield_11444`). Field IDs for the same *named* field are **not guaranteed stable across Jira configurations/screens** even within the same site.

**Framework consequence:** `atlassian-getJiraIssue`'s default field set (`summary, description, status, issuetype, priority, labels, components, assignee, reporter, created, updated, resolution, project`) does **not** include any custom field. A requirement-analysis pass that trusts the default response would see no acceptance criteria at all and could incorrectly conclude "Jira contains no ACs," triggering the framework's proposal-and-clarify path for a story that already has complete, human-authored criteria.

**Is this a blocker?** No, but it is a **process trap**, not just a data-location quirk. The agent must always request `fields: ["*all"]` (or resolve the AC field by matching against `names` for "Acceptance Criteria") before concluding a story lacks criteria — never rely on the default field set to make that determination.

### 2b. Finding: the substantive discussion is almost entirely in screenshots
27 comments span ~6 months of back-and-forth (Nov 2025 – Apr 2026, matching the 75h/7h estimate blowout and "Times in QA = 3"). Extracting the plain text of every comment body yields **zero words** — every comment consists solely of embedded/pasted images. The 14 attachments are all PNG screenshots with no accompanying descriptive text in the issue itself.

**Framework consequence:** Neither the Atlassian MCP `getJiraIssue` tool nor this framework has an image-interpretation step. All of the negotiation that produced the final 7-bullet acceptance criteria — likely including exactly how the mockup lays out the Control History table, what "similar to the MERS Controller and Location History table" means visually, and what drove the estimate blowout — is **invisible to an automated read of this issue**. This is a materially bigger version of a risk only implicit in EC-12000 (which had 20 attachments but also 25 comments with real text).

**Is this a blocker?** Not for the 7 explicit criteria, which are self-contained text. It **is** a blocker for anything not covered by that text (exact column order/styling, whether additional columns appear, whether the table title matches "Control History" exactly as rendered). A human reviewer must open the 14 attachments directly in Jira before Gate 1 — the framework cannot substitute for that.

### 2c. Finding: this is a first-of-kind capability — no existing automation surface
Searching `src/pages/`, `features/approved/`, and `src/api/` finds automation only for sign-in, home navigation, workspace, vault, organization and preferences pages (from ETA-351 / ETA-411). There is:
- **No page object** for the Document Activity History Report, View History dialog, Certified Print package, or Paper Out/Export package viewer.
- **No feature file or capability directory** for document/transaction history.
- **No API client** touching document history retrieval.

**Framework consequence:** None of this is a defect — every capability starts as a first-of-kind. But it means EC-11358 cannot reuse an existing page object or Gherkin pattern the way a story in `account-access` or `home-navigation` could. Implementation effort and locator-discovery effort (via Playwright MCP, per the framework's no-guessed-locator rule) will be materially higher than either prior evaluated story.

### 2d. Finding: the referenced API endpoint is completely undiscovered
Acceptance criterion 5 names `eoGetDocumentActivityHistoryReport` explicitly as one of five report surfaces the Control History table must appear in. Searching `reports/validation/ecore-api-discovery.json` — the framework's full inventory of both **observed** and **declared-but-unverified** `.eo` endpoints (178 unverified paths) — finds **no match at all** for this name, in either category.

**Framework consequence:** This endpoint is not merely `UNVERIFIED` (declared but unexercised) — it isn't even in the discovery inventory. Per rule 4 ("never guess an API contract"), nothing about this endpoint's request shape, response shape or even its existence as a live path may be assumed. A fresh Playwright MCP exploration session (`npm run capture:session` + live navigation to trigger the Certified Print / Export flows) is required before any API-level scenario naming this endpoint can be authored, and even then the result is `OBSERVED`, not `HUMAN_APPROVED` — it can seed state, never judge an acceptance criterion (framework rule 4/`SEM-API-CONTRACT`).

### 2e. Finding: three test surfaces, not two — download/print artifacts are a new automation dimension
EC-12000 exposed a UI+API hybrid gap. EC-11358 goes further: acceptance criterion 5 requires the Control History table to appear identically across **five surfaces**: (1) live "View History" UI, (2) a **downloaded** history report, (3) a **Certified Print package**, (4) an **Export(API)/Paper Out(UI) package**, and (5) the API endpoint from §2d. Surfaces 2–4 are generated **documents** (likely PDF or similar), not live DOM the framework's Playwright locators can query, and not a JSON/HTML response an API client contract can parse cleanly either.

**Framework consequence:** There is currently no document-content-assertion capability in this repo (no PDF/print-artifact parsing utility under `src/utils/` or `src/api/`). Verifying criterion 5 fully requires either (a) a new document-parsing utility, or (b) scoping automated coverage to the live-UI and API surfaces only and treating the downloaded/printed artifacts as a manual or reduced-fidelity check, with that scope decision recorded explicitly at Gate 2.

---

## 3. Stage-by-stage evaluation

| Stage | Verdict | Notes |
| --- | --- | --- |
| **`JIRA_RETRIEVAL`** | ⚠️ READY (with a required correction to defaults) | Story exists, resolution=Done, real released fix version. But retrieval **must** explicitly request all fields (or resolve the AC field by name) — the default field set silently omits the populated Acceptance Criteria field (§2a). |
| **`REQUIREMENT_NORMALIZATION`** | ⚠️ READY (with a mandatory human step) | The 7 criteria are explicit and self-contained text. But all supporting nuance lives in 14 untextual screenshots (§2b); a human must view them in Jira directly before normalization is trusted as complete. |
| **`AC_ANALYSIS`** | ⚠️ PARTIALLY READY | Criteria 1–4, 6, 7 are unambiguous. Criterion 5 (five report surfaces) and the unnamed "Sample Mockup" raise real ambiguity: exact column set/order beyond the three named columns, and whether all five surfaces are in automatable scope, need an `AMB-*` entry, not an assumption. |
| **`AC_REVIEW_PACKAGE` / Gate 1** | ⚠️ READY (with two decisions) | Gate 1 must: (a) confirm the field-retrieval correction was applied so no criteria were silently missed, (b) decide in-scope surfaces for automation (live UI + API vs. all five) given the download/print-artifact gap (§2e). |
| **`OPENSPEC_GENERATION`** | ✅ READY once scope is decided | Criteria map cleanly to behaviours: "given a Financial-Asset-designated document with N confirmed transfers, when the Activity History Report is viewed/downloaded, then a Control History table appears sorted newest-first with Date/To/From columns." |
| **`TEST_PLAN_GENERATION`** | ⚠️ READY (with new scenario authoring, not reuse) | Unlike EC-12000, there is no itemized Jira test matrix to convert 1:1 (§ Test History field is empty). The test plan must derive its own scenarios: financial asset vs. addendum vs. non-qualifying doc type, zero/one/many transfers, sort order, each in-scope surface, and the Digital Original vs. retention-copy version case. |
| **`TEST_PLAN_APPROVAL` / Gate 2** | ⚠️ READY (with contract-verification note) | Any scenario naming `eoGetDocumentActivityHistoryReport` must be tagged around an `API_CONTRACT_UNVERIFIED` placeholder until a live MCP exploration observes it (§2d) — it cannot be `HUMAN_APPROVED` sight-unseen. |
| **`BDD_DESIGN`** | ⚠️ READY (first-of-kind) | No existing capability directory to extend; a new one (e.g. `document-activity-history`) must be created from templates, not copied from `account-access`/`home-navigation`. |
| **`AUTOMATION_REVIEW_PACKAGE` / Gate 3** | ⚠️ NOT YET READY | Locators for the new Control History table, and the request/response shape of `eoGetDocumentActivityHistoryReport`, are both `MCP_VALIDATION_REQUIRED` / `API_CONTRACT_UNVERIFIED` today — real, not placeholder, exploration is needed before this gate can be reached. |
| **`IMPLEMENTATION`** | ⚠️ HIGHER EFFORT THAN PRIOR STORIES | New page object(s) for the report view(s), a new capability directory, and — if surfaces 2–4 are kept in scope — a new document/print-artifact assertion utility. Estimated effort meaningfully higher than EC-12000's UI+API hybrid case. |

---

## 4. Framework gaps revealed by EC-11358

### Gap F3: Default Jira field retrieval silently omits populated custom fields
**What:** `getJiraIssue`'s default field list never includes custom fields, even when the story-critical Acceptance Criteria live in one (as they correctly do here, in `customfield_10700`).
**Why it matters:** A requirement-analysis pass that trusts default fields could falsely report "no acceptance criteria found" for a story that has explicit, complete criteria — an incorrect finding that would waste a Gate 1 review cycle re-deriving criteria that already exist.
**Recommended fix:** Codify in the `jira-requirement-analysis` agent instructions (or the workflow stage contract) that retrieval must always pass `fields: ["*all"]`, or resolve the AC field dynamically from the `names` map by matching "Acceptance Criteria" (not by hardcoding any specific `customfield_NNNNN` ID, since — per this story vs. EC-12000 — the ID is not stable).

### Gap F4: No handling for image-only/screenshot-only discussion threads
**What:** A story's comments can be 100% images with zero extractable text, meaning the negotiation history behind the final criteria is invisible to any automated read.
**Why it matters:** This is the first evaluated story where *every* comment is image-only (EC-12000 had real text in its 25 comments). As more stories are pulled through the pipeline, this pattern will recur for any team that discusses UI changes primarily via annotated screenshots.
**Recommended fix:** Document as a standing Gate 1 procedural step: "if comment/description text yields no usable content but attachments exist, the human reviewer must open attachments directly in Jira; the agent must flag this explicitly in the review package rather than silently proceeding on text alone."

### Gap F5: No document/print-artifact assertion capability
**What:** Acceptance criteria that require verifying a **downloaded** report or a **printed/Certified** package have no home in the current automation surface — Playwright locators and API/Zod contracts both assume DOM or structured-response content, not a generated document.
**Why it matters:** EC-11358 is the first story that needs this. It will not be the last — Certified Print packages and Paper Out/Export packages are named surfaces the framework already knows about (from EC-12000's own Paper Out feature), but no scenario has yet had to open and assert against the resulting artifact's *content*.
**Recommended fix:** Treat as a design decision at Gate 2: either build a minimal document-content assertion utility (scope-limited, e.g. text extraction from the downloaded artifact) or explicitly descope the three generated-document surfaces from automated coverage for this story, recording that decision and its rationale in the test plan.

### Gap F6: `eoGetDocumentActivityHistoryReport` is absent from the API discovery inventory
**What:** The endpoint named directly in acceptance criterion 5 is not present anywhere in `ecore-api-discovery.json`, observed or unverified.
**Why it matters:** The discovery inventory was meant to be the complete map of what the application's markup declares. A story-critical endpoint being entirely absent suggests the inventory may need to be refreshed/expanded, or that this endpoint is invoked in a code path (e.g. Certified Print generation) that the original discovery pass never navigated to.
**Recommended fix:** Before Gate 3, run a targeted Playwright MCP exploration exercising the Certified Print / downloaded-report / Paper Out flows specifically, to observe this endpoint (or confirm it is client-side generated with no server round trip at all, which would itself be a useful, previously unknown fact).

### Pre-existing gaps that do NOT block EC-11358
1. **Jira field ID instability (echoes Gap F1 from EC-12000, but more general)** — EC-12000 documented one specific field-mapping mismatch; EC-11358 shows the underlying issue is broader: field IDs for identically-named fields are not portable across configurations, so no field should ever be hardcoded by ID.
2. **Parent epic still Open** — EC-12623 has not closed even though this child story has. Purely informational; does not affect this story's own closed/verified status.

---

## 5. Story quality assessment

| Dimension | EC-11358 | EC-12000 (reference) |
| --- | --- | --- |
| **Type** | Story ✅ | Story ✅ |
| **Specification** | 7 explicit acceptance criteria (structural, not a scenario matrix) | 11 itemized test scenarios |
| **Acceptance proof** | "QA Accepts the solution" + build version ✅ | "QA Accepts the solution" + build version ✅ |
| **Development proof** | 75h logged against 7h estimate (10.7x overrun) ⚠️ | 37.75h logged against 21h estimate (1.8x overrun) |
| **QA cycles** | "Times in QA" = 3 (multiple rejections before acceptance) ⚠️ | Not recorded as multiple cycles |
| **Fix version** | 26.3, released 2026-05-11 ✅ | 26.3, released 2026-05-11 ✅ |
| **Comments** | 27, but **0 extractable words** (all images) ⚠️ | 25, with substantive real text |
| **Attachments** | 14 PNG screenshots only | 20 files incl. video and test evidence |
| **Linked issues** | 1 related closed bug (EC-12511, same event type dependency) | 1 parent epic |
| **Automation surface** | **None exists** — first-of-kind capability | Extends existing Paper Out feature area |
| **Test surfaces required** | 5 (UI, downloaded, print, export package, API) | 2 (UI, API) |

**Summary:** EC-11358 has equally strong *proof of closure* (QA acceptance, released version) but is structurally riskier than EC-12000 on every automation-relevant axis: no scenario matrix, no reusable automation surface, an undiscovered API endpoint, generated-document surfaces the framework has no assertion capability for, and a 10x estimate overrun with 3 QA rejection cycles suggesting the requirement itself moved during development — all reasons to treat this as **higher scrutiny at Gate 1**, not a routine pass-through.

---

## 6. Recommended next steps (evaluation only — no artifacts to create yet)

1. **Fix the retrieval habit first.** Before opening Gate 1 for this story (or any other), always request `fields: ["*all"]` from `getJiraIssue`, or resolve the Acceptance Criteria field dynamically by name — do not rely on the tool's default field set (Gap F3).
2. **Have a human open the 14 attachments in Jira directly** before trusting the 7-bullet criteria as complete — the mockup and screenshot-only comment history may carry visual detail (e.g. exact column order/styling) the text does not (Gap F4).
3. **Decide automation scope for the 5 report surfaces at Gate 1/2**, explicitly recording whether downloaded/Certified Print/Export-package content verification is in scope for this pass or deferred (Gap F5).
4. **Run a live Playwright MCP exploration** of the Certified Print / downloaded-report / Paper Out flows to observe `eoGetDocumentActivityHistoryReport` (or confirm it is not server-invoked) before any API-level scenario references it (Gap F6).
5. **Treat the linked bug EC-12511** (Release from Pledge not logging Transfer events) as a required test-data consideration: since Control History entries are sourced from Confirmed Transfer of Control events, a Release-from-Pledge document should be included in test data to confirm that dependency holds under this new report.
6. Only after 1–4 are addressed should Gate 1 (`AC_REVIEW_PACKAGE`) actually be opened for EC-11358.

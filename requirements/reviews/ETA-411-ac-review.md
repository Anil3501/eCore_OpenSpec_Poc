# ETA-411 — Acceptance Criteria Review (Approval Gate 1)

| | |
| --- | --- |
| **Story** | ETA-411 — Create tests to use Home screen icons |
| **Release** | 1.0 *(confirmed by reviewer 2026-09-01; still absent from Jira — AMB-ETA-411-004)* |
| **Capability** | `home-navigation` |
| **Artifact under review** | [requirements/normalized/ETA-411.json](../normalized/ETA-411.json) v1 |
| **Raw Jira snapshot** | [requirements/raw/ETA-411.json](../raw/ETA-411.json) |
| **Approval template** | [requirements/reviews/ETA-411-ac-approval.template.json](ETA-411-ac-approval.template.json) |
| **Approval must be saved to** | `requirements/approved/ETA-411-ac-approval.json` |

## The story in full

The entire Jira description is one sentence:

> With Org users, login to eCore and click on each of the Icons on the Home page, verify that you are
> taken to the correct page, and click Command Center in the upper left corner to return to the Home Page.

There is no Acceptance Criteria section, no attachment, no comment and no linked issue. Everything
below is either a decomposition of that sentence or an observation of the running application.

## How the unknowns were filled

The story names neither the icons nor their destinations. Rather than invent them, the Home page was
observed against the real QA application on 2026-09-01, signed in as an organization user. The
evidence is [reports/validation/ETA-411-home-icons-probe.json](../../reports/validation/ETA-411-home-icons-probe.json)
and a full-page screenshot alongside it. The probe source is
[scripts/eta-411-home-icons-probe.ts](../../scripts/eta-411-home-icons-probe.ts).

**What the probe establishes:** three dashboard icons exist, each is actionable, each leads to a
specific page, and the upper-left control does return the user Home. Each icon was clicked and the
return leg walked, so the destinations are observed behaviour rather than inferred from `href`
attributes.

**What the probe cannot establish:** what any icon is *for*, who is allowed to use it, whether the
set is the same for other users, or which of these the story actually cares about. Those were the
five ambiguities, answered on 2026-09-01 and recorded below.

### Observed icon set

| Icon | Destination reached by clicking | Returned Home via upper-left control |
| --- | --- | --- |
| New Transaction | `/ssweb/setup/container/ct/newPackage.eo` — shows a "Create Transaction" heading | yes |
| Workspace | `/ssweb/setup/workspace/workspace.eo` | yes |
| Preferences | `/ssweb/setup/prefs/preferences.eo` | yes |

All three tiles sit in a `#icon-buttons` container.

### Correction: the header duplicates two tiles, not three

AMB-ETA-411-001 was answered as "the tiles plus the three header nav duplicates". That answer
assumed a symmetry the application does not have. The header exposes:

| Header control | Destination |
| --- | --- |
| `a#header.new_transaction` | `/ssweb/setup/container/ct/newPackage.eo` |
| `a#header.workspace` | `/ssweb/setup/workspace/workspace.eo` |
| `a#header.home` | `/ssweb/setup/welcome.eo` |
| `a#header.logout` | logout |

There is **no header Preferences link**. The only header-area route to `preferences.eo` is a menu
link labelled **"Organization"** — a different name for the same destination. Rather than invent a
link that does not exist, the new criteria cover the two real duplicates and the Preferences route
is carried forward as **AMB-ETA-411-006**, which is the one question still open.

## Requirements

| ID | Requirement | Source |
| --- | --- | --- |
| REQ-ETA-411-001 | The journey is performed as an authenticated organization user. | Jira |
| REQ-ETA-411-002 | Every icon on the Home page can be activated. | Jira |
| REQ-ETA-411-003 | Activating an icon takes the user to the page that icon stands for. | Jira |
| REQ-ETA-411-004 | A Command Center control in the upper left returns the user to the Home page. | Jira |

## Acceptance criteria — please decide on each

| ID | Criterion | Source | Evidence strength |
| --- | --- | --- | --- |
| AC-ETA-411-001 | Organization user who signs in arrives at the Home page. | Jira | Observed |
| AC-ETA-411-002 | Home page offers three activatable tiles: New Transaction, Workspace, Preferences. | **Proposed** | Observed |
| AC-ETA-411-003 | New Transaction tile leads to the New Transaction page. | **Proposed** | Observed by navigation |
| AC-ETA-411-004 | Workspace tile leads to the Workspace page. | **Proposed** | Observed by navigation |
| AC-ETA-411-005 | Preferences tile leads to the Preferences page. | **Proposed** | Observed by navigation |
| AC-ETA-411-006 | Command Center control in the upper left returns the user Home. | Jira | Observed by navigation |
| AC-ETA-411-007 | Header nav offers New Transaction and Workspace links duplicating the tiles. | **Proposed — new** | Observed in markup |
| AC-ETA-411-008 | Header New Transaction link leads to the New Transaction page. | **Proposed — new** | **`href` only — never clicked** |
| AC-ETA-411-009 | Header Workspace link leads to the Workspace page. | **Proposed — new** | **`href` only — never clicked** |

Two criteria come straight from the story text. Seven are proposed, because the story does not
enumerate the icons or name their destinations. **Approving a proposed criterion means you are
confirming it is the intended product behaviour, not merely that it is what the application
currently does.** That distinction matters: a test built on observed behaviour will pass whether or
not the behaviour is correct.

AC-ETA-411-008 and AC-ETA-411-009 are weaker still. Their destinations come from the link `href`,
not from walking the link. An `href` is not proof of navigation — a redirect, an interstitial or a
permission check can intervene. Both must be confirmed during `PLAYWRIGHT_VALIDATION` before any
test asserts them.

## Ambiguities — five answered, one still open

The answers below were given on 2026-09-01 and are recorded in the normalized artifact with
`resolvedBy`. Approving this artifact confirms them.

| ID | Question | Answer |
| --- | --- | --- |
| AMB-001 | Which controls count as "Icons on the Home page"? | The three dashboard tiles **plus** the header nav duplicates. The wider ~15-destination menu is out of scope. Corrected: only two duplicates exist. |
| AMB-002 | What proves the user reached "the correct page"? | **The landing URL is acceptable proof.** No per-destination element needs naming. |
| AMB-003 | Is the icon set the same for every organization user? | Yes — identical for all organization users. |
| AMB-004 | Which release? | 1.0 confirmed. |
| AMB-005 | Is the Command Center control an accessibility defect? | Accepted as-is. Not filed as a defect. Automate via `#bannerBackground` with a `VALIDATED` waiver. |

### Three of those answers carry a cost you should see stated

**AMB-002 — accepted false-pass risk.** A URL assertion cannot tell a correctly rendered page from
one that reached the right address but rendered an error, an empty result or a permission refusal.
Such a case passes. This is knowingly accepted; if it later matters, naming a visible element per
destination reopens this question rather than being a change of test detail.

**AMB-003 — an assertion, not evidence.** Reconnaissance used a single account, so the artifact
holds no evidence either way. This is recorded as your statement about intended behaviour.
`AMB-ETA-351-006` asked the same thing for ETA-351 and **remains open there** — this does not close
it.

**AMB-005 — a known gap left unrecorded.** The control still exposes no accessible name, so keyboard
and assistive-technology users have no named control to operate. AC-ETA-411-006 will pass regardless.
The artifact records that this was left unfiled on your instruction.

### Still open

**AMB-ETA-411-006 — How should Preferences be reached from the header?**
Bringing the header duplicates into scope creates an asymmetry: New Transaction and Workspace each
have two routes, Preferences has one. The only header-area route to `preferences.eo` is a menu link
labelled **"Organization"**. Is that link in scope as the third route, is the Preferences tile the
only in-scope route, or is "Organization" a distinct destination that happens to share a URL? The
naming mismatch may itself be a product inconsistency, but that is a judgement about the application
that requirement analysis may not make. This can be answered in the approval or deferred without
blocking the other criteria.

## To approve

1. Copy [ETA-411-ac-approval.template.json](ETA-411-ac-approval.template.json) to
   `requirements/approved/ETA-411-ac-approval.json`.
2. Replace every `REPLACE_WITH_*` placeholder. Set the top-level `decision` and one `decision` per
   criterion — `APPROVE`, `REJECT`, `DEFER` or `REQUEST_CHANGES`. There are now **nine** criteria.
3. Answer AMB-ETA-411-006 in `comments`, or defer it. The other five are already resolved in the
   normalized artifact and approving confirms them.
4. Run `npm run validate:artifacts`.

Only criteria carrying an item-level `APPROVE` flow into the test plan. Anything rejected, deferred
or returned for changes is excluded and recorded in the RTM with that status.

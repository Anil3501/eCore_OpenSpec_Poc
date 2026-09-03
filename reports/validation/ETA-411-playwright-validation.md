# PLAYWRIGHT_VALIDATION — TP-ETA-411-001

| | |
| --- | --- |
| **Story** | ETA-411 | 
| **Release / capability** | 1.0 / `home-navigation` |
| **Evidence** | [reports/validation/ETA-411-navigation-validation.json](ETA-411-navigation-validation.json) |
| **Probe** | [scripts/eta-411-navigation-validation.ts](../../scripts/eta-411-navigation-validation.ts) |
| **Run** | 2026-09-01, qa host, one sign-in with correct details |

**How this evidence was obtained.** The Playwright MCP server exposed no tools in this session, so
validation ran as a scripted Playwright probe — the documented fallback. Every destination below was
reached by an actual click. Nothing here is inferred from a link address.

## The three questions this stage existed to answer

### 1. Are the dashboard icons and the header links distinct elements? — **Yes**

| Accessible name | Unscoped matches | Scoped to `#icon-buttons` |
| --- | --- | --- |
| New Transaction | **2** | 1 |
| Workspace | **2** | 1 |

Two matches unscoped, one scoped. The ambiguity is real — an unscoped `getByRole('link')` would
throw a strict-mode violation — and scoping to `#icon-buttons` resolves it cleanly.
`RISK-TP-ETA-411-003` is **mitigated as designed**. `TS-ETA-411-003` and `TS-ETA-411-008` will
exercise different elements.

### 2. Where do the header links actually go? — **Exactly where the criteria said**

Both links were walked. Both landed on the same page as the dashboard icon of the same name.

| Entry point | Landed |
| --- | --- |
| Header — New Transaction | `/ssweb/setup/container/ct/newPackage.eo` |
| Header — Workspace | `/ssweb/setup/workspace/workspace.eo` |

`AC-ETA-411-008` and `AC-ETA-411-009` were approved on the evidence of an `href`. They are now
**observed**. `RISK-TP-ETA-411-001` is **discharged**. No discrepancy — the approved criteria needed
no amendment, which is the outcome we wanted but could not assume.

### 3. Does the Command Center control return Home from all three destinations? — **Yes**

All five walks returned to `/ssweb/setup/welcome.eo`. The three icon legs and both header legs. No
leg was inferred from another.

## RETRACTED on 2026-09-01 — this section was wrong

> **Everything between this line and the next horizontal rule is withdrawn.** It is left standing
> rather than deleted, because the reviewer made a decision on it and that decision has to remain
> auditable.
>
> **What was claimed:** that the Workspace page exposes unique headings `Search Criteria` and
> `Output`, and that the earlier reconnaissance finding of "no unique element" was wrong.
>
> **What is actually true:** the earlier reconnaissance was **right** and this report was wrong.
> EXECUTION on 2026-09-01 asserted `getByRole('heading', { name: 'Search Criteria' })` against the
> Workspace page and it does not exist. The captured accessibility snapshot in
> `test-results/features-approved-home-nav-37bd9--reaches-the-Workspace-page-bdd/error-context.md`
> contains no such heading and no such text anywhere in the tree.
>
> **Why the probe reported it:** `headingsOf()` in
> [scripts/eta-411-navigation-validation.ts](../../scripts/eta-411-navigation-validation.ts) reads
> `textContent` from `h1, h2, h3, legend, caption`. A `<legend>` and a `<caption>` are **not** ARIA
> headings — a legend names its `fieldset` (role `group`) and a caption has role `caption`. The
> helper also never checked visibility. So it reported, under a column titled "headings", something
> that is neither a heading nor necessarily on screen.
>
> **Consequence:** three scenarios failed — `TS-ETA-411-004`, the Workspace row of
> `TS-ETA-411-006`, and `TS-ETA-411-009`. On 2026-09-01 the reviewer chose to revert to the
> address-only assertion that `TP-ETA-411-001` approved. The deviation recorded at
> `2026-09-01T13:45:01Z` in the workflow history is withdrawn with it.
>
> **Read across:** the `Create Transaction` heading on the New Transaction page came from the same
> flawed helper, but it is genuine — `TS-ETA-411-003` passed against it. Only the Workspace claim
> was false. Any future use of this probe must confirm ARIA role and visibility before treating an
> element as a heading.

## An unexpected finding that needs your decision

The Workspace page **does** expose unique headings — `Search Criteria` and `Output`. Reconnaissance
recorded "no unique element", and that was wrong.

This matters because `TS-ETA-411-004` was planned, reviewed and approved as an **address-only**
assertion, on the explicit understanding that no stronger assertion was available. It now is.

| Destination | Unique heading available |
| --- | --- |
| New Transaction | `Create Transaction` — already used by `TS-ETA-411-003` |
| Workspace | **`Search Criteria`, `Output`** — newly available |
| Preferences | **None.** Its only heading is boilerplate that appears on every page |

I have **not** strengthened `TS-ETA-411-004`. Making a test stricter than its approved plan is still
a change to what was approved, and it can fail in ways the plan never anticipated. Two options:

- **Leave it address-only.** Matches the approved plan exactly. `RISK-TP-ETA-411-002` stands.
- **Add the heading assertion.** Strictly better proof of the same criterion. `AC-ETA-411-004` does
  not change, so this does not reopen Gate 1 — but it is a knowing deviation from the approved plan
  and should be recorded as one.

Preferences is unaffected either way: `TS-ETA-411-005` genuinely has nothing but its address.

---

## Validated locators

| Element | Locator | Status |
| --- | --- | --- |
| Dashboard icons | `#icon-buttons` → `getByRole('link', { name })` | **VALIDATED** — needs a `VALIDATED -` waiver for the container scope |
| Header links | `getByRole('link', { name })` outside `#icon-buttons` | **VALIDATED** |
| Command Center control | `#bannerBackground` (`div.clickable`, 216×45, `command_center.png`, `cursor: pointer`) | **VALIDATED** — needs a `VALIDATED -` waiver: no text, no `alt`, no `title`, no `aria-label`, no `role`. There is no accessible route to this element |
| New Transaction page | heading `Create Transaction` | **VALIDATED** — since confirmed by a passing execution |
| Workspace page | URL only | **VALIDATED.** The `Search Criteria` heading offered here does not exist; see the retraction above |
| Preferences page | URL only | **VALIDATED** — no alternative exists |

## Honest limits of this run

- **One account.** `RISK-TP-ETA-411-004` is untouched — this run says nothing about whether the icon
  set varies by permission.
- **The probe's `headerLinks` capture returned empty.** That is a defect in the probe's DOM filter,
  not evidence that the links are absent — the walks clicked them successfully. The walk results are
  the evidence; that field should be ignored.
- **The probe's `headings` capture is not trustworthy either.** See the retraction above. It reads
  `textContent` from `h1, h2, h3, legend, caption` without checking ARIA role or visibility, so it
  reports elements that `getByRole('heading')` will never find. Two defects in one probe is the real
  lesson of this run: a reconnaissance script that is never itself verified will manufacture
  findings in both directions — it understated the header links and overstated the Workspace
  headings.
- **Every page returns the title `eOriginal Command Center™`.** Titles remain useless as a
  discriminator, as assumed.
- **Nothing about failure was observed**, because no negative scenario exists to observe.

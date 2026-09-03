## Context

See [proposal.md](proposal.md) — Why. The requirements are in
[specs/home-navigation/icon-navigation/spec.md](specs/home-navigation/icon-navigation/spec.md).

ETA-411 carries **no acceptance criteria in Jira** — the whole story is one sentence. It names
neither the icons nor their destinations. Seven of the nine approved criteria are therefore
`PROPOSED_BY_REQUIREMENT_ANALYSIS`, derived from observing the running QA application rather than
from anything a business author wrote.

That is the constraint shaping this design, and it differs from `add-organization-login`. There, six
ambiguities were deferred and the danger was someone inventing an answer. Here, five ambiguities were
**answered** at Gate 1, and the danger is the opposite: the answers are recorded as settled, but two
of them are weaker than they look, and a reader downstream could reasonably mistake an accepted risk
for a verified fact.

## Goals / Non-Goals

**Goals**

- Keep every specified requirement traceable to exactly one approved acceptance criterion.
- Keep the distinction between *observed*, *asserted* and *inferred* evidence visible at the point of
  use, so no one downstream treats an assumption as a measurement.
- Preserve the one unresolved ambiguity (`AMB-ETA-411-006`) as genuinely open rather than letting the
  test plan settle it by convenience.

**Non-Goals**

- Deciding `AMB-ETA-411-006`. That is a human decision about the product.
- Re-opening the five resolved ambiguities. They are settled; this document records what each
  settlement costs, not whether it was right.
- Specifying automation structure. Feature files, step definitions and page objects are produced at
  BDD design and implementation, after Gate 2 and Gate 3.

## Decisions

**Destinations are specified by address.**
Gate 1 resolved `AMB-ETA-411-002` this way after the alternative — naming a visible element unique to
each destination — was investigated and found unavailable. Every page in the application returns the
identical browser title, and the Workspace and Preferences destinations expose no heading unique to
them. The address was the only discriminator that reconnaissance could find.

The cost is real and is recorded in the approval: an address assertion cannot distinguish a correctly
rendered page from one that reached the right address and then rendered an error, an empty result or
a permission refusal. Such a case passes. Only New Transaction has a stronger identifier available (a
"Create Transaction" heading), and the spec notes it for that destination alone rather than pretending
the other two have an equivalent.

**One specification requirement per acceptance criterion.**
The three destination requirements could have been folded into a single "each icon leads to the page
it stands for" requirement with three scenarios, which would read better. The 1:1 mapping was chosen
instead so that the RTM links each criterion to exactly one `openSpecRef`, matching the
`add-organization-login` precedent. Readability was traded for an unambiguous trace.

**The header asymmetry is specified as it is, not smoothed over.**
`AMB-ETA-411-001` was answered as "the tiles plus the header duplicates", on the understanding that
the header duplicates all three icons. It duplicates two. There is no header Preferences link; the
only header-area route to that address is a menu link labelled "Organization".

Three options existed. Specify a header Preferences link — rejected, it does not exist. Treat
"Organization" as the third route — rejected, that decides `AMB-ETA-411-006` by inference, and the
name mismatch may itself be a product inconsistency that a human should judge. Specify the asymmetry
exactly as observed — chosen. Two destinations have two routes, Preferences has one, and the spec
says so explicitly so that a test planner does not "correct" it.

**Evidence strength is graded, and the two weakest requirements say so.**
The nine criteria do not rest on equal evidence:

| Evidence | Criteria | Meaning |
| --- | --- | --- |
| Observed by navigation | `AC-001`, `AC-003`, `AC-004`, `AC-005`, `AC-006` | The journey was walked; the outcome was seen |
| Observed in markup | `AC-002`, `AC-007` | The elements were seen; not every one was activated |
| Inferred from a link address | `AC-008`, `AC-009` | **Never activated.** The destination is what the link claims |

`AC-008` and `AC-009` are the weak pair. A link address is not proof of navigation — a redirect, an
interstitial or a permission check can intervene, and this application is known to use an
interstitial on the login path. Both specification requirements carry an explicit instruction that
`PLAYWRIGHT_VALIDATION` must confirm them by navigation before any test asserts them.

**The Command Center control is specified by outcome only.**
`AMB-ETA-411-005` accepted the control as it stands: it exposes no accessible name. The requirement
states that activating it returns the user Home and says nothing about how it is labelled or exposed.
Specifying an accessible name would assert behaviour the product does not have; specifying its
absence would bake a known gap into the contract. Stating the outcome alone leaves the spec true
today and still true if the control is later made accessible.

## Risks / Trade-offs

| Risk | Mitigation |
| --- | --- |
| An address assertion passes on a page that rendered an error | Accepted at Gate 1 and recorded in the approval. If it later matters, naming a visible element per destination reopens `AMB-ETA-411-002` rather than being a test-detail change |
| `AC-008` / `AC-009` destinations are wrong | Both spec requirements mandate confirmation by navigation at `PLAYWRIGHT_VALIDATION` before assertion |
| The icon set varies by role, contradicting `AC-002` | `AMB-ETA-411-003` is the reviewer's assertion, not an observation — one account was seen. The overlapping `AMB-ETA-351-006` remains open. If a second account ever contradicts it, `AC-002` returns to Gate 1 |
| `AMB-ETA-411-006` gets settled by default during test planning | The spec states the asymmetry and forbids assuming a Preferences header route either way |
| Addresses change between environments | The addresses are QA-observed paths. If they are environment-specific rather than product-stable, the affected requirements need rewording, not the tests |

## Migration Plan

Not applicable. This is a new capability with no existing spec, no existing automation and no
consumers to migrate.

## Open Questions

- **`AMB-ETA-411-006`** — Is the menu link labelled "Organization" a navigation route to Preferences
  for the purposes of this story, is the Preferences icon the only in-scope route, or is
  "Organization" a distinct destination that happens to share an address? Needs a human decision.
- **Is the "Organization" / Preferences naming mismatch a product inconsistency?** Observed, not
  judged. Requirement analysis may not decide it.
- **`AMB-ETA-351-006`** — whether permission-limited behaviour is in scope — remains open on the
  `account-access` capability and is not closed by the `AMB-ETA-411-003` answer given here.

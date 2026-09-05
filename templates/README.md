# templates/

The authoritative shapes for every artifact an agent authors from scratch.

**Fill a template. Never copy another story.** A completed story's artifacts are evidence of what was
decided for that story — they are themselves agent output from an earlier run, so treating them as a
standard lets a past agent's choice become the rule with no human having ratified it. It also drifts:
before these templates existed, two stories produced `RISK-TP-…` and `RSK-TP-…` for the same field,
and two acceptance-criteria review packages that shared exactly one heading between them.

## Authority

| Tier | Answers | Where |
| --- | --- | --- |
| JSON Schema | Which fields exist, their types and patterns | `*/schemas/*.schema.json` |
| Template | What a blank looks like, and what each field is for | this directory |
| An existing story | Nothing. It is evidence, not authority | — |

[manifest.json](manifest.json) maps every template to its schema, the stage that produces it and the
path it is written to. It also records what is deliberately **not** templated, and why.

## How this is enforced

- `TPL-STRUCTURE` checks every JSON template against its schema for key and required-property
  parity, so a schema change that leaves a template behind fails the build. Placeholder values are
  not schema-valid by design, so only structure is compared.
- `TPL-REVIEW-SECTIONS` checks the review package currently blocking an approval gate against the
  `requiredSections` listed in the manifest. A human is about to read that document, so it must be
  complete. Review packages for gates already cleared are left alone — reshaping them would rewrite
  the record of what the reviewer actually saw.
- No approved artifact may contain the placeholder prefix `REPLACE_WITH_`.

Run `npm run validate:artifacts` after editing anything here.

## Adding a template

1. Write the JSON Schema first, if it does not exist.
2. Add the template here with every required key present and one example element in each array.
3. Register it in [manifest.json](manifest.json).
4. Run `npm run validate:artifacts` and fix any parity failure.

---
description: "Use when editing framework tooling in src/utils: the env loader, artifact validators, schema-parity checks, workflow status or the v8-to-istanbul coverage pipeline. Covers Node 24 ESM/CJS interop, CLI script conventions, adding an env variable and path-safety."
name: "Framework tooling and CLI scripts"
applyTo: ["src/utils/**"]
---

# Framework tooling and CLI scripts

`src/utils/` holds the non-test machinery: the typed env loader, the governance validators and the
code-coverage pipeline. These files run under **Node directly**, not under Playwright.

## Node 24 runtime traps

- Relative imports **must** carry `.ts`: `import { PROJECT_ROOT } from './artifact-io.ts'`.
- `erasableSyntaxOnly: true` — no parameter properties, no `enum`, no namespaces.
- These files have no `"type": "module"`, so Node re-parses them as **ESM by syntax detection**.
  That warning is silenced by `--disable-warning=MODULE_TYPELESS_PACKAGE_JSON` in the npm script.
  **Never add `"type": "module"` to package.json.**
- **CommonJS dependencies must be default-imported.** A named import from a CJS package compiles
  cleanly under `tsc --noEmit` and then fails at *runtime* with
  `SyntaxError: Named export 'x' not found`:

  ```ts
  // WRONG - passes typecheck, throws on execution
  import { createCoverageMap } from 'istanbul-lib-coverage';

  // RIGHT
  import istanbulLibCoverage from 'istanbul-lib-coverage';
  const { createCoverageMap } = istanbulLibCoverage;
  ```

  `npm run typecheck` will not catch this. Always execute the script once after adding a dependency.

## CLI script convention

Every script here follows the shape of
[src/utils/validate-artifacts.ts](../../src/utils/validate-artifacts.ts):

1. A file-level docblock beginning with `Usage:` and the exact `node …` command.
2. A top-level `main()` invoked at the bottom of the file.
3. Human-readable output to stdout **and** a machine-readable JSON artifact under `reports/`.
4. `process.exitCode = 1` on failure — never `process.exit()` mid-stream, and never exit 0 on a
   failed check.
5. A matching entry in `package.json` scripts using
   `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON src/utils/<file>.ts`.

Reuse [src/utils/artifact-io.ts](../../src/utils/artifact-io.ts) (`PROJECT_ROOT`, `toAbsolute`,
`toRelative`, `readJson`, `listFiles`) rather than re-implementing path or JSON handling.

## Adding an environment variable

`src/utils/env.ts` is the **only** module permitted to read `process.env`. Adding a variable means
touching all six of these, or something will silently drift:

1. `environmentSchema` — a Zod field with an explicit default.
2. The `safeParse({...})` mapping.
3. The `FrameworkEnvironment` interface (and a `require*()` accessor if it is mandatory).
4. The `env` object literal.
5. `describe()` — only if the value is **not** a secret.
6. `.env.example` and the environment table in [README.md](../../README.md).

Requirements are enforced **lazily** so scaffolding and validation work with an empty `.env`. Error
messages name variable keys only — never a value, never a fragment of a secret.

## Writing files from a tool

- Tools write to `reports/` only. Never write into `traceability/`, `workflow/`, `requirements/`,
  `test-plans/` or `features/` — those are governed artifacts owned by the orchestrator flow.
- Any path derived from external input (a URL, a test title, a CLI argument) must be sanitised and
  then **verified to resolve inside its intended root** before writing. See `sourcePathForUrl()` in
  [src/utils/coverage-report.ts](../../src/utils/coverage-report.ts). Prefer a generated UUID over
  a caller-supplied string for file names.

## Coverage pipeline

[src/utils/coverage.ts](../../src/utils/coverage.ts) captures Chromium V8 coverage and
[coverage-report.ts](../../src/utils/coverage-report.ts) converts it with `v8-to-istanbul`. The two
are joined to the test run by `globalSetup` / `globalTeardown` in
[playwright.config.ts](../../playwright.config.ts), which clear the previous captures and render the
report, so one `npm test` produces the execution report and the coverage report together.
[coverage-run.ts](../../src/utils/coverage-run.ts) only forces capture on when a local `.env`
disabled it.

- Capture is **on by default** (`COVERAGE_ENABLED=false` disables it) and Chromium-only. With the
  flag off every function is a no-op, so the run behaves exactly as it would without coverage.
- **Instrumentation must never fail a test.** Capture errors are warnings, teardown swallows a
  reporting failure, and a failing suite still produces a report and still returns its own exit code.
- `coverage-report.ts` guards its CLI entry point on `process.argv[1]`, because the teardown imports
  the module. Do not replace that guard with `import.meta`: the file is loaded both by Node's ESM
  type-stripping and by Playwright's own transform.
- This is application **code** coverage. It is never merged into `traceability/`, never quoted as
  requirement coverage, and never evidence that an acceptance criterion is satisfied.

## Changing a validation rule

`src/utils/semantic-rules.ts` is governance, not convenience. Do not weaken, skip or delete a check
to make an artifact pass — fix the artifact. A new rule needs an `id`, a `title` and messages that
name the file, the JSON path and the rule that failed. Keep the JSON Schema and the Zod model in
sync or the `*-STRUCTURE` parity checks in
[src/utils/schema-parity.ts](../../src/utils/schema-parity.ts) will fail.

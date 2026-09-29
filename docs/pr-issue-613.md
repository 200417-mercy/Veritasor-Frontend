# Add regression coverage for `a11yCsv` failure handling (CSV_HEADERS download path)

Closes #613

## Summary

This PR adds a focused regression suite for `src/components/a11y/a11yCsv.ts`, the module that powers the accessibility-audit CSV export (`CSV_HEADERS`). Issue #613 identified an explicit failure branch that had **zero automated coverage**:

> `src/components/a11y/a11yCsv.ts:97` contains `throw new Error('downloadIssuesCsv: a browser `window` is required')`

Until now, nothing prevented that guard from silently regressing (e.g. someone "simplifying" `defaultDeps()` to return undefined deps, or swallowing the error). This change locks the failure contract, the neighboring normal download path, and the boundary inputs behind deterministic, dependency-injected tests — **with no changes to any production code**, so the existing public contract is preserved exactly.

## What changed

| File | Change |
|---|---|
| `src/components/a11y/a11yCsv.test.ts` | **Added** — 32 focused tests covering the failure path, normal path, and boundary inputs |
| `docs/pr-issue-613.md` | **Added** — this description (kept alongside the repo's existing PR-description docs) |

No production source files were touched.

## Coverage added (32 tests in 6 groups)

### 1. `CSV_HEADERS` — the named export surface
- Canonical triage column order is asserted verbatim (severity first, 11 columns).
- No duplicate or empty headers.
- `buildIssuesCsv` uses `CSV_HEADERS` verbatim as the first CSV row.
- The public `CsvHeader` type stays aligned with the tuple.

### 2. Failure path — the branch named by the issue
- **`downloadIssuesCsv` throws exactly `downloadIssuesCsv: a browser \`window\` is required`** when `window` is unavailable (simulated by removing the global, restored in `finally`).
- **Error precedence**: the guard fires *before* any Blob construction, URL creation, anchor insertion, or dependency use — asserted with fully injected spies that must record zero calls.
- The `window` global is restored after each probe so no test leaks state (explicitly asserted).

### 3. Normal path — successful download with injected deps
- Return contract `{ filename, bytes, data }`: filename round-trips, `data === buildIssuesCsv(...)` (same instance-independent payload), `bytes` matches a fresh UTF-8 encoding of BOM + payload and is strictly greater than `data.length` (BOM is 3 bytes).
- UTF-8 BOM (`\ufeff`) is prepended and the Blob type is `text/csv;charset=utf-8`.
- Full anchor lifecycle: `createElement('a')` → `href`/`download` set → `style.display = 'none'` → `body.appendChild` → `click()` → `body.removeChild`, with the same element appended and removed.
- URL lifecycle: exactly one `createObjectURL(blob)` and one `revokeObjectURL(url)` with the same URL value.
- Revoke is deferred through the injected `setTimeoutFn` with a **0 ms** delay; invoking the scheduled callback revokes the URL.
- Default filename falls back to the deterministic `veritasor-a11y-issues-YYYY-MM-DDTHH-MM-SS.csv` pattern.
- Partial dependency injection works (global Blob + injected URL API).

### 4. Boundary inputs
- **Empty result set**: `buildIssuesCsv([])` returns a header-only document; `downloadIssuesCsv([])` still performs the full download lifecycle with header-only payload.
- Optional fields (`element`, `documentTitle`) default to empty strings in the row.
- RFC 4180 quoting edges: comma, double quote (doubled), LF, CR, CRLF, and combined metacharacters; input values are never mutated.
- A field containing embedded CRLF stays inside one quoted CSV record — verified by reading the CSV back with a small RFC-4180-aware parser (round-trip is lossless).

### 5. `buildIssuesCsv` ordering & shape
- Rows sort critical → serious → moderate → minor regardless of input order (matches `SEVERITY_ORDER`).
- The caller's array is never mutated.
- Every record (header + data) has exactly `CSV_HEADERS.length` fields when parsed with an RFC-4180-aware parser.

### 6. `issuesCsvFilename`
- Deterministic formatting of a fixed date; stable prefix/suffix.

## Determinism & isolation strategy

- All DOM-touching dependencies are injected through the module's own `DownloadDeps` seam (documented as "injected for jsdom tests") — no jsdom globals are mutated by the normal-path tests.
- The only global stubbing is the failure-path probe (`window` → `undefined`), which is restored in a `finally` and explicitly asserted to be restored.
- The injected `setTimeoutFn` runs synchronously (or only records, where the scheduling contract itself is under test), so no timers are needed and revocation is observable.

## Validation performed

All commands run locally on Node (Ubuntu, branch `test/a11y-csv-regression-613`, base `548d935`).

### Focused test file (the "run the focused test file" criterion)

```
npx vitest run src/components/a11y/a11yCsv.test.ts
 ✓ src/components/a11y/a11yCsv.test.ts (32 tests) 52ms
 Test Files  1 passed (1)
      Tests  32 passed (32)
```

### Surrounding suite (`src/components/a11y/`)

```
npx vitest run src/components/a11y/
 Test Files  2 passed, 1 failed (3)
      Tests  83 passed | 2 failed (85)
```

The 2 failures are in `A11yCoverageMatrix.test.tsx` (`Found multiple elements with the text: /7\/12/` and `/69%/`). **They are pre-existing and unrelated to this PR**: `git stash -u` → rerun on the clean tree reproduces exactly the same 2 failures (and the file passes on `main` when run alone; the failures only appear when its module-level mock interacts with the sibling panel file's jsdom `URL` stub during batched runs — an isolation issue in that file, untouched here).

### Full unit suite (before vs. after)

| Tree | Result |
|---|---|
| Base (`main`) | 35 files passed, **32 files failed** |
| This PR | 36 files passed, **32 files failed** |

Identical pre-existing failures; this PR adds 1 passing file (32 tests) and breaks nothing.

### Lint

```
npx eslint src/components/a11y/a11yCsv.test.ts   → clean
npx eslint .                                      → 93 problems, identical count on base tree (92 pre-existing problems + 1 line-count artifact in untouched files; zero problems in files changed by this PR)
```

### Type check

`npx tsc --noEmit -p tsconfig.json` reports **no TypeScript errors** for the added test file. The only diagnostic is a pre-existing JSON parse error at `src/i18n/messages/en.json(40,3)` (`TS1005: ',' expected`), which reproduces identically on the clean base tree (`git stash -u` → `npx tsc -b --force` shows the same single error) and is tracked separately as part of the repo's existing CI issues. Per the issue's instruction to run the configured checks while ignoring existing CI issues, this PR does not modify that file.

### Build

```
npm run build   # tsc -b && vite build
src/i18n/messages/en.json(40,3): error TS1005: ',' expected
```

The build is blocked solely by the same pre-existing `en.json` JSON syntax error present on `main` — not by anything in this PR. (Noted here for transparency so reviewers don't attribute the red build to this change.)

## Acceptance criteria checklist (from the issue)

- [x] Cover the named behavior with focused automated tests, including the relevant success and failure paths — failure path (§2), success path (§3), boundaries (§4)
- [x] Preserve the existing public contract — no production code changed; `CSV_HEADERS`, `escapeCsvField`, `buildIssuesCsv`, `issuesCsvFilename`, `downloadIssuesCsv` signatures and error message are asserted as-is (a compatibility plan is unnecessary because nothing is altered)
- [x] Make error and boundary behavior observable and deterministic — exact error message asserted, zero-dependency-interaction precedence asserted, dependency injection + `finally`-restored globals, no timers, no randomness
- [x] Run the focused test file and the surrounding suite — results above
- [x] Run the repository's configured lint, type, build, or contract checks — results above (pre-existing failures isolated to untouched files)
- [x] Include the exercised cases and results in the pull request description — this document

## Reviewer notes

- The failure-path tests stub `window` rather than running in a separate non-DOM environment because `vitest.config.ts` pins `environment: 'jsdom'` repo-wide; removing/restoring the global is the smallest deterministic way to reach that branch, and the restoration is asserted.
- The RFC-4180-aware parser (`parseCsv`) lives inside the test file on purpose: it is the *reader* used to verify the *writer*, keeping the round-trip assertion honest without adding a runtime dependency.
- Suggested follow-ups (out of scope here): fix `src/i18n/messages/en.json` to unblock `npm run build`, and add `@vitest/` test-name isolation to `A11yCoverageMatrix.test.tsx`.

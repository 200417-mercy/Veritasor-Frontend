# Summary

Adds focused behavior coverage for `EmptyStateIllustrations` and makes invalid runtime types fail with a deterministic `RangeError`.

## Coverage

- Verifies the supported `IllustrationType` values match the public metadata keys.
- Verifies metadata labels and descriptions, plus the `EmptyStateIllustrations` aliases.
- Checks every illustration renders its SVG and accessible description.
- Exercises transitions from attestations to revenue sources to data export, confirming each SVG and description updates.
- Verifies unknown strings, inherited property names, and `undefined` are rejected with `RangeError`.

## Validation

| Check | Result |
|---|---|
| Focused and surrounding tests | Not run, as requested |
| Focused ESLint | Not run; local dependencies are unavailable and `npx` prompted to install ESLint |
| `npm run build` | Blocked; `tsc` is not installed in the checkout |
| Editor diagnostics | No errors reported in either changed TypeScript file |
| `git diff --check` | Passed |
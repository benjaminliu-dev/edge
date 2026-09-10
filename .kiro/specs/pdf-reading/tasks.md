# Implementation Plan: PDF Reading Feature

## Overview

Add transparent PDF text extraction to the Edge AI study agent. A new `readPdfFile` function in `src/core/pdf-reader.ts` handles detection and extraction via `pdf-parse`, slotting into the existing read loop in `agent.ts` with a single branch. All errors propagate through the existing catch block unchanged.

## Tasks

- [x] 1. Install dependencies and configure types
  - Add `pdf-parse@1.1.1` as a pinned runtime dependency in `package.json`
  - Add `@types/pdf-parse@1.1.4` as a pinned dev dependency in `package.json`
  - Add `fast-check` as a pinned dev dependency in `package.json` for property-based testing
  - Run `npm install` to update `package-lock.json`
  - _Requirements: 6.1_

- [x] 2. Implement the PDF_Reader module
  - [x] 2.1 Create `src/core/pdf-reader.ts` with the `readPdfFile` function
    - Read the file at `resolvedPath` as a `Buffer` using `fs/promises`
    - Pass the buffer to `pdfParse` from `pdf-parse`
    - Detect encryption/password errors by inspecting the caught error message for `"encrypted"` or `"password"`; throw a normalized error `"PDF parse failure: encrypted or password-protected"`
    - For other parse errors, throw `"PDF parse failure: <original message>"`
    - If `result.text` is empty, null, or undefined after a successful parse, throw `"PDF parse failure: no text could be extracted"`
    - Collect per-page text via the `pagerender` callback option and join pages with `"\n"`
    - Export only `readPdfFile` from this module; no dependency on `Agent` or agent state
    - _Requirements: 2.1, 2.2, 2.4, 3.2, 3.3, 4.5, 6.2, 6.3_

  - [ ]* 2.2 Write property test for `readPdfFile` — Property 2: Multi-page text joined by newlines
    - Create `src/core/pdf-reader.test.ts`; mock `fs/promises` and `pdf-parse`
    - **Property 2: Multi-page text is joined by newlines**
    - **Validates: Requirements 2.2**
    - `fc.array(fc.string(), { minLength: 1 })` generates page texts; mock returns `pages.join('\n')`; assert result equals `pages.join('\n')`
    - Tag comment: `// Feature: pdf-reading, Property 2`

  - [ ]* 2.3 Write unit tests for `readPdfFile` (isolated, example-based)
    - Successful extraction returns joined page text
    - Empty `result.text` throws parse failure error
    - I/O error from `fs.readFile` propagates as thrown error
    - Encrypted PDF error propagates with `"encrypted or password-protected"` message
    - Generic parse error propagates with original message
    - _Requirements: 2.1, 2.4, 3.1, 3.2, 3.3_

- [x] 3. Checkpoint — Ensure `readPdfFile` tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrate PDF_Reader into the Agent read loop
  - [x] 4.1 Modify the read loop in `src/core/agent/agent.ts` (lines 201–211)
    - Import `readPdfFile` from `../../core/pdf-reader` at the top of the file
    - Add an `if (readPath.toLowerCase().endsWith('.pdf'))` branch inside the existing try block
    - Call `readPdfFile(resolvedPath)` for PDF paths; keep `fs.readFile(resolvedPath, 'utf-8')` for all other paths
    - Assign both branches to `let readResult: string` and call `this.readCache.set(readPath, readResult)` once after the branch
    - Leave the existing `catch` block unchanged — it already stores `"Read Failure: <message>"`
    - Leave `this.resolveReadPath(readPath)` as the first call in the try block
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2_

  - [ ]* 4.2 Write property test for the read loop — Property 6: Loop continues after PDF failure
    - Extend `src/core/agent/agent.test.ts`
    - **Property 6: Loop continues after PDF failure**
    - **Validates: Requirements 3.4**
    - `fc.array` of text paths + injected failing PDF at a random index; assert all non-failing paths are present in cache after the loop
    - Tag comment: `// Feature: pdf-reading, Property 6`

  - [ ]* 4.3 Write property test for the read loop — Property 7: Out-of-bounds paths never reach `readPdfFile`
    - **Property 7: Out-of-bounds paths never reach readPdfFile**
    - **Validates: Requirements 5.2**
    - Generate paths that cause `resolveReadPath` to throw; assert `readPdfFile` mock is never called and cache contains `"Read Failure:"` prefix
    - Tag comment: `// Feature: pdf-reading, Property 7`

  - [ ]* 4.4 Write property test for the read loop — Property 3: Cache round-trip preserves extracted text
    - **Property 3: Cache round-trip preserves extracted text**
    - **Validates: Requirements 2.3, 4.2**
    - Arbitrary extracted text + arbitrary `.pdf` path; mock `readPdfFile`; run loop; assert `readCache.get(readPath) === extractedText`
    - Tag comment: `// Feature: pdf-reading, Property 3`

  - [ ]* 4.5 Write property test for the read loop — Property 4: Read failure error strings preserve error message
    - **Property 4: Read failure error strings preserve the error message**
    - **Validates: Requirements 3.1, 4.3**
    - Arbitrary error message; mock `fs.readFile` to reject; assert cache value equals `"Read Failure: <message>"`
    - Tag comment: `// Feature: pdf-reading, Property 4`

  - [ ]* 4.6 Write property test for the read loop — Property 5: Parse failure error strings preserve error message
    - **Property 5: Parse failure error strings preserve the error message**
    - **Validates: Requirements 3.2**
    - Arbitrary error message (filtered to exclude `"encrypt"`/`"password"`); mock `pdfParse` to reject; assert cache value equals `"Read Failure: PDF parse failure: <message>"`
    - Tag comment: `// Feature: pdf-reading, Property 5`

- [x] 5. Add remaining property-based tests
  - [x] 5.1 Write property test — Property 1: Extension detection is case-insensitive
    - Add to `src/core/pdf-reader.test.ts`
    - **Property 1: PDF extension detection is case-insensitive**
    - **Validates: Requirements 1.1**
    - `fc.string()` base + `fc.constantFrom('.pdf', '.PDF', '.Pdf', '.pDf')`; assert `.toLowerCase().endsWith('.pdf')` is `true`
    - Tag comment: `// Feature: pdf-reading, Property 1`

  - [x] 5.2 Write property test — Property 8: `readPdfFile` does not mutate Agent state
    - Add to `src/core/agent/agent.test.ts`
    - **Property 8: PDF_Reader does not mutate Agent state fields**
    - **Validates: Requirements 4.4**
    - Capture `messageHistory` snapshot and `totalTokens` before calling `readPdfFile`; assert both are identical after
    - Tag comment: `// Feature: pdf-reading, Property 8`

  - [ ]* 5.3 Write integration tests extending `src/core/agent/agent.test.ts`
    - PDF path in `readPaths` → `readPdfFile` is called and cache is populated
    - Non-PDF path in `readPaths` → `fs.readFile('utf-8')` is called
    - Mixed list (PDF + text + failing PDF) → all entries written to cache, loop does not abort
    - Out-of-bounds PDF path → `readPdfFile` never called, cache contains access-denied error
    - _Requirements: 1.2, 2.3, 3.4, 4.1, 4.2, 4.3, 5.1, 5.2_

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- All PDF failures are thrown as `Error` instances from `readPdfFile` and caught by the unchanged catch block in `agent.ts`, satisfying Requirements 3.x and 4.3 in one place
- The `pagerender` callback approach in `pdf-parse` enables per-page text collection; pages are joined with `"\n"` per Requirement 2.2
- `fast-check` property tests use `numRuns: 100` minimum per the design spec
- The `resolveReadPath()` call stays first in the try block — PDF paths benefit from the same path-security boundary as all other files (Requirement 5.1)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "5.1"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "5.2", "5.3"] }
  ]
}
```

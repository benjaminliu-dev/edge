# Requirements Document

## Introduction

The edge AI study agent currently reads files into a read cache as plain UTF-8 strings. When a file path ending in `.pdf` is encountered, the raw binary content cannot be represented as meaningful UTF-8 text. This feature adds transparent PDF text extraction so that `.pdf` files are parsed and stored in the read cache as human-readable strings, with no changes required to the rest of the agent pipeline.

## Glossary

- **Agent**: The `Agent` class in `src/core/agent/agent.ts` that orchestrates prompt preprocessing, response generation, and file I/O.
- **Read_Cache**: The in-memory `Map<string, string>` (`this.readCache`) that stores file contents keyed by their path, consumed during prompt generation.
- **PDF_Reader**: The new module responsible for detecting PDF file paths and extracting their text content.
- **Resolved_Path**: The absolute, validated file path produced by `Agent.resolveReadPath()`, guaranteed to be within the project directory.
- **Read_Path**: A single entry from `result.readPaths` produced by the preprocessing step.

## Requirements

### Requirement 1: Detect PDF Files by Extension

**User Story:** As the Agent, I want to detect when a Read_Path refers to a PDF file, so that I can apply the correct reading strategy.

#### Acceptance Criteria

1. WHEN a Read_Path is processed, THE PDF_Reader SHALL determine whether the path ends with the extension `.pdf`, matching case-insensitively (e.g., `.pdf`, `.PDF`, `.Pdf` all match).
2. WHEN a Read_Path does not end with `.pdf` (case-insensitive), THE PDF_Reader SHALL read the file using the existing UTF-8 reading logic and return the file's text content unchanged.
3. IF a Read_Path is empty or null, THEN THE PDF_Reader SHALL return an error indicating that the path is invalid without attempting to read the file.

---

### Requirement 2: Extract Text Content from PDF Files

**User Story:** As the Agent, I want the text content of a PDF file extracted and stored in the Read_Cache as a string, so that I can reason over PDF documents just like any other file.

#### Acceptance Criteria

1. WHEN a Read_Path ends with `.pdf`, THE PDF_Reader SHALL read the file at the Resolved_Path and extract its full text content.
2. WHEN a Read_Path ends with `.pdf`, THE PDF_Reader SHALL extract text from all pages of the PDF and concatenate them into a single string, with each page separated by a single newline character (`\n`).
3. WHEN text extraction succeeds, THE PDF_Reader SHALL store the extracted text string in the Read_Cache under the original Read_Path key.
4. THE PDF_Reader SHALL produce a string output that is valid UTF-8, containing only printable characters, whitespace, and newline characters.
5. IF the file at the Resolved_Path cannot be read, is password-protected, or yields zero characters of extracted text, THEN THE PDF_Reader SHALL NOT store a value in the Read_Cache and SHALL return an error indicating the cause of the failure.

---

### Requirement 3: Handle PDF Parsing Errors Gracefully

**User Story:** As the Agent, I want PDF parsing failures to be handled safely, so that a malformed or unreadable PDF does not crash the agent session.

#### Acceptance Criteria

1. IF a PDF file cannot be read from disk, THEN THE PDF_Reader SHALL store the string `"Read Failure: <error message>"` in the Read_Cache under the Read_Path key.
2. IF a PDF file can be read from disk but text extraction fails for reasons other than encryption or password protection, THEN THE PDF_Reader SHALL store the string `"PDF Parse Failure: <error message>"` in the Read_Cache under the Read_Path key.
3. IF a PDF file is encrypted or password-protected such that text cannot be extracted, THEN THE PDF_Reader SHALL store a string indicating a PDF parse failure due to encryption in the Read_Cache under the Read_Path key.
4. WHEN a PDF read or parse failure occurs, THE Agent SHALL skip the failed Read_Path and continue processing each remaining Read_Path in the list.

---

### Requirement 4: Transparent Integration with the Agent Read Loop

**User Story:** As a developer, I want the PDF reading logic to be transparent to the rest of the Agent, so that no changes are needed outside the file-reading section.

#### Acceptance Criteria

1. THE Agent SHALL invoke THE PDF_Reader from within the existing `result.readPaths` iteration loop (lines 201–211 of `src/core/agent/agent.ts`).
2. WHEN PDF text extraction completes, THE Agent SHALL store the extracted text in the Read_Cache keyed by `readPath` with the extracted string as the value, using the same `readCache.set(readPath, readResult)` call site as a plain text file read.
3. IF PDF text extraction fails, THEN THE Agent SHALL store an error string prefixed with `Read Failure:` in the Read_Cache under the same `readPath` key, using the same catch block as a plain text file read failure.
4. THE PDF_Reader SHALL not modify `readPath`, `resolvedPath`, `messageHistory`, `totalTokens`, or any other Agent-owned field beyond writing to the Read_Cache.
5. THE PDF_Reader SHALL be usable as a single function or module that accepts a `resolvedPath` string and returns a `Promise<string>` that rejects with an `Error` instance when extraction fails.

---

### Requirement 5: Path Security Constraint Preserved

**User Story:** As a developer, I want PDF file reads to respect the same path security constraints as all other file reads, so that the agent cannot access files outside the project directory.

#### Acceptance Criteria

1. WHEN a Read_Path ending in `.pdf` is processed, THE Agent SHALL resolve the path using `Agent.resolveReadPath()` before passing it to THE PDF_Reader.
2. IF the Resolved_Path is outside the project directory, THEN THE Agent SHALL store a `"Read Failure: Access denied"` error string in the Read_Cache under the Read_Path key and SHALL NOT invoke THE PDF_Reader, then SHALL continue processing the remaining Read_Paths without interruption.

---

### Requirement 6: PDF Parsing Library Dependency

**User Story:** As a developer, I want a PDF parsing library added to the project, so that PDF text extraction can be performed at runtime.

#### Acceptance Criteria

1. THE project SHALL declare exactly one PDF parsing library as a pinned runtime dependency in `package.json`.
2. THE PDF_Reader SHALL use only the public API of the chosen library to extract text, with no reliance on internal or undocumented APIs.
3. WHEN the PDF_Reader is given a valid PDF buffer, THE PDF_Reader SHALL return the extracted text content as a string using only the library's documented text extraction interface.
4. IF the library's text extraction returns an empty or null result, THEN THE PDF_Reader SHALL treat this as a parse failure and return an error indicating that no text could be extracted.

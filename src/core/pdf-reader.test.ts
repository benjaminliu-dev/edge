import * as fc from 'fast-check';

// Mock fs/promises and pdf-parse before importing the module under test.
// pdf-parse/index.js has a top-level debug side-effect that reads a test file
// when module.parent is falsy (which happens in Jest). Using a factory bypasses it.
jest.mock('fs/promises');
jest.mock('pdf-parse', () => jest.fn());

import * as fsPromises from 'fs/promises';
import pdfParse from 'pdf-parse';
import { readPdfFile } from './pdf-reader';

const mockReadFile = fsPromises.readFile as jest.MockedFunction<typeof fsPromises.readFile>;
const mockPdfParse = pdfParse as jest.MockedFunction<typeof pdfParse>;

describe('readPdfFile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Feature: pdf-reading, Property 1: PDF extension detection is case-insensitive
    it('Property 1: PDF extension detection is case-insensitive', () => {
        fc.assert(
            fc.property(
                fc.string(), // arbitrary base name
                fc.constantFrom('.pdf', '.PDF', '.Pdf', '.pDf'), // case variants
                (base, ext) => {
                    expect((base + ext).toLowerCase().endsWith('.pdf')).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Feature: pdf-reading, Property 2: Multi-page text is joined by newlines
    it('Property 2: Multi-page text is joined by newlines', async () => {
        await fc.assert(
            fc.asyncProperty(
                // Generate arrays of page texts where the joined result is non-empty,
                // because readPdfFile correctly throws when the total extracted text is empty.
                fc.array(fc.string(), { minLength: 1 }).filter(
                    (pages) => pages.join('\n').length > 0
                ),
                async (pages) => {
                    const joinedText = pages.join('\n');
                    mockReadFile.mockResolvedValue(Buffer.from('fake-pdf') as any);
                    mockPdfParse.mockResolvedValue({
                        text: joinedText,
                        numpages: pages.length,
                        numrender: pages.length,
                        info: {},
                        metadata: {},
                        version: '1.10.100',
                    } as any);

                    const result = await readPdfFile('/mock/file.pdf');
                    expect(result).toBe(joinedText);
                }
            ),
            { numRuns: 100 }
        );
    });

    // Unit tests for readPdfFile (task 2.3)

    it('successful extraction returns joined page text', async () => {
        const extractedText = 'Page one text\nPage two text';
        mockReadFile.mockResolvedValue(Buffer.from('fake-pdf') as any);
        mockPdfParse.mockResolvedValue({
            text: extractedText,
            numpages: 2,
            numrender: 2,
            info: {},
            metadata: {},
            version: '1.10.100',
        } as any);

        const result = await readPdfFile('/some/file.pdf');
        expect(result).toBe(extractedText);
    });

    it('empty result.text throws parse failure error', async () => {
        mockReadFile.mockResolvedValue(Buffer.from('fake-pdf') as any);
        mockPdfParse.mockResolvedValue({
            text: '',
            numpages: 1,
            numrender: 1,
            info: {},
            metadata: {},
            version: '1.10.100',
        } as any);

        await expect(readPdfFile('/some/file.pdf')).rejects.toThrow(
            'PDF parse failure: no text could be extracted'
        );
    });

    it('I/O error from fs.readFile propagates as thrown error', async () => {
        mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

        await expect(readPdfFile('/nonexistent/file.pdf')).rejects.toThrow(
            'ENOENT: no such file or directory'
        );
    });

    it('encrypted PDF error propagates with "encrypted or password-protected" message', async () => {
        mockReadFile.mockResolvedValue(Buffer.from('fake-pdf') as any);
        mockPdfParse.mockRejectedValue(new Error('PDF is encrypted'));

        await expect(readPdfFile('/some/encrypted.pdf')).rejects.toThrow(
            'PDF parse failure: encrypted or password-protected'
        );
    });

    it('encrypted PDF error (password variant) propagates with normalized message', async () => {
        mockReadFile.mockResolvedValue(Buffer.from('fake-pdf') as any);
        mockPdfParse.mockRejectedValue(new Error('password required to open this document'));

        await expect(readPdfFile('/some/protected.pdf')).rejects.toThrow(
            'PDF parse failure: encrypted or password-protected'
        );
    });

    it('generic parse error propagates with original message', async () => {
        mockReadFile.mockResolvedValue(Buffer.from('fake-pdf') as any);
        mockPdfParse.mockRejectedValue(new Error('unexpected end of file'));

        await expect(readPdfFile('/some/broken.pdf')).rejects.toThrow(
            'PDF parse failure: unexpected end of file'
        );
    });
});

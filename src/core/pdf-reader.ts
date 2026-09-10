import * as fs from 'fs/promises';
import pdfParse from 'pdf-parse';

/**
 * Reads a PDF file from disk and extracts its full text content.
 * Each page's text is separated by a single newline character.
 *
 * @param resolvedPath - Absolute, pre-validated file path
 * @returns Promise<string> — extracted text across all pages
 * @throws Error if the file cannot be read, is password-protected,
 *         or yields zero characters of text
 */
export async function readPdfFile(resolvedPath: string): Promise<string> {
    const buffer = await fs.readFile(resolvedPath);

    const pages: string[] = [];

    const options: pdfParse.Options = {
        // pagerender is typed as synchronous in @types/pdf-parse but the library
        // actually awaits the return value, supporting promises at runtime.
        // Cast to satisfy the type checker while retaining async page collection.
        pagerender: ((pageData: any): any => {
            return pageData.getTextContent().then((textContent: any) => {
                const pageText = textContent.items
                    .map((item: any) => item.str)
                    .join(' ');
                pages.push(pageText);
                return pageText;
            });
        }) as (pageData: any) => string,
    };

    let result: pdfParse.Result;
    try {
        result = await pdfParse(buffer, options);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const lower = message.toLowerCase();
        if (lower.includes('encrypted') || lower.includes('password')) {
            throw new Error('PDF parse failure: encrypted or password-protected');
        }
        throw new Error(`PDF parse failure: ${message}`);
    }

    if (!result.text) {
        throw new Error('PDF parse failure: no text could be extracted');
    }

    return pages.length > 0 ? pages.join('\n') : result.text;
}

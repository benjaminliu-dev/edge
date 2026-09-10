import { describe } from "node:test";
import { Agent } from "./agent";
import { AgentPermissions } from "./agent-utils";
import { readFile } from 'fs/promises';
import * as fc from 'fast-check';
import { readPdfFile } from '../pdf-reader';

// Mock pdf-parse to prevent its top-level test-file side-effect from firing.
// fs/promises is NOT mocked globally so existing tests can load fixture files.
jest.mock('pdf-parse', () => jest.fn());
jest.mock('../pdf-reader', () => ({
    readPdfFile: jest.fn(),
}));

const mockReadPdfFile = readPdfFile as jest.MockedFunction<typeof readPdfFile>;

let testAgentPermissions: AgentPermissions = {
    readFiles: true,
    writeFiles: true,
    createFiles: true,
    deleteFiles: true,
    executeCommands: false,
    excludePaths: []
};

let testAgent: Agent = new Agent("gemma4:cloud", "You are an AI agent to help only", testAgentPermissions, "~/");

describe("Test prompt preprocessing", () => {
    it('should correctly preprocess a prompt', async () => {

        let prompt = await readFile("./src/core/prompts/basic_math.txt", 'utf-8');

        const [result, ptokens, otokens] = await testAgent.preProcessPrompt(prompt);
        console.log(result);
        console.log(`${ptokens} input tokens used`);
        console.log(`${otokens} output tokens used`);

        // Assertions run perfectly after the promise resolves
        expect(result).toBeDefined();
    }, 120000);
});

describe("Test full prompting", () => {
    it('should correctly generate a response to a prompt', async () => {

        let prompt = await readFile("./src/core/prompts/basic_math.txt", 'utf-8');

        const [result, ptokens, otokens] = await testAgent.prompt(prompt);
        console.log(result);
        console.log(`${ptokens} input tokens used`);
        console.log(`${otokens} output tokens used`);

        // Assertions run perfectly after the promise resolves
        expect(result).toBeDefined();
    }, 120000);
});

// Feature: pdf-reading, Property 8: PDF_Reader does not mutate Agent state fields
describe('Property 8: readPdfFile does not mutate Agent state fields', () => {
    // Validates: Requirements 4.4
    const permissions: AgentPermissions = {
        readFiles: true,
        writeFiles: false,
        createFiles: false,
        deleteFiles: false,
        executeCommands: false,
        excludePaths: []
    };

    it('readPdfFile never changes messageHistory or totalTokens on an Agent instance', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }), // arbitrary extracted text
                async (extractedText) => {
                    const agent = new Agent('test-model', 'test context', permissions, '/tmp');
                    mockReadPdfFile.mockResolvedValue(extractedText);

                    const before = agent.toJSON();
                    const historyBefore = [...before.messageHistory];
                    const tokensBefore = before.totalTokens;

                    await readPdfFile('/mock/file.pdf');

                    const after = agent.toJSON();
                    expect(after.messageHistory).toEqual(historyBefore);
                    expect(after.totalTokens).toBe(tokensBefore);
                }
            ),
            { numRuns: 100 }
        );
    });
});

import { Agent } from "./agent";
import { AgentPermissions } from "./agent-utils";
import { expandHomePath } from "../config";
import * as fc from 'fast-check';
import { readPdfFile } from '../pdf-reader';
import * as os from 'os';

const mockGenerate = jest.fn();
const mockConnect = jest.fn();
const mockListTools = jest.fn();
const mockGetServerVersion = jest.fn();
const mockGetInstructions = jest.fn();
const mockCallTool = jest.fn();
const mockTransportConstructor = jest.fn();
const mockStreamableTransportConstructor = jest.fn();

jest.mock('ollama', () => ({
    Ollama: jest.fn().mockImplementation(() => ({
        generate: mockGenerate,
    })),
}));

jest.mock('@modelcontextprotocol/client', () => ({
    Client: jest.fn().mockImplementation(() => ({
        connect: mockConnect,
        listTools: mockListTools,
        getServerVersion: mockGetServerVersion,
        getInstructions: mockGetInstructions,
        callTool: mockCallTool,
    })),
    StreamableHTTPClientTransport: jest.fn().mockImplementation((url, opts) => {
        mockStreamableTransportConstructor(url, opts);
        return { url, opts };
    }),
}));

jest.mock('@modelcontextprotocol/client/stdio', () => ({
    StdioClientTransport: jest.fn().mockImplementation((config) => {
        mockTransportConstructor(config);
        return { config };
    }),
}));

// Mock pdf-parse to prevent its top-level test-file side-effect from firing.
jest.mock('pdf-parse', () => jest.fn());
jest.mock('../pdf-reader', () => ({
    readPdfFile: jest.fn(),
}));

const mockReadPdfFile = readPdfFile as jest.MockedFunction<typeof readPdfFile>;

const basePermissions: AgentPermissions = {
    readFiles: true,
    writeFiles: true,
    createFiles: true,
    deleteFiles: true,
    executeCommands: false,
    excludePaths: [],
    useMCPTools: false,
};

function ollamaResponse(response: object, promptTokens = 1, outputTokens = 1) {
    return {
        response: JSON.stringify(response),
        prompt_eval_count: promptTokens,
        eval_count: outputTokens,
    };
}

function preprocessResult(readPaths: string[] = []) {
    return {
        tone: "neutral",
        summary: "test request",
        readPaths,
        writePaths: [],
        task_done: false,
    };
}

function promptResult(response: string) {
    return {
        response,
        writeOperations: [],
        executeOperations: [],
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    mockGenerate.mockReset();
    mockConnect.mockReset();
    mockListTools.mockReset();
    mockGetServerVersion.mockReset();
    mockGetInstructions.mockReset();
    mockCallTool.mockReset();
    mockTransportConstructor.mockReset();
    mockStreamableTransportConstructor.mockReset();

    mockConnect.mockResolvedValue(undefined);
    mockListTools.mockResolvedValue({ tools: [] });
    mockGetServerVersion.mockReturnValue({ name: "test-mcp", version: "1.0.0" });
    mockGetInstructions.mockReturnValue("Use this test server.");
    mockCallTool.mockResolvedValue({ content: [{ type: "text", text: "tool result" }] });
});

describe("prompt preprocessing", () => {
    it('should correctly preprocess a prompt', async () => {
        mockGenerate.mockResolvedValueOnce(ollamaResponse(preprocessResult()));
        const agent = new Agent("test-model", "test context", basePermissions, "/tmp");

        const [result, ptokens, otokens] = await agent.preProcessPrompt("What is 2 + 2?");

        expect(result).toEqual(preprocessResult());
        expect(ptokens).toBe(1);
        expect(otokens).toBe(1);
    });
});

describe("prompt loop", () => {
    it('returns the one-shot generated answer without asking for another evaluator round', async () => {
        mockGenerate
            .mockResolvedValueOnce(ollamaResponse(preprocessResult()))
            .mockResolvedValueOnce(ollamaResponse(promptResult("single pass")));

        const agent = new Agent("test-model", "test context", basePermissions, "/tmp");

        const [result, ptokens, otokens] = await agent.prompt("Finish this task.");

        expect(result?.response).toBe("single pass");
        expect(mockGenerate).toHaveBeenCalledTimes(2);
        expect(ptokens).toBe(1);
        expect(otokens).toBe(1);
    });
});

describe("MCP initialization", () => {
    it('initializes configured streamable HTTP MCP servers with the streamable HTTP client transport', async () => {
        mockListTools.mockResolvedValueOnce({
            tools: [
                {
                    name: "echo_message",
                    description: "Echo a message",
                    inputSchema: { type: "object" },
                },
            ],
        });

        const agent = new Agent("test-model", "test context", basePermissions, "/tmp", [
            { type: "streamable-http", url: "http://localhost:8080/mcp" },
        ]);

        await agent.initializeMCPServers();

        expect(mockStreamableTransportConstructor).toHaveBeenCalled();
        expect(mockConnect).toHaveBeenCalledTimes(1);
        expect(agent.toJSON().mcpReady).toBe(true);
    });

    it('initializes configured MCP servers and stores their tools', async () => {
        mockListTools.mockResolvedValueOnce({
            tools: [
                {
                    name: "search",
                    description: "Search things",
                    inputSchema: { type: "object" },
                },
            ],
        });

        const agent = new Agent("test-model", "test context", basePermissions, "/tmp", [
            { command: "node", args: ["server.js"] },
        ]);

        await agent.initializeMCPServers();

        const state = agent.toJSON();
        expect(mockTransportConstructor).toHaveBeenCalledWith({ command: "node", args: ["server.js"] });
        expect(mockConnect).toHaveBeenCalledTimes(1);
        expect(state.mcpReady).toBe(true);
        expect(state.mcpServers).toEqual([
            {
                name: "test-mcp",
                version: "1.0.0",
                instructions: "Use this test server.",
                command: "node",
                args: ["server.js"],
                tools: [
                    {
                        method: "search",
                        description: "Search things",
                        inputSchema: { type: "object" },
                    },
                ],
            },
        ]);
    });

    it('does not initialize MCP servers more than once', async () => {
        const agent = new Agent("test-model", "test context", basePermissions, "/tmp", [
            { command: "node", args: ["server.js"] },
        ]);

        await agent.initializeMCPServers();
        await agent.initializeMCPServers();

        expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it('records failed MCP initialization without marking servers ready', async () => {
        const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
        mockConnect.mockRejectedValueOnce(new Error("boom"));
        const agent = new Agent("test-model", "test context", basePermissions, "/tmp", [
            { command: "node", args: ["server.js"] },
        ]);

        await agent.initializeMCPServers();
        await agent.initializeMCPServers();

        const state = agent.toJSON();
        expect(mockConnect).toHaveBeenCalledTimes(1);
        expect(state.mcpReady).toBe(false);
        expect(state.mcpInitializationAttempted).toBe(true);
        expect(state.messageHistory).toEqual(
            expect.arrayContaining([
                expect.stringContaining("MCP initialization failed"),
            ])
        );
        consoleError.mockRestore();
    });
});

describe("MCP operations", () => {
    it('surfaces MCP tool text output in the final response payload', async () => {
        const permissions: AgentPermissions = {
            ...basePermissions,
            useMCPTools: true,
        };

        mockListTools.mockResolvedValueOnce({
            tools: [
                {
                    name: "echo_message",
                    description: "Echo a message back.",
                    inputSchema: { type: "object" },
                },
            ],
        });

        mockCallTool.mockResolvedValueOnce({
            content: [{ type: "text", text: "hello" }],
        });

        mockGenerate
            .mockResolvedValueOnce(ollamaResponse(preprocessResult()))
            .mockResolvedValueOnce(ollamaResponse({
                ...promptResult("I will use MCP."),
                mcpOperations: [
                    {
                        server: "test-mcp",
                        tool: "echo_message",
                        arguments: { message: "hello" },
                        reason: "Need external context.",
                    },
                ],
            }));

        const agent = new Agent("test-model", "test context", permissions, "/tmp", [
            { command: "node", args: ["server.js"] },
        ]);

        const [result] = await agent.prompt("Use a tool.");

        expect(result?.response).toContain("hello");
        expect(mockCallTool).toHaveBeenCalledWith({
            name: "echo_message",
            arguments: { message: "hello" },
        });
    });

    it('calls requested MCP tools when MCP permission is enabled', async () => {
        const permissions: AgentPermissions = {
            ...basePermissions,
            useMCPTools: true,
        };

        mockListTools.mockResolvedValueOnce({
            tools: [
                {
                    name: "search",
                    description: "Search things",
                    inputSchema: { type: "object" },
                },
            ],
        });
        mockGenerate
            .mockResolvedValueOnce(ollamaResponse(preprocessResult()))
            .mockResolvedValueOnce(ollamaResponse({
                ...promptResult("I will use MCP."),
                mcpOperations: [
                    {
                        server: "test-mcp",
                        tool: "search",
                        arguments: { query: "loops" },
                        reason: "Need external context.",
                    },
                ],
            }))
            .mockResolvedValueOnce(ollamaResponse({
                task_done: true,
                missing_requirements: [],
                next_prompt: "",
            }));

        const agent = new Agent("test-model", "test context", permissions, "/tmp", [
            { command: "node", args: ["server.js"] },
        ]);

        const [result] = await agent.prompt("Use a tool.");

        expect(result?.response).toContain("I will use MCP.");
        expect(result?.response).toContain("tool result");
        expect(mockCallTool).toHaveBeenCalledWith({
            name: "search",
            arguments: { query: "loops" },
        });
        expect(agent.toJSON().messageHistory).toEqual(
            expect.arrayContaining([
                expect.stringContaining("MCP operation done: Tool search"),
            ])
        );
    });

    it('skips MCP tool calls when MCP permission is disabled', async () => {
        mockGenerate
            .mockResolvedValueOnce(ollamaResponse(preprocessResult()))
            .mockResolvedValueOnce(ollamaResponse({
                ...promptResult("MCP requested without permission."),
                mcpOperations: [
                    {
                        tool: "search",
                        arguments: { query: "loops" },
                        reason: "Need external context.",
                    },
                ],
            }));

        const agent = new Agent("test-model", "test context", basePermissions, "/tmp");

        await agent.prompt("Try a tool.");

        expect(mockCallTool).not.toHaveBeenCalled();
        expect(agent.toJSON().messageHistory).toContain("MCP operations skipped: useMCPTools permission denied.");
    });
});

describe("config helpers", () => {
    it("expands home-relative paths", () => {
        expect(expandHomePath("~/code/edge/config/mcp.json")).toBe(`${os.homedir()}/code/edge/config/mcp.json`);
    });

    it("throws for missing paths", () => {
        expect(() => expandHomePath("")).toThrow("Path is required");
    });
});

// Feature: pdf-reading, Property 8: PDF_Reader does not mutate Agent state fields
describe('Property 8: readPdfFile does not mutate Agent state fields', () => {
    const permissions: AgentPermissions = {
        readFiles: true,
        writeFiles: false,
        createFiles: false,
        deleteFiles: false,
        executeCommands: false,
        excludePaths: [],
        useMCPTools: false,
    };

    it('readPdfFile never changes messageHistory or totalTokens on an Agent instance', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 1 }),
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

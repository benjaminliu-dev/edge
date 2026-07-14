"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const agent_1 = require("./core/agent/agent");
const server = new mcp_js_1.McpServer({
    name: "edge-agent",
    version: "1.0.0",
});
let agentPermissions = {
    readFiles: true,
    writeFiles: true,
    createFiles: true,
    deleteFiles: true,
    executeCommands: false,
    excludePaths: []
};
let default_agent = new agent_1.Agent("gemma4:cloud", "You are an AI study agent.", agentPermissions, "~/code/edge");
server.registerTool("prompt", {
    description: "Prompt Edge Agent",
    inputSchema: {
        prompt: zod_1.z
            .string()
            .describe("The prompt for the agent")
    }
}, async ({ prompt }) => {
    let [response, itokens, otokens] = await default_agent.prompt(prompt);
    if (!response || !itokens || !otokens) {
        return {
            content: [
                {
                    type: "text",
                    text: "Preprocessing error"
                }
            ]
        };
    }
    return {
        content: [
            {
                type: "text",
                text: response.response
            },
            {
                type: "text",
                text: String(itokens)
            },
            {
                type: "text",
                text: String(otokens)
            }
        ]
    };
});
// server.registerTool("dump-agent-stats")
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("Edge Agent MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

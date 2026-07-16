import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Agent } from "./core/agent/agent";
import { AgentPermissions } from "./core/agent/agent-utils";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
    name: "edge-agent",
    version: "1.0.0",
});

let agentPermissions: AgentPermissions = {
    readFiles: true,
    writeFiles: true,
    createFiles: true,
    deleteFiles: true,
    executeCommands: false,
    excludePaths: []
};

let default_agent = new Agent("gemma4:cloud", "You are an AI study agent.", agentPermissions, "~/code/edge");


server.registerTool("prompt", {
    description: "Prompt Edge Agent",
    inputSchema: {
        prompt: z
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
                    text: "Preprocessing/Response error"
                }
            ]
        };
    }


    default_agent.totalTokens += (itokens + otokens);

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

server.registerTool("dump-agent-stats", {
    description: "Dump all agent data",
    inputSchema: {}
}, async ({ }) => {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(default_agent.toJSON())
            }
        ]
    };
});

server.registerTool("token-data", {
    description: "Dump token data",
    inputSchema: {}
}, async ({ }) => {
    return {
        content: [
            {
                type: "text",
                text: default_agent.totalTokens.toString()
            }
        ]
    }
});

async function main() {
    const transport = new StdioServerTransport();

    await server.connect(transport);
    console.error("Edge Agent MCP stdio transport connected");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
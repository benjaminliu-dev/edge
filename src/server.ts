import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Agent } from "./core/agent/agent";
import { AgentPermissions } from "./core/agent/agent-utils";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { MCPConfig } from "./core/mcp/mcp";
import { expandHomePath, readJsonFile } from "./core/config";

const args: string[] = process.argv.slice(2);

dotenv.config({ path: expandHomePath(args[0] || "config/config.env") });

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
    excludePaths: [],
    useMCPTools: false,
};

let mcpServerConfigs: MCPConfig[] = [];


try {
    agentPermissions = readJsonFile<AgentPermissions>(process.env.PERMISSIONS_PATH as string);
} catch (error) {
    console.error(`Failed to read permissions file. Defaulting to the permissions ${JSON.stringify(agentPermissions)}. Error: ${error}`)
}

if (agentPermissions.useMCPTools) {
    try {
        mcpServerConfigs = readJsonFile<MCPConfig[]>(process.env.MCP_CONFIG_PATH as string);
    } catch (error) {
        console.error(`Failed to read MCP config. Defaulting to no MCP servers. Error: ${error}`);
    }
}



let agent = new Agent(
    process.env.MODEL || "gemma4:cloud",
    "You are an AI study agent.",
    agentPermissions,
    process.env.PROJECT_PATH || "~/",
    mcpServerConfigs
);


server.registerTool("prompt", {
    description: "Prompt Edge Agent",
    inputSchema: {
        prompt: z
            .string()
            .describe("The prompt for the agent")
    }
}, async ({ prompt }) => {

    let [response, itokens, otokens] = await agent.prompt(prompt);

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
                text: JSON.stringify(agent.toJSON())
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
                text: agent.totalTokens.toString()
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

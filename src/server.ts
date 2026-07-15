import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Agent } from "./core/agent/agent";
import { AgentPermissions } from "./core/agent/agent-utils";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { randomUUID } from "node:crypto";

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

server.registerTool("dump-agent-stats", {
    description: "Dump all agent data",
    inputSchema: {}
}, async ({}) => {
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(default_agent.toJSON())
            }
        ]
    };
});

async function main() {
    const app = express();
    app.use(express.json());

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
    });

    app.post("/mcp", async (req, res) => {
        await transport.handleRequest(req, res, req.body);
    });

    app.get("/mcp", async (req, res) => {
        await transport.handleRequest(req, res);
    });

    app.post("/sse", async (req, res) => {
        await transport.handleRequest(req, res, req.body);
    });

    app.get("/sse", async (req, res) => {
        await transport.handleRequest(req, res);
    });

    const port = process.env.PORT ? Number(process.env.PORT) : 3001;
    const serverInstance = app.listen(port, "127.0.0.1", () => {
        const address = serverInstance.address();
        console.error(`Edge Agent MCP Server listening on http://127.0.0.1:${port}/mcp and http://127.0.0.1:${port}/sse`);
        console.error(`Server address: ${JSON.stringify(address)}`);
    });
    serverInstance.on("error", (error) => {
        console.error("Edge Agent MCP Server failed to bind port:", error);
        process.exit(1);
    });

    await server.connect(transport);

    console.error("Edge Agent MCP transport connected");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
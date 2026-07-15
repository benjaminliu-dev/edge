import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import readline from "readline";

const client = new Client({
    name: "edge-client",
    version: "1.0.0"
});

const directUrl = process.env.SERVER_URL || "http://127.0.0.1:3001/mcp";
const useStdio = process.env.STDIO_CONNECT === "true";
const transport = useStdio
    ? new StdioClientTransport({
          command: "npx",
          args: ["ts-node", "src/server.ts"],
      })
    : new StreamableHTTPClientTransport(new URL(directUrl));

type Message = { role: "user" | "agent"; text: string };

async function sendPrompt(text: string) {
    try {
        const result = await client.callTool({
            name: "prompt",
            arguments: { prompt: text },
        });

        const textBlocks = Array.isArray(result?.content)
            ? result.content
                  .filter((block: any) => block.type === "text" && typeof block.text === "string")
                  .map((block: any) => block.text)
            : [];

        const responseText = textBlocks.length > 0 ? textBlocks[0] : "(no response)";
        return responseText;
    } catch (error) {
        return `Error: ${String(error)}`;
    }
}

async function main() {
    await client.connect(transport);
    console.log("Connected to Edge Agent MCP server.");
    console.log("Type a message and press Enter. Use /exit or /quit to close.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "You> ",
    });

    rl.on("line", async (line) => {
        const trimmed = line.trim();
        if (!trimmed) {
            rl.prompt();
            return;
        }

        if (trimmed === "/exit" || trimmed === "/quit") {
            rl.close();
            return;
        }

        const responseText = await sendPrompt(trimmed);
        console.log(`Agent> ${responseText}`);
        rl.prompt();
    });

    rl.on("close", () => {
        console.log("Goodbye.");
        process.exit(0);
    });

    rl.prompt();
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
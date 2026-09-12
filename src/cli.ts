import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import readline from "readline";

const client = new Client({
    name: "edge-client",
    version: "1.0.0"
});

const transport = new StdioClientTransport({
    command: "npx",
    args: ["ts-node", "src/server.ts"],
    stderr: "inherit"
});

type Message = { role: "user" | "agent"; text: string };

const GREEN_BOLD = "\x1b[1m\x1b[32m";
const RESET = "\x1b[0m";

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

async function getTokenData() {
    try {
        const result = await client.callTool({
            name: "token-data",
            arguments: {}
        });

        const textBlocks = Array.isArray(result?.content)
            ? result.content
                .filter((block: any) => block.type === "text" && typeof block.text === "string")
                .map((block: any) => block.text)
            : [];

        return textBlocks.length > 0 ? textBlocks[0] : "(no response)";
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

        if (trimmed === "/tokens") {
            console.log(`${GREEN_BOLD}Agent> ${await getTokenData()}${RESET}`);
            rl.prompt()
            return;
        }

        const responseText = await sendPrompt(trimmed);
        console.log(`${GREEN_BOLD}Agent> ${responseText}${RESET}`);
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
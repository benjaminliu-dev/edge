import { Ollama } from "ollama";
import { AgentPermissions, PreprocessResult, PromptResult } from "./agent-utils";
import { response } from "express";
import { readFile } from 'fs/promises';
import { writeFile } from "fs/promises";
import { exec } from "child_process"
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

// TODO: 

/*
Prompt Processing Flow

Preprocessing: Extracts user intent, determines which files to read/write, and generates a concise summary of the request. This step ensures that the agent understands the context and requirements before generating a response.
Response Generation: Uses the preprocessed information to generate a response based on the user's request and the project context. This step involves interacting with the Ollama model to produce a relevant and accurate answer.
Execution: Executes the necessary file operations (read/write) based on the preprocessed instructions. This step ensures that the agent can perform the required actions on the project files as per the user's request.
*/


export class Agent {
    private ollama: Ollama;
    private model: string;
    private agentContext: string
    private permissions: AgentPermissions;
    private messageHistory: any[];
    private readCache: Map<string, string>;
    private totalTokens: number;
    private projectPath: string;

    constructor(model: string, agentContext: string, permissions: AgentPermissions, projectPath: string) {
        this.ollama = new Ollama();
        this.model = model;
        this.agentContext = agentContext;
        this.permissions = permissions;
        this.messageHistory = [];
        this.readCache = new Map();
        this.totalTokens = 0;
        this.projectPath = projectPath;
    }

    public toJSON() {
        return {
            model: this.model,
            agentContext: this.agentContext,
            permissions: this.permissions,
            messageHistory: this.messageHistory,
            readCache: Object.fromEntries(this.readCache),
            totalTokens: this.totalTokens,
            projectPath: this.projectPath
        };
    }

    private resolveReadPath(requestPath: string): string {
        const expandHome = (p: string) => p.startsWith('~') ? path.join(os.homedir(), p.slice(1)) : p;
        const normalizedProjectPath = expandHome(this.projectPath);
        const normalizedRequestPath = expandHome(requestPath);
        return path.isAbsolute(normalizedRequestPath)
            ? normalizedRequestPath
            : path.resolve(normalizedProjectPath, normalizedRequestPath);
    }

    public async preProcessPrompt(prompt: string): Promise<[PreprocessResult | null, number | null, number | null]> {
        try {
            const response = await this.ollama.generate({
                model: this.model,
                prompt: `
You are an AI study agent.

ANY content generate by you and written to files will be on PERFECT markdown

Messages history:
${this.messageHistory}

Read Cache:
${JSON.stringify(Object.fromEntries(this.readCache), null, 2)}

Project context:
${this.agentContext}

Project permissions:
${this.permissions}

Project path:
${this.projectPath}

Stay WITHIN THE PROVIDED PATH. 

If the the request violates workspace permissions, set the "summary" field to the exact string: "NOT_ALLOWED"

Analyze the user's request and produce a planning object.

Requirements:
- Read the entire request carefully.
- Infer the user's intent.
- Decide which project files should be read before answering.
- Decide which files should be modified, if any.
- Keep descriptions concise.
- Do NOT answer the user's request.
- Return ONLY valid JSON.
- Do not wrap the JSON in markdown.
- Do not include any explanations.

IF THE USER REQUESTS A FILE READ OF ANY KIND, INCLUDE IT IN readPaths NO EXCEPTIONS

JSON schema:
{
  "tone": "One short sentence describing the user's tone.",
  "summary": "One concise sentence summarizing the request.",
  "readPaths": [
    "relative/path/to/file1",
    "relative/path/to/file2"
  ],
  "writePaths": [
    {
      "path": "relative/path/to/file",
      "reason": "Why this file needs modification"
    }
  ],
  "task_done": <Evaluate if your task is successfully completed. Set a boolean flag to true ONLY if you have found or generated the exact result requested by the user and have presented it in your response. Otherwise, evaluate to false.>
}

User request:
${prompt},
`,
                stream: false
            });

            const parsed_result: PreprocessResult = JSON.parse(response.response!);
            return [parsed_result, response.prompt_eval_count, response.eval_count];
        } catch (error) {
            console.error("Error preprocessing prompt:", error); // Preprocessing errors do not panic, instead it is handled by the prompt() function does
        }

        return [null, null, null];
    }

    public async prompt(prompt: string): Promise<[PromptResult | null, number | null, number | null]> {
        let [result, ptokens, otokens] = await this.preProcessPrompt(prompt);

        if (!result || !ptokens || !otokens) {
            return [null, null, null];
        }

        this.messageHistory.push(`User prompt: ${prompt}`, `Your preprocessed result: ${JSON.stringify(result)}`);

        this.totalTokens += (ptokens + otokens);

        // read files listed in result into the read cache

        for (let readPath of result.readPaths) {
            try {
                const resolvedPath = this.resolveReadPath(readPath);
                let readResult: string = await readFile(resolvedPath, 'utf-8');
                this.readCache.set(readPath, readResult);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`Read failed for ${readPath}: ${message}`);
                this.readCache.set(readPath, `Read Failure: ${message}`);
            }
        }

        const response = await this.ollama.generate({
            model: this.model,
            prompt: `
You are an AI study agent.

ANY user end content generated by you and written to files will be in PERFECT markdown

Messages history:
${this.messageHistory}

Read Cache:
${JSON.stringify(Object.fromEntries(this.readCache), null, 2)}

Project context:
${this.agentContext}

Project permissions:
${this.permissions}

Project path:
${this.projectPath}

To know whether the task is done or not, read the message history for the previous preprocessed result

- Answer the user's prompt using the project context and read cache.
- Return ONLY valid JSON.
- Do not wrap the JSON in markdown.
- Do not include any explanations.

Response guidelines: 

Include every read, write, and execute operation you performed, explain why, and answer the user's question clearly

{
    "response": <your text response for the user-end>,
    "writeOperations": [
        {
            "path": "the path at which your requested write operation will be carried out. TO CLARIFY: ",
            "content": "the content that must be written to the file"
        }
    ],
    "executeOperations": [
        {
            "command": "the command that you need to execute, cannot be a read/write operation, as that is handled in readPaths and writePaths",
            "reason": "why you this command needs to be executed"
        }
    ]
}
`,
            stream: false
        });

        const parsed_result: PromptResult = JSON.parse(response.response!);

        for (let operation of parsed_result.writeOperations) {
            try {
                // recursively create everything needed
                const dirPath = path.dirname(operation.path);
                await fs.mkdir(dirPath, { recursive: true });
                await fs.writeFile(operation.path, operation.content, 'utf-8');

                this.messageHistory.push(`Write operation done: Path ${operation.path}, Content: ${operation.content}`);
            } catch (error) {
                this.messageHistory.push(`Write operation for ${operation.path} failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        for (let operation of parsed_result.executeOperations) {
            exec(operation.command, (error, stdout, stderr) => {
                this.messageHistory.push(`Executed operation: Command: ${operation.command} Reason: ${operation.reason} Error: ${error}, Stdout: ${stdout}, Stderr: ${stderr}`);
            });
        }


        this.messageHistory.push(`AI Response Object: ${JSON.stringify(response)}`);

        return [parsed_result, response.prompt_eval_count, response.eval_count];
    }
}
import { describe } from "node:test";
import { Agent } from "./agent";
import { AgentPermissions } from "./agent-utils";
import { readFile } from 'fs/promises';

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
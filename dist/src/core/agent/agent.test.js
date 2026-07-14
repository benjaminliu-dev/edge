"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const agent_1 = require("./agent");
const promises_1 = require("fs/promises");
let testAgentPermissions = {
    readFiles: true,
    writeFiles: true,
    createFiles: true,
    deleteFiles: true,
    executeCommands: false,
    excludePaths: []
};
let testAgent = new agent_1.Agent("gemma4:cloud", "You are an AI agent to help only", testAgentPermissions, "~/");
(0, node_test_1.describe)("Test prompt preprocessing", () => {
    it('should correctly preprocess a prompt', async () => {
        let prompt = await (0, promises_1.readFile)("./src/core/prompts/basic_math.txt", 'utf-8');
        const [result, ptokens, otokens] = await testAgent.preProcessPrompt(prompt);
        console.log(result);
        console.log(`${ptokens} input tokens used`);
        console.log(`${otokens} output tokens used`);
        // Assertions run perfectly after the promise resolves
        expect(result).toBeDefined();
    }, 120000);
});
(0, node_test_1.describe)("Test full prompting", () => {
    it('should correctly generate a response to a prompt', async () => {
        let prompt = await (0, promises_1.readFile)("./src/core/prompts/basic_math.txt", 'utf-8');
        const [result, ptokens, otokens] = await testAgent.prompt(prompt);
        console.log(result);
        console.log(`${ptokens} input tokens used`);
        console.log(`${otokens} output tokens used`);
        // Assertions run perfectly after the promise resolves
        expect(result).toBeDefined();
    }, 120000);
});

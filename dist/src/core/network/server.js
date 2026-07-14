"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentServer = void 0;
const json_rpc_2_0_1 = require("json-rpc-2.0");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
class AgentServer {
    // private key: `0x${string}`;
    // private agent: Agent;
    constructor(address, key) {
        this.server = new json_rpc_2_0_1.JSONRPCServer();
        this.app = (0, express_1.default)();
        this.app.use(body_parser_1.default.json());
        this.address = address;
        // this.key = key;
        // this.agent = new Agent();
        this.server.addMethod("prompt", ({ prompt, project_path, permissions, key }) => {
            if (typeof prompt !== "string" || typeof project_path !== "string" || typeof permissions !== "object" /*|| key !== this.key*/) {
                throw new Error("Invalid arguments");
            }
        });
    }
    async start() {
    }
}
exports.AgentServer = AgentServer;

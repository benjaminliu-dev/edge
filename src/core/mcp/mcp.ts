export interface MCPServer {
    name: string,
    version: string,
    instructions: string | null,
    command?: string,
    args?: any[],
    url?: string,
    type?: "stdio" | "streamable-http",
    tools: MCPTool[],
}

export interface MCPTool {
    method: string,
    description: string,
    inputSchema: object,
}

export interface MCPConfig {
    type?: "stdio" | "streamable-http",
    command?: string,
    args?: any[],
    url?: string,
}
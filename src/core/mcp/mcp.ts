export interface MCPServer {
    name: string,
    version: string,
    instructions: string | null,
    command: string,
    args: any[],
    tools: MCPTool[],
}

export interface MCPTool {
    method: string,
    description: string,
    inputSchema: object,
}

export interface MCPConfig {
    command: string, 
    args: any[]
}
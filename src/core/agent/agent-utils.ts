
export interface AgentPermissions {
    readFiles: boolean;
    writeFiles: boolean;
    createFiles: boolean;
    deleteFiles: boolean;
    executeCommands: boolean;
    excludePaths: string[];
    useMCPTools: boolean;
}

export interface PreprocessResult {
    tone: string,
    summary: string,
    readPaths: string[],
    writePaths: {
        path: string,
        reason: string
    }[],
    task_done: boolean;
}

export interface PromptResult {
    response: string,
    writeOperations: {
        path: string,
        content: string,
    }[],
    executeOperations: {
        command: string,
        reason: string
    }[],
    mcpOperations?: {
        server?: string,
        tool: string,
        arguments: Record<string, unknown>,
        reason: string
    }[]
}

export interface TaskEvaluationResult {
    task_done: boolean;
    missing_requirements: string[];
    next_prompt: string;
}

export function extractJson(raw: string): string {
  return raw.replace(/^```json\s*|```\s*$/g, "").trim();
}

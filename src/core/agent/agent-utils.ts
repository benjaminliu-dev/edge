
export interface AgentPermissions {
    readFiles: boolean;
    writeFiles: boolean;
    createFiles: boolean;
    deleteFiles: boolean;
    executeCommands: boolean;
    excludePaths: string[];
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
    }[]
}

export function extractJson(raw: string): string {
  return raw.replace(/^```json\s*|```\s*$/g, "").trim();
}
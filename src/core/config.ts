import { readFileSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function expandHomePath(inputPath: string): string {
    if (!inputPath) {
        throw new Error("Path is required");
    }

    return inputPath.startsWith("~")
        ? path.join(os.homedir(), inputPath.slice(1))
        : inputPath;
}

export function readJsonFile<T>(filePath: string): T {
    return JSON.parse(readFileSync(expandHomePath(filePath), "utf-8")) as T;
}

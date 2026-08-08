import { realpath, readdir, stat } from "node:fs/promises";
import path from "node:path";

import { AppError } from "../shared/errors.js";
import { config } from "../config.js";

export const SUPPORTED_EXTENSIONS = [
    ".mkv",
    ".mp4",
    ".m4v",
    ".mov",
    ".avi",
    ".webm"
] as const;

export interface InputFile {
    name: string;
    sizeBytes: number;
}

/**
 * List supported media files in the input folder (flat, sorted).
 */
export async function scanInput(): Promise<InputFile[]> {
    const entries = await readdir(config.inputDir, {
        withFileTypes: true
    });

    const files: InputFile[] = [];

    for (const entry of entries) {
        if (!entry.isFile()) {
            continue;
        }

        const extension = path
            .extname(entry.name)
            .toLowerCase();

        if (
            !(SUPPORTED_EXTENSIONS as readonly string[]).includes(
                extension
            )
        ) {
            continue;
        }

        const info = await stat(
            path.join(config.inputDir, entry.name)
        );

        files.push({
            name: entry.name,
            sizeBytes: info.size
        });
    }

    files.sort((a, b) => a.name.localeCompare(b.name));

    return files;
}

/**
 * Resolve a user-supplied file NAME strictly inside the input
 * folder. Guards against path traversal ("../", absolute paths)
 * and symlink escapes; never returns a path outside input/.
 */
export async function resolveInputFile(
    name: string
): Promise<string> {
    if (
        name.includes("/") ||
        name.includes("\\") ||
        name === "." ||
        name === ".."
    ) {
        throw new AppError("Invalid file name", {
            statusCode: 400,
            code: "INVALID_FILE_NAME"
        });
    }

    const candidate = path.join(config.inputDir, name);

    const [realInput, realCandidate] = await Promise.all([
        realpath(config.inputDir),
        realpath(candidate).catch(() => null)
    ]);

    if (
        realCandidate === null ||
        !realCandidate.startsWith(realInput + path.sep)
    ) {
        throw new AppError(`File not found in input/: ${name}`, {
            statusCode: 404,
            code: "INPUT_FILE_NOT_FOUND"
        });
    }

    return realCandidate;
}

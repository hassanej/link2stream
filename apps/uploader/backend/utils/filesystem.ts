import { mkdir, unlink } from "node:fs/promises";

export async function ensureDirectory(
    path: string
): Promise<void> {
    await mkdir(path, {
        recursive: true
    });
}

export async function deleteFile(
    path: string
): Promise<void> {
    try {
        await unlink(path);
    } catch (error) {
        if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "ENOENT"
        ) {
            return;
        }

        throw error;
    }
}
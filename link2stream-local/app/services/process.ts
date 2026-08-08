import { spawn } from "node:child_process";

export interface LiveProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

export interface LiveProcessOptions {
    /** Called with each stdout chunk (ffmpeg -progress stream). */
    onStdout?: (chunk: string) => void;
}

/**
 * Spawn a process with an argv array (never a shell string),
 * capture output, resolve on close.
 */
export async function runProcessLive(
    command: string,
    args: string[],
    options?: LiveProcessOptions
): Promise<LiveProcessResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            shell: false
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
            const text = chunk.toString();
            stdout += text;
            options?.onStdout?.(text);
        });

        child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on("error", reject);

        child.on("close", (code) => {
            resolve({
                exitCode: code ?? -1,
                stdout,
                stderr
            });
        });
    });
}

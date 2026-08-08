import { spawn } from "node:child_process";

export interface ProcessResult {
    exitCode: number;
    stdout: string;
    stderr: string;
}

export async function runProcess(
    command: string,
    args: string[],
    cwd?: string
): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd,
            shell: false
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
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

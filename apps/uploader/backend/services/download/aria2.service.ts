import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { AppError } from "../../errors/index.js";
import { logger } from "../../logging/index.js";
import { runProcess } from "../../process/index.js";
import { storageService } from "../../storage/index.js";

export interface VideoMetadata {
    id: string;
    title: string;
    duration?: number;
    uploader?: string;
    webpageUrl: string;
}

export interface DownloadResult {
    filePath: string;
}

export class Aria2DownloadService {
    public async getMetadata(
        url: string
    ): Promise<VideoMetadata> {
        const pathname = new URL(url).pathname;
        const id = pathname.length > 0 ? pathname : url;

        return {
            id,
            title: id,
            webpageUrl: url
        };
    }

    public async download(
        url: string,
        outputDirectory: string
    ): Promise<DownloadResult> {
        logger.info(`Downloading ${url}`);

        const before = new Set(
            (await readdir(outputDirectory)).map(
                (name) => name
            )
        );

        const result = await runProcess(
            "aria2c",
            [
                `--dir=${outputDirectory}`,
                "--check-certificate=false",
                "--allow-overwrite=true",
                "--auto-file-renaming=false",
                "--summary-interval=0",
                "--console-log-level=warn",
                url
            ]
        );

        if (result.exitCode !== 0) {
            throw new AppError(
                result.stderr || "aria2c download failed",
                {
                    statusCode: 500,
                    code: "ARIA2_FAILED"
                }
            );
        }

        const after = await readdir(outputDirectory);
        const newFiles = after.filter(
            (name) => !before.has(name)
        );

        if (newFiles.length === 0) {
            throw new AppError(
                "aria2c produced no downloaded file.",
                {
                    statusCode: 500,
                    code: "ARIA2_NO_OUTPUT"
                }
            );
        }

        if (newFiles.length > 1) {
            throw new AppError(
                "aria2c produced multiple downloaded files.",
                {
                    statusCode: 500,
                    code: "ARIA2_AMBIGUOUS_OUTPUT"
                }
            );
        }

        return {
            filePath: join(outputDirectory, newFiles[0]!)
        };
    }

    public getDownloadDirectory(): string {
        return storageService.getDownloadDirectory();
    }
}

export const aria2DownloadService = new Aria2DownloadService();

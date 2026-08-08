import { parse } from "node:path";

import { AppError } from "../../errors/index.js";
import type { EncodeTarget } from "../../inventory/index.js";
import { logger } from "../../logging/index.js";
import { runProcess } from "../../process/index.js";
import { storageService } from "../../storage/index.js";
import { deleteFile } from "../../utils/index.js";

export interface EncodeResult {
    outputFile: string;
}

const TARGET_HEIGHT: Record<EncodeTarget, number> = {
    "1080p": 1080,
    "720p": 720
};

export class FfmpegService {
    public async transcodeToMp4(
        inputFile: string
    ): Promise<EncodeResult> {
        const parsed = parse(inputFile);

        const outputFile =
            storageService.createEncodedPath(inputFile);

        logger.info(`Encoding ${parsed.base}`);

        const result = await runProcess("ffmpeg", [
            "-nostdin",
            "-y",
            "-i",
            inputFile,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            outputFile
        ]);

        if (result.exitCode !== 0) {
            logger.error(result.stderr);

            throw new AppError(
                result.stderr || "FFmpeg failed",
                {
                    statusCode: 500,
                    code: "FFMPEG_FAILED"
                }
            );
        }

        logger.info(`Encoding completed: ${outputFile}`);
        logger.info(`Delete candidate: ${inputFile}`);

        try {
            await deleteFile(inputFile);

            logger.info(`Deleted source file: ${inputFile}`);
        } catch (error) {
            logger.warn(
                `Failed to delete source file: ${inputFile}: ${String(error)}`
            );
        }

        return {
            outputFile
        };
    }

    /**
     * Downsize a video to at most the target height while
     * preserving aspect ratio. Sources smaller than the target
     * are never upscaled (scale uses min(target, sourceHeight)).
     * The input file is always kept.
     */
    public async downsize(
        inputFile: string,
        target: EncodeTarget
    ): Promise<EncodeResult> {
        const height = TARGET_HEIGHT[target];
        const { name } = parse(inputFile);

        const outputFile = storageService.createEncodedVariantPath(
            inputFile,
            target
        );

        logger.info(`Encoding ${name} -> ${target}`);

        // Commas are escaped so min(...) isn't parsed as a filter separator.
        const scaleFilter = `scale=-2:min(${height}\\,ih)`;

        const result = await runProcess("ffmpeg", [
            "-nostdin",
            "-y",
            "-i",
            inputFile,
            "-vf",
            scaleFilter,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            outputFile
        ]);

        if (result.exitCode !== 0) {
            logger.error(result.stderr);

            throw new AppError(
                result.stderr || "FFmpeg failed",
                {
                    statusCode: 500,
                    code: "FFMPEG_FAILED"
                }
            );
        }

        logger.info(`Encoding completed: ${outputFile}`);

        return {
            outputFile
        };
    }
}

export const ffmpegService = new FfmpegService();
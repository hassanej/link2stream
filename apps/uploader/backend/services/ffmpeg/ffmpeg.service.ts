import { parse } from "node:path";

import { env } from "../../config/env.js";
import { AppError } from "../../errors/index.js";
import type { EncodeTarget } from "../../inventory/index.js";
import { logger } from "../../logging/index.js";
import { runProcess } from "../../process/index.js";
import { storageService } from "../../storage/index.js";
import { deleteFile } from "../../utils/index.js";

export interface EncodeResult {
    outputFile: string;
}

interface ProbeInfo {
    width: number | null;
    height: number | null;
    videoCodec: string | null;
    audioCodec: string | null;
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

        await this.runFfmpegChecked([
            "-nostdin",
            "-y",
            "-i",
            inputFile,
            "-c:v",
            "libx264",
            "-preset",
            env.ffmpegPreset,
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            outputFile
        ]);

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
     *
     * Fast path: when the source already fits the target (no
     * downscale needed) and is already H.264 (+AAC or no audio),
     * the streams are copied into an MP4 wrapper instead of a
     * full re-encode. The input file is always kept.
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

        const probe = await this.probeVideo(inputFile);

        if (this.canStreamCopy(probe, height)) {
            logger.info(
                `No downscale needed for ${name} (${probe?.height}p, ${probe?.videoCodec}); stream-copying instead of re-encoding.`
            );

            await this.runFfmpegChecked([
                "-nostdin",
                "-y",
                "-i",
                inputFile,
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                outputFile
            ]);

            logger.info(`Copy completed: ${outputFile}`);

            return {
                outputFile
            };
        }

        logger.info(
            `Encoding ${name} -> ${target} (preset ${env.ffmpegPreset})`
        );

        // Commas are escaped so min(...) isn't parsed as a filter separator.
        const scaleFilter = `scale=-2:min(${height}\\,ih)`;

        await this.runFfmpegChecked([
            "-nostdin",
            "-y",
            "-i",
            inputFile,
            "-vf",
            scaleFilter,
            "-c:v",
            "libx264",
            "-preset",
            env.ffmpegPreset,
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            outputFile
        ]);

        logger.info(`Encoding completed: ${outputFile}`);

        return {
            outputFile
        };
    }

    private canStreamCopy(
        probe: ProbeInfo | null,
        targetHeight: number
    ): boolean {
        if (!probe || probe.height === null) {
            return false;
        }

        return (
            probe.height <= targetHeight &&
            probe.videoCodec === "h264" &&
            (probe.audioCodec === null || probe.audioCodec === "aac")
        );
    }

    private async probeVideo(
        inputFile: string
    ): Promise<ProbeInfo | null> {
        const result = await runProcess("ffprobe", [
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type,codec_name,width,height",
            "-of",
            "json",
            inputFile
        ]);

        if (result.exitCode !== 0) {
            logger.warn(
                `ffprobe failed for ${inputFile}; falling back to re-encode.`
            );

            return null;
        }

        try {
            const parsed = JSON.parse(result.stdout) as {
                streams?: Array<{
                    codec_type?: string;
                    codec_name?: string;
                    width?: number;
                    height?: number;
                }>;
            };

            const video = (parsed.streams ?? []).find(
                (stream) => stream.codec_type === "video"
            );

            const audio = (parsed.streams ?? []).find(
                (stream) => stream.codec_type === "audio"
            );

            return {
                width: video?.width ?? null,
                height: video?.height ?? null,
                videoCodec: video?.codec_name ?? null,
                audioCodec: audio?.codec_name ?? null
            };
        } catch {
            logger.warn(
                `Could not parse ffprobe output for ${inputFile}; falling back to re-encode.`
            );

            return null;
        }
    }

    private async runFfmpegChecked(args: string[]): Promise<void> {
        const result = await runProcess("ffmpeg", args);

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
    }
}

export const ffmpegService = new FfmpegService();

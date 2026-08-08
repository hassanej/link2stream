import path from "node:path";

import { runProcessLive } from "./process.js";
import { probeMedia } from "./prober.js";
import { PROFILES } from "./profiles.js";

import type { ProfileId } from "./profiles.js";

export interface EncodeOutcome {
    outputPath: string;
}

/**
 * Build the ffmpeg argument list for a profile. Arguments are
 * always passed as an array (never joined into a shell string),
 * so any filename (spaces, quotes, brackets) is safe.
 *
 * Encoder: h264_videotoolbox (Apple Silicon hardware encoder)
 * driven by target bitrate — NOT CRF, since VideoToolbox's
 * quality model differs from libx264.
 */
export function buildEncodeArgs(input: {
    inputPath: string;
    outputPath: string;
    profile: ProfileId;
    probe: {
        audioCopyable: boolean;
        subtitles: { index: number; isText: boolean }[];
    };
}): string[] {
    const profile = PROFILES[input.profile];

    const args: string[] = [
        "-nostdin",
        "-y",
        "-progress",
        "pipe:1",
        "-nostats",
        "-i",
        input.inputPath
    ];

    // Map: primary video, all audio, text subtitles only (bitmap
    // subtitles e.g. PGS/VobSub cannot live in MP4).
    args.push("-map", "0:v:0", "-map", "0:a?");

    const textSubtitleIndexes = input.probe.subtitles
        .filter((sub) => sub.isText)
        .map((sub) => sub.index);

    for (const index of textSubtitleIndexes) {
        args.push("-map", `0:${index}`);
    }

    // Scale to at most the profile height, preserving aspect
    // ratio, never upscaling (min(cap, sourceHeight)).
    // Commas are escaped so min() isn't read as a filter split.
    const scaleFilter = `scale=-2:min(${profile.maxHeight}\\,ih),format=yuv420p`;

    args.push("-vf", scaleFilter);

    args.push("-c:v", "h264_videotoolbox");
    args.push("-b:v", profile.videoBitrate);
    args.push("-maxrate", profile.maxRate);
    args.push("-bufsize", profile.bufferSize);
    args.push("-profile:v", "high");
    args.push("-tag:v", "avc1");
    args.push("-pix_fmt", "yuv420p");

    if (input.probe.audioCopyable) {
        args.push("-c:a", "copy");
    } else {
        args.push("-c:a", "aac", "-b:a", profile.audioBitrate);
    }

    if (textSubtitleIndexes.length > 0) {
        args.push("-c:s", "mov_text");
    }

    args.push("-movflags", "+faststart");
    args.push(input.outputPath);

    return args;
}

export function outputPathFor(
    outputDir: string,
    inputPath: string,
    profile: ProfileId
): string {
    const { name } = path.parse(inputPath);
    return path.join(
        outputDir,
        `${name}${PROFILES[profile].suffix}`
    );
}

/**
 * Encode inputPath -> outputPath for the given profile,
 * reporting progress (0-100) as ffmpeg runs.
 */
export async function encodeFile(input: {
    inputPath: string;
    outputPath: string;
    profile: ProfileId;
    onProgress: (percent: number) => void;
    signal?: AbortSignal | undefined;
}): Promise<EncodeOutcome> {
    const probe = await probeMedia(input.inputPath);

    const args = buildEncodeArgs({
        inputPath: input.inputPath,
        outputPath: input.outputPath,
        profile: input.profile,
        probe
    });

    const durationUs =
        probe.durationSec !== null
            ? probe.durationSec * 1_000_000
            : null;

    const result = await runProcessLive("ffmpeg", args, {
        onStdout: (chunk) => {
            if (durationUs === null || durationUs <= 0) {
                return;
            }

            const match = chunk.match(
                /out_time_(?:us|ms)=(\d+)/
            );

            if (match) {
                const outUs = Number(match[1]);

                input.onProgress(
                    Math.min(
                        99,
                        Math.round((outUs / durationUs) * 100)
                    )
                );
            }
        }
    });

    if (result.exitCode !== 0) {
        throw new Error(
            `ffmpeg failed (exit ${result.exitCode}): ${result.stderr.slice(-2000)}`
        );
    }

    input.onProgress(100);

    return { outputPath: input.outputPath };
}

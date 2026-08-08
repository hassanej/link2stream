import { runProcess } from "../shared/process.js";

export const COPYABLE_AUDIO_CODECS = new Set([
    "aac",
    "mp3",
    "ac3",
    "eac3",
    "alac"
]);

export const TEXT_SUBTITLE_CODECS = new Set([
    "subrip",
    "ass",
    "ssa",
    "mov_text",
    "webvtt"
]);

export interface ProbedSubtitle {
    index: number;
    codec: string;
    language: string | null;
    isText: boolean;
}

export interface ProbeResult {
    durationSec: number | null;
    width: number | null;
    height: number | null;
    videoCodec: string | null;
    /** true when every audio stream can be stream-copied into mp4 */
    audioCopyable: boolean;
    subtitles: ProbedSubtitle[];
}

interface FfprobeStream {
    index?: number;
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    tags?: { language?: string };
}

/**
 * Inspect a media file with ffprobe. Throws if the file
 * cannot be analysed at all.
 */
export async function probeMedia(
    filePath: string
): Promise<ProbeResult> {
    const result = await runProcess("ffprobe", [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=index,codec_type,codec_name,width,height:stream_tags=language",
        "-of",
        "json",
        filePath
    ]);

    if (result.exitCode !== 0) {
        throw new Error(
            `ffprobe failed: ${result.stderr || result.stdout}`
        );
    }

    const parsed = JSON.parse(result.stdout) as {
        format?: { duration?: string };
        streams?: FfprobeStream[];
    };

    const streams = parsed.streams ?? [];

    const video = streams.find(
        (stream) => stream.codec_type === "video"
    );

    const audioStreams = streams.filter(
        (stream) => stream.codec_type === "audio"
    );

    const subtitleStreams = streams.filter(
        (stream) => stream.codec_type === "subtitle"
    );

    const durationRaw = parsed.format?.duration;
    const durationSec =
        typeof durationRaw === "string"
            ? Number.parseFloat(durationRaw)
            : null;

    return {
        durationSec:
            durationSec !== null && Number.isFinite(durationSec)
                ? durationSec
                : null,
        width: video?.width ?? null,
        height: video?.height ?? null,
        videoCodec: video?.codec_name ?? null,
        audioCopyable:
            audioStreams.length > 0 &&
            audioStreams.every((stream) =>
                COPYABLE_AUDIO_CODECS.has(stream.codec_name ?? "")
            ),
        subtitles: subtitleStreams.map((stream) => ({
            index: stream.index ?? 0,
            codec: stream.codec_name ?? "unknown",
            language: stream.tags?.language ?? null,
            isText: TEXT_SUBTITLE_CODECS.has(
                stream.codec_name ?? ""
            )
        }))
    };
}

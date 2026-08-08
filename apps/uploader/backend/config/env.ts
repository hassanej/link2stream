import dotenv from "dotenv";

dotenv.config();

const X264_PRESETS = [
    "ultrafast",
    "superfast",
    "veryfast",
    "faster",
    "fast",
    "medium",
    "slow",
    "slower",
    "veryslow",
    "placebo"
] as const;

type X264Preset = (typeof X264_PRESETS)[number];

function loadFfmpegPreset(): X264Preset {
    const raw = process.env.FFMPEG_PRESET;

    if (
        raw !== undefined &&
        (X264_PRESETS as readonly string[]).includes(raw)
    ) {
        return raw as X264Preset;
    }

    return "medium";
}

export const env = {
    port: Number(process.env.PORT ?? 3000),
    ffmpegPreset: loadFfmpegPreset()
};

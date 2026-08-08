/**
 * The two (and only two) output profiles.
 *
 * - smaller-1080p: cap at 1080p, ~3 Mbps video target
 * - 720p:          cap at 720p,  ~2 Mbps video target
 *
 * Sources below the cap are never upscaled (scale uses
 * min(cap, sourceHeight)); the bitrate reduction still applies.
 */
export const PROFILES = {
    "smaller-1080p": {
        label: "Smaller 1080p",
        maxHeight: 1080,
        videoBitrate: "3M",
        maxRate: "4M",
        bufferSize: "8M",
        audioBitrate: "128k",
        suffix: ".1080p.mp4"
    },
    "720p": {
        label: "720p",
        maxHeight: 720,
        videoBitrate: "2M",
        maxRate: "2.5M",
        bufferSize: "5M",
        audioBitrate: "128k",
        suffix: ".720p.mp4"
    }
} as const;

export type ProfileId = keyof typeof PROFILES;

export function isProfileId(value: unknown): value is ProfileId {
    return typeof value === "string" && value in PROFILES;
}

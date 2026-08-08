export type MediaKind = "movie" | "series";

export type EncodeTarget = "1080p" | "720p";

export type ChosenVersion = "original" | EncodeTarget;

export type MediaStatus =
    | "downloaded"
    | "renamed"
    | "encoded"
    | "chosen"
    | "uploaded"
    | "cleaned";

export interface EncodedVariant {
    target: EncodeTarget;
    filePath: string;
    sizeBytes: number;
    encodedAt: string;
}

export interface MediaItem {
    id: string;
    kind: MediaKind;
    sourceUrl: string;
    /** Absolute path of the original downloaded file. */
    filePath: string;
    /** Current base file name (including extension). */
    fileName: string;
    sizeBytes: number | null;
    encoded: EncodedVariant[];
    chosen: ChosenVersion | null;
    status: MediaStatus;
    r2Key: string | null;
    r2Url: string | null;
    uploadedAt: string | null;
    localDeletedAt: string | null;
    downloadJobId: string | null;
    createdAt: string;
    updatedAt: string;
}

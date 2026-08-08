import path from "node:path";

export const ROOT_DIRECTORY = process.cwd();

export const STORAGE_DIRECTORY = path.join(ROOT_DIRECTORY, "storage");

export const DOWNLOAD_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "downloads"
);

export const ENCODE_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "encoded"
);

export const PREVIEW_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "previews"
);

export const TEMP_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "temp"
);

export const LOG_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "logs"
);

export const CACHE_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "cache"
);

export const THUMBNAIL_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "thumbnails"
);

export const METADATA_DIRECTORY = path.join(
    STORAGE_DIRECTORY,
    "metadata"
);

export const PUBLIC_DIRECTORY = path.join(
    ROOT_DIRECTORY,
    "backend",
    "public"
);
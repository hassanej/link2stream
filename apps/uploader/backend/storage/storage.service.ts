import { join, parse } from "node:path";

import {
    CACHE_DIRECTORY,
    DOWNLOAD_DIRECTORY,
    ENCODE_DIRECTORY,
    LOG_DIRECTORY,
    METADATA_DIRECTORY,
    PREVIEW_DIRECTORY,
    STORAGE_DIRECTORY,
    TEMP_DIRECTORY,
    THUMBNAIL_DIRECTORY
} from "../constants/index.js";

import { ensureDirectory } from "../utils/index.js";
import { logger } from "../logging/index.js";

interface StorageDirectory {
    name: string;
    path: string;
}

export class StorageService {
    private readonly directories: StorageDirectory[] = [
        { name: "Storage", path: STORAGE_DIRECTORY },
        { name: "Downloads", path: DOWNLOAD_DIRECTORY },
        { name: "Encoded", path: ENCODE_DIRECTORY },
        { name: "Previews", path: PREVIEW_DIRECTORY },
        { name: "Temporary", path: TEMP_DIRECTORY },
        { name: "Logs", path: LOG_DIRECTORY },
        { name: "Cache", path: CACHE_DIRECTORY },
        { name: "Thumbnails", path: THUMBNAIL_DIRECTORY },
        { name: "Metadata", path: METADATA_DIRECTORY }
    ];

    public getStorageDirectory(): string {
        return STORAGE_DIRECTORY;
    }

    public getDownloadDirectory(): string {
        return DOWNLOAD_DIRECTORY;
    }

    public getEncodedDirectory(): string {
        return ENCODE_DIRECTORY;
    }

    public getPreviewDirectory(): string {
        return PREVIEW_DIRECTORY;
    }

    public getTempDirectory(): string {
        return TEMP_DIRECTORY;
    }

    public getLogDirectory(): string {
        return LOG_DIRECTORY;
    }

    public getCacheDirectory(): string {
        return CACHE_DIRECTORY;
    }

    public getThumbnailDirectory(): string {
        return THUMBNAIL_DIRECTORY;
    }

    public getMetadataDirectory(): string {
        return METADATA_DIRECTORY;
    }

    public createEncodedPath(inputFile: string): string {
        const { name } = parse(inputFile);

        return join(
            ENCODE_DIRECTORY,
            `${name}.mp4`
        );
    }

    public createEncodedVariantPath(
        inputFile: string,
        target: string
    ): string {
        const { name } = parse(inputFile);

        return join(
            ENCODE_DIRECTORY,
            `${name}.${target}.mp4`
        );
    }

    public async initialize(): Promise<void> {
        logger.info("Initializing storage...");

        for (const directory of this.directories) {
            await ensureDirectory(directory.path);

            logger.info(
                `${directory.name.padEnd(12)} ${directory.path}`
            );
        }

        logger.info("Storage initialized.");
    }
}

export const storageService = new StorageService();
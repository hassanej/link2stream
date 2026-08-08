import { stat } from "node:fs/promises";

import { INVENTORY_ID_PREFIX } from "../constants/index.js";
import { AppError } from "../errors/index.js";
import { logger } from "../logging/index.js";
import { createId, nowIso } from "../utils/index.js";

import { mediaStore } from "./media.store.js";
import type {
    ChosenVersion,
    EncodeTarget,
    EncodedVariant,
    MediaItem,
    MediaKind,
    MediaStatus
} from "./media.types.js";

export class MediaService {
    public async initialize(): Promise<void> {
        await mediaStore.load();
    }

    public async registerDownloaded(input: {
        kind: MediaKind;
        sourceUrl: string;
        filePath: string;
        downloadJobId?: string;
    }): Promise<MediaItem> {
        const fileName = input.filePath.split("/").pop() ?? input.filePath;

        const sizeBytes = await this.safeSize(input.filePath);

        const now = nowIso();

        const item: MediaItem = {
            id: createId(INVENTORY_ID_PREFIX),
            kind: input.kind,
            sourceUrl: input.sourceUrl,
            filePath: input.filePath,
            fileName,
            sizeBytes,
            encoded: [],
            chosen: null,
            status: "downloaded",
            r2Key: null,
            r2Url: null,
            uploadedAt: null,
            localDeletedAt: null,
            downloadJobId: input.downloadJobId ?? null,
            createdAt: now,
            updatedAt: now
        };

        mediaStore.set(item);

        logger.info(`Registered media item ${item.id} (${fileName})`);

        return item;
    }

    public get(id: string): MediaItem {
        const item = mediaStore.get(id);

        if (!item) {
            throw new AppError("Media item not found", {
                statusCode: 404,
                code: "MEDIA_NOT_FOUND"
            });
        }

        return item;
    }

    public getAll(): MediaItem[] {
        return mediaStore
            .getAll()
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    public update(
        id: string,
        patch: Partial<MediaItem>
    ): MediaItem {
        const item = this.get(id);

        const updated: MediaItem = {
            ...item,
            ...patch,
            id: item.id,
            updatedAt: nowIso()
        };

        mediaStore.set(updated);

        return updated;
    }

    public setStatus(id: string, status: MediaStatus): MediaItem {
        return this.update(id, { status });
    }

    public addEncoded(id: string, variant: EncodedVariant): MediaItem {
        const item = this.get(id);

        const encoded = [
            ...item.encoded.filter(
                (existing) => existing.target !== variant.target
            ),
            variant
        ];

        return this.update(id, { encoded, status: "encoded" });
    }

    public choose(id: string, version: ChosenVersion): MediaItem {
        const item = this.get(id);

        if (version !== "original") {
            const variant = item.encoded.find(
                (entry) => entry.target === version
            );

            if (!variant) {
                throw new AppError(
                    `Encoded ${version} version does not exist for this item.`,
                    {
                        statusCode: 400,
                        code: "ENCODED_VERSION_MISSING"
                    }
                );
            }
        }

        return this.update(id, { chosen: version, status: "chosen" });
    }

    public markUploaded(
        id: string,
        r2Key: string,
        r2Url: string | null
    ): MediaItem {
        return this.update(id, {
            status: "uploaded",
            r2Key,
            r2Url,
            uploadedAt: nowIso()
        });
    }

    public markLocalDeleted(id: string): MediaItem {
        return this.update(id, {
            status: "cleaned",
            localDeletedAt: nowIso()
        });
    }

    /**
     * Resolve the absolute path of the version that would be
     * uploaded. Throws if nothing has been chosen yet.
     */
    public getUploadSource(id: string): {
        filePath: string;
        version: ChosenVersion;
    } {
        const item = this.get(id);

        if (!item.chosen) {
            throw new AppError(
                "No version chosen for this media item.",
                {
                    statusCode: 400,
                    code: "MEDIA_VERSION_NOT_CHOSEN"
                }
            );
        }

        if (item.chosen === "original") {
            return {
                filePath: item.filePath,
                version: "original"
            };
        }

        const variant = item.encoded.find(
            (entry) => entry.target === item.chosen
        );

        if (!variant) {
            throw new AppError(
                "Chosen encoded version no longer exists.",
                {
                    statusCode: 400,
                    code: "ENCODED_VERSION_MISSING"
                }
            );
        }

        return {
            filePath: variant.filePath,
            version: item.chosen
        };
    }

    /** All local files belonging to the item. */
    public getLocalFiles(id: string): string[] {
        const item = this.get(id);

        return [
            item.filePath,
            ...item.encoded.map((variant) => variant.filePath)
        ];
    }

    private async safeSize(
        filePath: string
    ): Promise<number | null> {
        try {
            const info = await stat(filePath);
            return info.size;
        } catch {
            return null;
        }
    }
}

export const mediaService = new MediaService();

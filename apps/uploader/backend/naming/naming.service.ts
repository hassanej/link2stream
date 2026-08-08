import { rename } from "node:fs/promises";
import { dirname, join, parse } from "node:path";

import { AppError } from "../errors/index.js";
import { mediaService } from "../inventory/index.js";
import type { MediaItem } from "../inventory/index.js";
import { logger } from "../logging/index.js";

export interface RenameEntry {
    mediaId: string;
    /** New base name without extension, e.g. "Show S01E01". */
    newName: string;
}

const CONTROL_CHARS = new RegExp(
    "[\\u0000-\\u001f\\u007f]",
    "g"
);

export function sanitizeBaseName(name: string): string {
    const cleaned = name
        .replace(/[/\\]/g, "_")
        .replace(CONTROL_CHARS, "")
        .trim();

    return cleaned;
}

function variantSuffix(variantPath: string, oldBase: string): string {
    const fileName = parse(variantPath).base;

    if (fileName.startsWith(oldBase)) {
        return fileName.slice(oldBase.length);
    }

    return parse(variantPath).ext;
}

export class NamingService {
    /**
     * Rename a single media item's original file (and any
     * encoded variants, preserving their ".1080p.mp4" style
     * suffixes). No-op if the name is unchanged.
     */
    public async rename(
        mediaId: string,
        requestedName: string
    ): Promise<MediaItem> {
        const item = mediaService.get(mediaId);
        const newBase = sanitizeBaseName(requestedName);

        if (!newBase) {
            throw new AppError("Invalid name", {
                statusCode: 400,
                code: "INVALID_NAME"
            });
        }

        const { name: currentBase, ext } = parse(item.filePath);

        if (newBase === currentBase) {
            return item;
        }

        const directory = dirname(item.filePath);
        const newPath = join(directory, `${newBase}${ext}`);

        await rename(item.filePath, newPath);

        const encoded = [];

        for (const variant of item.encoded) {
            const suffix = variantSuffix(
                variant.filePath,
                currentBase
            );

            const newVariantPath = join(
                dirname(variant.filePath),
                `${newBase}${suffix}`
            );

            try {
                await rename(variant.filePath, newVariantPath);

                encoded.push({
                    ...variant,
                    filePath: newVariantPath
                });
            } catch (error) {
                logger.warn(
                    `Could not rename encoded variant ${variant.filePath}: ${String(error)}`
                );

                encoded.push(variant);
            }
        }

        logger.info(
            `Renamed ${item.fileName} -> ${newBase}${ext}`
        );

        return mediaService.update(mediaId, {
            filePath: newPath,
            fileName: `${newBase}${ext}`,
            encoded,
            status: "renamed"
        });
    }

    /**
     * Batch rename for series: entries are applied sequentially.
     * Any failure aborts with an error; earlier renames stay applied.
     */
    public async renameBatch(
        entries: RenameEntry[]
    ): Promise<MediaItem[]> {
        if (!Array.isArray(entries) || entries.length === 0) {
            throw new AppError("No rename entries provided", {
                statusCode: 400,
                code: "RENAME_ENTRIES_MISSING"
            });
        }

        const results: MediaItem[] = [];

        for (const entry of entries) {
            if (
                typeof entry?.mediaId !== "string" ||
                typeof entry?.newName !== "string"
            ) {
                throw new AppError("Invalid rename entry", {
                    statusCode: 400,
                    code: "INVALID_RENAME_ENTRY"
                });
            }

            results.push(
                await this.rename(entry.mediaId, entry.newName)
            );
        }

        return results;
    }
}

export const namingService = new NamingService();

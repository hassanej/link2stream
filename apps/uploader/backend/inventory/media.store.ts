import { readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { METADATA_DIRECTORY } from "../constants/index.js";
import { logger } from "../logging/index.js";
import { ensureDirectory } from "../utils/index.js";

import type { MediaItem } from "./media.types.js";

const STORE_FILE = join(METADATA_DIRECTORY, "media.json");

/**
 * JSON-file persistence for the media registry.
 * Writes are serialized through a promise chain and are
 * atomic (write to temp file, then rename).
 */
export class MediaStore {
    private items = new Map<string, MediaItem>();

    private writeQueue: Promise<void> = Promise.resolve();

    public async load(): Promise<void> {
        let raw: string;

        try {
            raw = await readFile(STORE_FILE, "utf8");
        } catch {
            this.items = new Map();
            return;
        }

        try {
            const parsed = JSON.parse(raw) as MediaItem[];

            this.items = new Map(
                parsed.map((item) => [item.id, item])
            );

            logger.info(
                `Loaded ${this.items.size} media item(s) from disk.`
            );
        } catch {
            logger.warn(
                "Media store file is corrupt; starting empty."
            );

            this.items = new Map();
        }
    }

    public getAll(): MediaItem[] {
        return [...this.items.values()];
    }

    public get(id: string): MediaItem | undefined {
        return this.items.get(id);
    }

    public set(item: MediaItem): void {
        this.items.set(item.id, item);
        this.persist();
    }

    public delete(id: string): void {
        this.items.delete(id);
        this.persist();
    }

    private persist(): void {
        this.writeQueue = this.writeQueue.then(async () => {
            try {
                await ensureDirectory(METADATA_DIRECTORY);

                const tempFile = `${STORE_FILE}.tmp`;

                await writeFile(
                    tempFile,
                    JSON.stringify(this.getAll(), null, 2),
                    "utf8"
                );

                await rename(tempFile, STORE_FILE);
            } catch (error) {
                logger.error(
                    `Failed to persist media store: ${String(error)}`
                );
            }
        });
    }
}

export const mediaStore = new MediaStore();

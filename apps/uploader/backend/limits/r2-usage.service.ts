import { stat } from "node:fs/promises";
import { parse } from "node:path";

import { AppError } from "../errors/index.js";
import { mediaService } from "../inventory/index.js";
import { r2StorageService } from "../services/r2/index.js";
import type { R2ObjectInfo } from "../services/r2/index.js";

/** Application storage budget: 10 GiB. */
export const R2_STORAGE_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;

export interface R2UsageReport {
    usedBytes: number;
    limitBytes: number;
    remainingBytes: number;
    files: R2ObjectInfo[];
}

export interface PrecheckEntry {
    mediaId: string;
    name: string;
    sizeBytes: number;
    alreadyUploaded: boolean;
    fits: boolean;
}

export interface PrecheckReport {
    remainingBytes: number;
    totalSelectedBytes: number;
    remainingAfterBytes: number;
    entries: PrecheckEntry[];
}

export class R2UsageService {
    public async getUsage(): Promise<R2UsageReport> {
        const files = await r2StorageService.listObjects();

        const usedBytes = files.reduce(
            (total, file) => total + file.size,
            0
        );

        return {
            usedBytes,
            limitBytes: R2_STORAGE_LIMIT_BYTES,
            remainingBytes:
                R2_STORAGE_LIMIT_BYTES - usedBytes,
            files
        };
    }

    /**
     * Evaluate the chosen version of each media item against
     * the remaining R2 budget. Entries are evaluated in the
     * order given; `fits` reflects cumulative consumption.
     */
    public async precheck(
        mediaIds: string[]
    ): Promise<PrecheckReport> {
        const usage = await this.getUsage();

        let runningRemaining = usage.remainingBytes;
        let totalSelectedBytes = 0;

        const entries: PrecheckEntry[] = [];

        for (const mediaId of mediaIds) {
            const item = mediaService.get(mediaId);
            const { filePath } =
                mediaService.getUploadSource(mediaId);

            const info = await stat(filePath);

            const sizeBytes = info.size;
            const fits = sizeBytes <= runningRemaining;

            if (fits) {
                runningRemaining -= sizeBytes;
            }

            totalSelectedBytes += sizeBytes;

            entries.push({
                mediaId,
                name: parse(filePath).base,
                sizeBytes,
                alreadyUploaded: item.uploadedAt !== null,
                fits
            });
        }

        return {
            remainingBytes: usage.remainingBytes,
            totalSelectedBytes,
            remainingAfterBytes:
                usage.remainingBytes - totalSelectedBytes,
            entries
        };
    }

    /**
     * Throw unless every selected item fits within the
     * remaining budget. Upload uses this as a final guard.
     */
    public async assertSelectionFits(
        mediaIds: string[]
    ): Promise<void> {
        const report = await this.precheck(mediaIds);

        const failing = report.entries.filter(
            (entry) => !entry.fits
        );

        if (failing.length > 0) {
            throw new AppError(
                `Not enough R2 space for: ${failing
                    .map((entry) => entry.name)
                    .join(", ")}`,
                {
                    statusCode: 400,
                    code: "R2_BUDGET_EXCEEDED"
                }
            );
        }
    }
}

export const r2UsageService = new R2UsageService();

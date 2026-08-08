import { parse } from "node:path";

import { AppError } from "../../errors/index.js";
import { mediaService } from "../../inventory/index.js";
import type { Job } from "../../jobs/index.js";
import { jobService } from "../../jobs/index.js";
import { r2UsageService } from "../../limits/index.js";
import { logger } from "../../logging/index.js";
import { r2StorageService } from "../../services/r2/index.js";

export function objectKeyFor(filePath: string): string {
    return `media/${parse(filePath).base}`;
}

export async function uploadExecutor(
    job: Job
): Promise<void> {
    const rawIds = job.metadata.mediaIds;

    if (
        !Array.isArray(rawIds) ||
        rawIds.length === 0 ||
        rawIds.some((id) => typeof id !== "string")
    ) {
        throw new AppError(
            "Upload job requires a non-empty mediaIds array.",
            {
                statusCode: 400,
                code: "UPLOAD_MEDIA_IDS_MISSING"
            }
        );
    }

    const mediaIds = rawIds as string[];

    // Final budget guard before uploading anything.
    await r2UsageService.assertSelectionFits(mediaIds);

    let completed = 0;

    for (const mediaId of mediaIds) {
        const item = mediaService.get(mediaId);

        if (item.uploadedAt && item.r2Key) {
            logger.info(
                `Skipping ${item.fileName}: already uploaded.`
            );

            completed += 1;

            continue;
        }

        const { filePath, version } =
            mediaService.getUploadSource(mediaId);

        const objectKey = objectKeyFor(filePath);

        logger.info(
            `Uploading ${item.fileName} (${version}) -> ${objectKey}`
        );

        const result = await r2StorageService.uploadFile(
            filePath,
            objectKey
        );

        // Confirm the upload actually landed before marking it.
        const confirmed =
            await r2StorageService.objectExists(objectKey);

        if (!confirmed) {
            throw new AppError(
                `Upload could not be confirmed for ${objectKey}`,
                {
                    statusCode: 500,
                    code: "R2_UPLOAD_UNCONFIRMED"
                }
            );
        }

        mediaService.markUploaded(
            mediaId,
            result.objectKey,
            result.publicUrl ?? null
        );

        completed += 1;

        jobService.update(job.id, {
            progress: Math.round(
                (completed / mediaIds.length) * 100
            )
        });

        logger.info(`Uploaded ${item.fileName} -> ${objectKey}`);
    }
}

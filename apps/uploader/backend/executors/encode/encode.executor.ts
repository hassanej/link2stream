import { AppError } from "../../errors/index.js";
import { mediaService } from "../../inventory/index.js";
import type { EncodeTarget } from "../../inventory/index.js";
import type { Job } from "../../jobs/index.js";
import { jobService } from "../../jobs/index.js";
import { logger } from "../../logging/index.js";
import { ffmpegService } from "../../services/ffmpeg/index.js";
import { nowIso } from "../../utils/index.js";

import { stat } from "node:fs/promises";

export async function encodeExecutor(
    job: Job
): Promise<void> {
    const mediaId = job.metadata.mediaId;
    const target = job.metadata.target;

    if (typeof mediaId !== "string" || mediaId.length === 0) {
        throw new AppError("Encode job is missing a mediaId.", {
            statusCode: 400,
            code: "ENCODE_MEDIA_ID_MISSING"
        });
    }

    if (target !== "1080p" && target !== "720p") {
        throw new AppError(
            "Encode job target must be 1080p or 720p.",
            {
                statusCode: 400,
                code: "ENCODE_TARGET_INVALID"
            }
        );
    }

    const item = mediaService.get(mediaId);

    logger.info(`Encoding ${item.fileName} -> ${target}`);

    jobService.update(job.id, { progress: 10 });

    const result = await ffmpegService.downsize(
        item.filePath,
        target as EncodeTarget
    );

    const info = await stat(result.outputFile);

    mediaService.addEncoded(mediaId, {
        target: target as EncodeTarget,
        filePath: result.outputFile,
        sizeBytes: info.size,
        encodedAt: nowIso()
    });

    jobService.update(job.id, {
        progress: 100,
        metadata: {
            ...job.metadata,
            encodedFile: result.outputFile
        }
    });

    logger.info(
        `Encoded ${item.fileName} -> ${result.outputFile}`
    );
}

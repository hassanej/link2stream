import { AppError } from "../../errors/index.js";
import { mediaService } from "../../inventory/index.js";
import type { Job } from "../../jobs/index.js";
import { jobService } from "../../jobs/index.js";
import { logger } from "../../logging/index.js";
import { aria2DownloadService } from "../../services/download/index.js";

export async function downloadExecutor(
    job: Job
): Promise<void> {
    const url = job.metadata.url;

    if (typeof url !== "string" || url.length === 0) {
        throw new AppError(
            "Download job is missing a URL.",
            {
                statusCode: 400,
                code: "DOWNLOAD_URL_MISSING"
            }
        );
    }

    const kind =
        job.metadata.kind === "series" ? "series" : "movie";

    logger.info(`Downloading ${url}`);

    jobService.update(job.id, { progress: 10 });

    const downloadResult =
        await aria2DownloadService.download(
            url,
            aria2DownloadService.getDownloadDirectory()
        );

    const item = await mediaService.registerDownloaded({
        kind,
        sourceUrl: url,
        filePath: downloadResult.filePath,
        downloadJobId: job.id
    });

    jobService.update(job.id, {
        progress: 100,
        metadata: {
            ...job.metadata,
            mediaId: item.id,
            downloadedFile: downloadResult.filePath
        }
    });

    logger.info(
        `Download completed: ${downloadResult.filePath} (${item.id})`
    );
}

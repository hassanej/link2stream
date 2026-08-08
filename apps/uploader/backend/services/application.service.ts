import { env } from "../config/env.js";
import { downloadExecutor } from "../executors/download/index.js";
import { encodeExecutor } from "../executors/encode/index.js";
import { uploadExecutor } from "../executors/upload/index.js";
import { jobExecutorService } from "../executors/index.js";
import { mediaService } from "../inventory/index.js";
import { logger } from "../logging/index.js";
import { queueWorker } from "../queue/index.js";
import { storageService } from "../storage/index.js";

export class ApplicationService {
    public async startup(): Promise<void> {
        logger.info("========================================");
        logger.info("Link2Stream Uploader");
        logger.info("========================================");

        await storageService.initialize();

        await mediaService.initialize();

        jobExecutorService.register(
            "download",
            downloadExecutor
        );

        jobExecutorService.register(
            "encode",
            encodeExecutor
        );

        jobExecutorService.register(
            "upload",
            uploadExecutor
        );

        queueWorker.start();

        logger.info(
            `Listening on http://localhost:${env.port}`
        );
    }
}

export const applicationService =
    new ApplicationService();

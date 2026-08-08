import { AppError } from "../errors/index.js";
import { jobExecutorService } from "../executors/index.js";
import { jobService } from "../jobs/index.js";
import { logger } from "../logging/index.js";

import { queueService } from "./queue.service.js";

export class QueueWorker {
    private running = false;
    private timer: NodeJS.Timeout | null = null;
    private processing = false;

    public start(): void {
        if (this.running) {
            return;
        }

        this.running = true;

        logger.info("Queue worker started.");

        this.timer = setInterval(() => {
            void this.processNext();
        }, 1000);
    }

    public stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.running = false;

        logger.info("Queue worker stopped.");
    }

    private async processNext(): Promise<void> {
        if (this.processing) {
            return;
        }

        const item = queueService.dequeue();

        if (!item) {
            return;
        }

        this.processing = true;

        try {
            jobService.setStatus(
                item.jobId,
                "running"
            );

            await jobExecutorService.execute(
                item.jobId
            );

            jobService.update(item.jobId, {
                progress: 100
            });

            jobService.setStatus(
                item.jobId,
                "completed"
            );

            logger.info(
                `Completed ${item.jobId}`
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown job execution error";

            const code =
                error instanceof AppError
                    ? error.code
                    : "JOB_EXECUTION_FAILED";

            jobService.update(item.jobId, {
                error: { code, message }
            });

            jobService.setStatus(
                item.jobId,
                "failed"
            );

            logger.error(
                `Failed ${item.jobId}: ${message}`
            );
        } finally {
            this.processing = false;
        }
    }
}

export const queueWorker = new QueueWorker();
import { AppError } from "../errors/index.js";
import type { Job } from "../jobs/index.js";
import { jobService } from "../jobs/index.js";
import { logger } from "../logging/index.js";

import type { JobExecutor } from "./job-executor.types.js";

export class JobExecutorService {
    private readonly executors =
        new Map<Job["type"], JobExecutor>();

    public register(
        type: Job["type"],
        executor: JobExecutor
    ): void {
        this.executors.set(type, executor);
    }

    public async execute(jobId: string): Promise<void> {
        const job = jobService.get(jobId);
        const executor = this.executors.get(job.type);

        if (!executor) {
            throw new AppError(
                `No executor registered for job type: ${job.type}`,
                {
                    statusCode: 500,
                    code: "JOB_EXECUTOR_NOT_FOUND"
                }
            );
        }

        logger.info(
            `Executing ${job.type} job (${job.id})`
        );

        await executor(job);
    }
}

export const jobExecutorService =
    new JobExecutorService();
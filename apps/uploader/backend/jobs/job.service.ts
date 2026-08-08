import { JOB_ID_PREFIX } from "../constants/index.js";
import { AppError } from "../errors/index.js";
import { logger } from "../logging/index.js";
import { queueService } from "../queue/index.js";
import { createId, nowIso } from "../utils/index.js";

import type {
    CreateJobInput,
    Job,
    JobStatus,
    UpdateJobInput
} from "./job.types.js";

export class JobService {
    private readonly jobs = new Map<string, Job>();

    public create(input: CreateJobInput): Job {
        const job: Job = {
            id: createId(JOB_ID_PREFIX),
            type: input.type,
            status: "queued",
            progress: 0,
            currentStep: input.currentStep ?? null,
            createdAt: nowIso(),
            startedAt: null,
            finishedAt: null,
            parentJobId: input.parentJobId ?? null,
            childJobIds: [],
            metadata: input.metadata ?? {},
            error: null
        };

        this.jobs.set(job.id, job);

        queueService.enqueue(job.id);

        logger.info(`Queued ${job.type} job (${job.id})`);

        return job;
    }

    public get(id: string): Job {
        const job = this.jobs.get(id);

        if (!job) {
            throw new AppError("Job not found", {
                statusCode: 404,
                code: "JOB_NOT_FOUND"
            });
        }

        return job;
    }

    public getAll(): Job[] {
        return [...this.jobs.values()];
    }

    public update(id: string, update: UpdateJobInput): Job {
        const job = this.get(id);

        const updated: Job = {
            ...job,
            ...update
        };

        this.jobs.set(id, updated);

        return updated;
    }

    public setStatus(
        id: string,
        status: JobStatus
    ): Job {
        const job = this.get(id);

        const updated: Job = {
            ...job,
            status
        };

        if (status === "running" && !updated.startedAt) {
            updated.startedAt = nowIso();
        }

        if (
            status === "completed" ||
            status === "failed"
        ) {
            updated.finishedAt = nowIso();
        }

        this.jobs.set(id, updated);

        return updated;
    }

    public remove(id: string): boolean {
        return this.jobs.delete(id);
    }

    public clear(): void {
        this.jobs.clear();
    }
}

export const jobService = new JobService();
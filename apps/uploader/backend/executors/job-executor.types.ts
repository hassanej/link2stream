import type { Job } from "../jobs/index.js";

export type JobExecutor = (
    job: Job
) => Promise<void>;
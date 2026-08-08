export type JobType =
    | "download"
    | "metadata"
    | "encode"
    | "preview"
    | "upload"
    | "cleanup";

export type JobStatus =
    | "pending"
    | "queued"
    | "running"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";

export interface JobError {
    code: string;
    message: string;
    details?: unknown;
}

export interface Job {
    id: string;
    type: JobType;
    status: JobStatus;
    progress: number;
    currentStep: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    parentJobId: string | null;
    childJobIds: string[];
    metadata: Record<string, unknown>;
    error: JobError | null;
}

export interface CreateJobInput {
    type: JobType;
    currentStep?: string;
    parentJobId?: string;
    metadata?: Record<string, unknown>;
}

export interface UpdateJobInput {
    status?: JobStatus;
    progress?: number;
    currentStep?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
    childJobIds?: string[];
    metadata?: Record<string, unknown>;
    error?: JobError | null;
}
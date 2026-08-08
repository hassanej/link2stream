export interface QueueItem {
    jobId: string;
    priority: number;
    queuedAt: string;
}

export interface QueueStatistics {
    pending: number;
    running: number;
    completed: number;
    failed: number;
}
import { nowIso } from "../utils/index.js";
import type { QueueItem } from "./queue.types.js";

export class QueueService {
    private readonly items: QueueItem[] = [];

    public enqueue(jobId: string, priority = 0): void {
        this.items.push({
            jobId,
            priority,
            queuedAt: nowIso()
        });

        this.items.sort(
            (a, b) => b.priority - a.priority
        );
    }

    public dequeue(): QueueItem | undefined {
        return this.items.shift();
    }

    public peek(): QueueItem | undefined {
        return this.items[0];
    }

    public getAll(): QueueItem[] {
        return [...this.items];
    }

    public clear(): void {
        this.items.length = 0;
    }

    public size(): number {
        return this.items.length;
    }
}

export const queueService = new QueueService();
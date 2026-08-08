import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";

import { AppError } from "../shared/errors.js";
import { logger } from "../shared/logger.js";
import { deleteFile } from "../shared/fs.js";
import {
    ensureDirectory
} from "../shared/fs.js";
import { config } from "../config.js";

import { encodeFile, outputPathFor } from "./encoder.js";
import { PROFILES } from "./profiles.js";
import { uploadToR2 } from "./r2.js";
import { writeFile, rename, readFile } from "node:fs/promises";

import type { ProfileId } from "./profiles.js";

export type JobStatus =
    | "Queued"
    | "Encoding"
    | "Ready"
    | "Uploading"
    | "Complete"
    | "Failed";

export interface Job {
    id: string;
    inputName: string;
    inputPath: string;
    inputSizeBytes: number;
    profile: ProfileId;
    status: JobStatus;
    encodeProgress: number;
    /** true only after the encode phase fully completed; guards
     *  against reusing a partial output from an interrupted run. */
    encodeComplete: boolean;
    uploadProgress: number;
    outputPath: string | null;
    outputSizeBytes: number | null;
    r2Key: string | null;
    familyLink: string | null;
    error: string | null;
    attempts: number;
    createdAt: string;
    updatedAt: string;
}

const REGISTRY_FILE = path.join(config.outputDir, ".jobs.json");

class JobManager {
    private jobs = new Map<string, Job>();

    private running = false;

    private writeQueue: Promise<void> = Promise.resolve();

    // ------------------------------------------------------------ lifecycle

    public async initialize(): Promise<void> {
        await ensureDirectory(config.inputDir);
        await ensureDirectory(config.outputDir);

        let raw: string | null = null;

        try {
            raw = await readFile(REGISTRY_FILE, "utf8");
        } catch {
            raw = null;
        }

        if (raw === null) {
            return;
        }

        try {
            const stored = JSON.parse(raw) as Job[];

            for (const job of stored) {
                // Interrupted-jobs rule: anything that was in
                // flight when the app last stopped is marked
                // Failed so it can be retried explicitly.
                if (
                    job.status === "Queued" ||
                    job.status === "Encoding" ||
                    job.status === "Uploading"
                ) {
                    job.status = "Failed";
                    job.error =
                        "Interrupted: the app stopped while this job was running.";
                }

                this.jobs.set(job.id, job);
            }

            logger.info(
                `Loaded ${this.jobs.size} job(s) from registry.`
            );
        } catch {
            logger.warn("Job registry corrupt; starting fresh.");
        }
    }

    // ---------------------------------------------------------------- read

    public list(): Job[] {
        return [...this.jobs.values()].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt)
        );
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

    // -------------------------------------------------------------- create

    public enqueue(input: {
        inputName: string;
        inputPath: string;
        inputSizeBytes: number;
        profile: ProfileId;
    }): Job {
        const now = new Date().toISOString();

        const job: Job = {
            id: randomUUID(),
            inputName: input.inputName,
            inputPath: input.inputPath,
            inputSizeBytes: input.inputSizeBytes,
            profile: input.profile,
            status: "Queued",
            encodeProgress: 0,
            encodeComplete: false,
            uploadProgress: 0,
            outputPath: outputPathFor(
                config.outputDir,
                input.inputPath,
                input.profile
            ),
            outputSizeBytes: null,
            r2Key: null,
            familyLink: null,
            error: null,
            attempts: 0,
            createdAt: now,
            updatedAt: now
        };

        this.jobs.set(job.id, job);
        this.persist();
        this.kick();

        return job;
    }

    /**
     * Retry a failed job. If a completed encode exists, the job
     * returns to the review gate (Ready) awaiting upload; otherwise
     * it is re-queued for encoding.
     */
    public async retry(id: string): Promise<Job> {
        const job = this.get(id);

        if (job.status !== "Failed") {
            throw new AppError(
                "Only failed jobs can be retried.",
                {
                    statusCode: 400,
                    code: "JOB_NOT_FAILED"
                }
            );
        }

        job.error = null;
        job.uploadProgress = 0;

        if (job.encodeComplete && (await this.outputExists(job))) {
            job.status = "Ready";
            job.encodeProgress = 100;
            job.outputSizeBytes = (await stat(job.outputPath!)).size;
        } else {
            job.status = "Queued";
            job.encodeProgress = 0;
            job.encodeComplete = false;
            job.outputSizeBytes = null;
            this.kick();
        }

        this.touch(job);

        return job;
    }

    // ------------------------------------------------------------- worker

    private kick(): void {
        if (this.running) {
            return;
        }

        this.running = true;

        void (async () => {
            try {
                while (true) {
                    const next = [...this.jobs.values()]
                        .filter((job) => job.status === "Queued")
                        .sort((a, b) =>
                            a.createdAt.localeCompare(b.createdAt)
                        )[0];

                    if (!next) {
                        break;
                    }

                    await this.process(next);
                }
            } finally {
                this.running = false;
            }
        })();
    }

    /**
     * Encode phase only. On success the job becomes "Ready" and
     * waits for an explicit upload action (review gate).
     */
    private async process(job: Job): Promise<void> {
        job.attempts += 1;

        try {
            // Encode is skipped on retry when a fully completed
            // output from a previous attempt exists.
            const outputReady =
                job.encodeComplete &&
                (await this.outputExists(job));

            if (outputReady) {
                logger.info(
                    `Reusing existing output for ${job.inputName} (retry).`
                );

                // Reuse means: go straight to the review gate.
                job.encodeProgress = 100;
                job.status = "Ready";
                const outputStat = await stat(job.outputPath!);
                job.outputSizeBytes = outputStat.size;
                this.touch(job);
                return;
            }

            job.status = "Encoding";
            this.touch(job);

            await encodeFile({
                inputPath: job.inputPath,
                outputPath: job.outputPath!,
                profile: job.profile,
                onProgress: (percent) => {
                    job.encodeProgress = percent;
                    this.touch(job, true);
                }
            });

            const outputStat = await stat(job.outputPath!);
            job.outputSizeBytes = outputStat.size;
            job.encodeProgress = 100;
            job.encodeComplete = true;
            job.status = "Ready";
            this.touch(job);

            logger.info(
                `Encoded: ${job.inputName} -> ${job.outputPath} (waiting for upload)`
            );
        } catch (error) {
            job.status = "Failed";
            job.error =
                error instanceof Error
                    ? error.message
                    : String(error);
            this.touch(job);

            logger.error(
                `Failed: ${job.inputName}: ${job.error}`
            );
        }
    }

    /**
     * Upload phase (explicit user action). Allowed from "Ready",
     * or from "Failed" when a completed output exists (upload retry).
     */
    public async uploadJob(id: string): Promise<Job> {
        const job = this.get(id);

        const canUpload =
            job.status === "Ready" ||
            (job.status === "Failed" &&
                job.encodeComplete &&
                (await this.outputExists(job)));

        if (!canUpload) {
            throw new AppError(
                `Job is not ready to upload (status: ${job.status}).`,
                {
                    statusCode: 400,
                    code: "JOB_NOT_READY"
                }
            );
        }

        try {
            job.status = "Uploading";
            job.error = null;
            this.touch(job);

            const outputStat = await stat(job.outputPath!);

            const outcome = await uploadToR2({
                filePath: job.outputPath!,
                originalName: `${path.parse(job.inputName).name}${PROFILES[job.profile].suffix}`,
                onProgress: (percent) => {
                    job.uploadProgress = percent;
                    this.touch(job, true);
                }
            });

            // Output may ONLY be removed after the upload was
            // confirmed (HeadObject inside uploadToR2).
            await deleteFile(job.outputPath!);

            job.status = "Complete";
            job.r2Key = outcome.objectKey;
            job.familyLink = outcome.familyLink;
            job.outputSizeBytes = outputStat.size;
            this.touch(job);

            logger.info(
                `Complete: ${job.inputName} -> ${outcome.familyLink}`
            );
        } catch (error) {
            job.status = "Failed";
            job.error =
                error instanceof Error
                    ? error.message
                    : String(error);
            this.touch(job);

            logger.error(
                `Failed: ${job.inputName}: ${job.error}`
            );
        }

        return job;
    }

    /**
     * Remove a job from the registry. Active jobs (currently
     * encoding/uploading) cannot be removed.
     */
    public remove(id: string): void {
        const job = this.get(id);

        if (job.status === "Encoding" || job.status === "Uploading") {
            throw new AppError(
                "Cannot delete a job while it is running.",
                {
                    statusCode: 409,
                    code: "JOB_ACTIVE"
                }
            );
        }

        this.jobs.delete(id);
        this.persist();
    }

    private async outputExists(job: Job): Promise<boolean> {
        try {
            const info = await stat(job.outputPath!);
            return info.size > 0;
        } catch {
            return false;
        }
    }

    // ------------------------------------------------------------ persist

    private touch(job: Job, throttle = false): void {
        job.updatedAt = new Date().toISOString();

        if (!throttle || Math.random() < 0.2) {
            this.persist();
        }
    }

    private persist(): void {
        const snapshot = JSON.stringify(
            [...this.jobs.values()],
            null,
            2
        );

        this.writeQueue = this.writeQueue.then(async () => {
            try {
                const temp = `${REGISTRY_FILE}.tmp`;
                await writeFile(temp, snapshot, "utf8");
                await rename(temp, REGISTRY_FILE);
            } catch (error) {
                logger.error(`Failed to persist jobs: ${String(error)}`);
            }
        });
    }
}

export const jobManager = new JobManager();

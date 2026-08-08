import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";

import { AppError } from "../../../uploader/backend/errors/index.js";
import { logger } from "../../../uploader/backend/logging/index.js";
import { deleteFile } from "../../../uploader/backend/utils/index.js";
import {
    ensureDirectory
} from "../../../uploader/backend/utils/index.js";
import { config } from "../config.js";

import { encodeFile, outputPathFor } from "./encoder.js";
import { PROFILES } from "./profiles.js";
import { uploadToR2 } from "./r2.js";
import { writeFile, rename, readFile } from "node:fs/promises";

import type { ProfileId } from "./profiles.js";

export type JobStatus =
    | "Queued"
    | "Encoding"
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

    public retry(id: string): Job {
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

        job.status = "Queued";
        job.error = null;
        job.encodeProgress = job.encodeComplete ? 100 : 0;
        job.uploadProgress = 0;
        this.touch(job);
        this.kick();

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

    private async process(job: Job): Promise<void> {
        job.attempts += 1;

        try {
            // ---- encode phase (skipped on retry when a fully
            // ---- completed output from a previous attempt exists)
            const outputReady =
                job.encodeComplete &&
                (await this.outputExists(job));

            if (outputReady) {
                logger.info(
                    `Reusing existing output for ${job.inputName} (retry).`
                );
            } else {
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
            }

            const outputStat = await stat(job.outputPath!);
            job.outputSizeBytes = outputStat.size;
            job.encodeProgress = 100;
            job.encodeComplete = true;

            // ---- upload phase
            job.status = "Uploading";
            this.touch(job);

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

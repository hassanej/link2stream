import type { Request, Response } from "express";

import { AppError } from "../errors/index.js";
import { jobService } from "../jobs/index.js";
import { validateCreateJob } from "../validators/index.js";

export class JobsController {
    public async getAll(
        _req: Request,
        res: Response
    ): Promise<void> {
        res.json(jobService.getAll());
    }

    public async getById(
        req: Request,
        res: Response
    ): Promise<void> {
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;

        if (!id) {
            throw new AppError("Missing job id", {
                statusCode: 400,
                code: "MISSING_JOB_ID"
            });
        }

        const job = jobService.get(id);

        if (!job) {
            throw new AppError("Job not found", {
                statusCode: 404,
                code: "JOB_NOT_FOUND"
            });
        }

        res.json(job);
    }

    public async create(
        req: Request,
        res: Response
    ): Promise<void> {
        const input = validateCreateJob(req.body);

        const job = jobService.create(input);

        res.status(201).json(job);
    }
}

export const jobsController = new JobsController();
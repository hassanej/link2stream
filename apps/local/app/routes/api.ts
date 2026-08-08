import { Router } from "express";

import { AppError } from "../../../uploader/backend/errors/index.js";
import { asyncHandler } from "../../../uploader/backend/middleware/index.js";
import { runProcess } from "../../../uploader/backend/process/index.js";
import { config } from "../config.js";
import { jobManager } from "../services/jobs.js";
import { isProfileId, PROFILES } from "../services/profiles.js";
import { resolveInputFile, scanInput } from "../services/scanner.js";

export const apiRouter = Router();

/** Health + environment capabilities (no secrets). */
apiRouter.get(
    "/health",
    asyncHandler(async (_req, res) => {
        const ffmpeg = await runProcess("ffmpeg", ["-version"]);
        const encoders = await runProcess("ffmpeg", [
            "-hide_banner",
            "-encoders"
        ]);

        const ffmpegVersion =
            ffmpeg.exitCode === 0
                ? (ffmpeg.stdout.split("\n")[0] ?? null)
                : null;

        res.json({
            status: "ok",
            ffmpeg: {
                available: ffmpeg.exitCode === 0,
                version: ffmpegVersion,
                videoToolbox:
                    encoders.exitCode === 0 &&
                    encoders.stdout.includes("h264_videotoolbox")
            }
        });
    })
);

/** Non-secret configuration for the UI. */
apiRouter.get("/config", (_req, res) => {
    res.json({
        host: config.host,
        port: config.port,
        familyBaseUrl: config.familyBaseUrl,
        profiles: Object.entries(PROFILES).map(
            ([id, profile]) => ({
                id,
                label: profile.label
            })
        )
    });
});

/** Scan input/. */
apiRouter.get(
    "/files",
    asyncHandler(async (_req, res) => {
        res.json({
            files: await scanInput()
        });
    })
);

/** Create jobs (sequential). */
apiRouter.post(
    "/jobs",
    asyncHandler(async (req, res) => {
        const body = req.body as {
            files?: unknown;
            profile?: unknown;
        };

        if (!isProfileId(body?.profile)) {
            throw new AppError(
                "profile must be one of: smaller-1080p, 720p",
                {
                    statusCode: 400,
                    code: "INVALID_PROFILE"
                }
            );
        }

        if (
            !Array.isArray(body.files) ||
            body.files.length === 0 ||
            body.files.some((f) => typeof f !== "string")
        ) {
            throw new AppError(
                "files must be a non-empty string array",
                {
                    statusCode: 400,
                    code: "INVALID_FILES"
                }
            );
        }

        const available = new Map(
            (await scanInput()).map((file) => [
                file.name,
                file.sizeBytes
            ])
        );

        const jobs = [];

        for (const name of body.files as string[]) {
            const sizeBytes = available.get(name);

            if (sizeBytes === undefined) {
                throw new AppError(
                    `File not found in input/: ${name}`,
                    {
                        statusCode: 404,
                        code: "INPUT_FILE_NOT_FOUND"
                    }
                );
            }

            const inputPath = await resolveInputFile(name);

            jobs.push(
                jobManager.enqueue({
                    inputName: name,
                    inputPath,
                    inputSizeBytes: sizeBytes,
                    profile: body.profile
                })
            );
        }

        res.status(202).json({ jobs });
    })
);

apiRouter.get("/jobs", (_req, res) => {
    res.json({ jobs: jobManager.list() });
});

apiRouter.post(
    "/jobs/:id/retry",
    asyncHandler(async (req, res) => {
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;

        if (!id) {
            throw new AppError("Missing job id", {
                statusCode: 400,
                code: "JOB_ID_MISSING"
            });
        }

        res.json({ job: jobManager.retry(id) });
    })
);

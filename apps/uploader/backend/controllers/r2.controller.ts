import type { Request, Response } from "express";

import { AppError } from "../errors/index.js";
import { r2UsageService } from "../limits/index.js";
import { r2StorageService } from "../services/r2/index.js";

export class R2Controller {
    public async usage(
        _req: Request,
        res: Response
    ): Promise<void> {
        res.json(await r2UsageService.getUsage());
    }

    public async precheck(
        req: Request,
        res: Response
    ): Promise<void> {
        const mediaIds = (req.body as { mediaIds?: unknown })
            ?.mediaIds;

        if (
            !Array.isArray(mediaIds) ||
            mediaIds.some((id) => typeof id !== "string")
        ) {
            throw new AppError(
                "mediaIds (string array) is required",
                {
                    statusCode: 400,
                    code: "PRECHECK_MEDIA_IDS_MISSING"
                }
            );
        }

        res.json(
            await r2UsageService.precheck(
                mediaIds as string[]
            )
        );
    }

    public async deleteFile(
        req: Request,
        res: Response
    ): Promise<void> {
        const rawKey = req.params.key;
        const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

        if (!key) {
            throw new AppError("Missing object key", {
                statusCode: 400,
                code: "R2_KEY_MISSING"
            });
        }

        await r2StorageService.deleteObject(key);

        res.json({ success: true });
    }
}

export const r2Controller = new R2Controller();

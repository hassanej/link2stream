import { Router } from "express";

import { AppError } from "../errors/index.js";
import { mediaService } from "../inventory/index.js";
import { asyncHandler } from "../middleware/index.js";

export const previewRouter = Router();

/**
 * Stream a media file with Range support so the link can be
 * opened directly in VLC / IINA (or a browser).
 */
previewRouter.get(
    "/media/:id/stream",
    asyncHandler(async (req, res) => {
        const rawId = req.params.id;
        const id = Array.isArray(rawId) ? rawId[0] : rawId;

        if (!id) {
            throw new AppError("Missing media id", {
                statusCode: 400,
                code: "MEDIA_ID_MISSING"
            });
        }

        const version =
            typeof req.query.version === "string"
                ? req.query.version
                : "original";

        const item = mediaService.get(id);

        let filePath: string;

        if (version === "original") {
            filePath = item.filePath;
        } else if (
            version === "1080p" ||
            version === "720p"
        ) {
            const variant = item.encoded.find(
                (entry) => entry.target === version
            );

            if (!variant) {
                throw new AppError(
                    `No encoded ${version} version exists.`,
                    {
                        statusCode: 404,
                        code: "ENCODED_VERSION_MISSING"
                    }
                );
            }

            filePath = variant.filePath;
        } else {
            throw new AppError("Unknown version", {
                statusCode: 400,
                code: "VERSION_INVALID"
            });
        }

        // res.sendFile honours Range headers automatically.
        res.sendFile(filePath);
    })
);

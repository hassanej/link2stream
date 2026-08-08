import type { Request, Response } from "express";

import { AppError } from "../errors/index.js";
import { mediaService } from "../inventory/index.js";
import type {
    ChosenVersion,
    MediaItem
} from "../inventory/index.js";
import { jobService } from "../jobs/index.js";
import { namingService } from "../naming/index.js";
import { r2StorageService } from "../services/r2/index.js";
import { deleteFile } from "../utils/index.js";

function requireString(
    value: unknown,
    message: string,
    code: string
): string {
    if (typeof value !== "string" || value.length === 0) {
        throw new AppError(message, {
            statusCode: 400,
            code
        });
    }

    return value;
}

function previewUrl(
    req: Request,
    item: MediaItem,
    version: string
): string {
    return `${req.protocol}://${req.get("host")}/media/${item.id}/stream?version=${version}`;
}

function withComputed(
    req: Request,
    item: MediaItem
): Record<string, unknown> {
    const versions: Record<
        string,
        { sizeBytes: number | null; previewUrl: string }
    > = {
        original: {
            sizeBytes: item.sizeBytes,
            previewUrl: previewUrl(req, item, "original")
        }
    };

    for (const variant of item.encoded) {
        versions[variant.target] = {
            sizeBytes: variant.sizeBytes,
            previewUrl: previewUrl(req, item, variant.target)
        };
    }

    return {
        ...item,
        versions
    };
}

export class MediaController {
    public async list(
        req: Request,
        res: Response
    ): Promise<void> {
        const items = mediaService
            .getAll()
            .map((item) => withComputed(req, item));

        res.json({ items });
    }

    public async download(
        req: Request,
        res: Response
    ): Promise<void> {
        const body = req.body as {
            url?: unknown;
            kind?: unknown;
        };

        const url = requireString(
            body?.url,
            "A download URL is required",
            "DOWNLOAD_URL_REQUIRED"
        );

        if (!/^https?:\/\//.test(url)) {
            throw new AppError(
                "Only http(s) URLs are supported",
                {
                    statusCode: 400,
                    code: "DOWNLOAD_URL_INVALID"
                }
            );
        }

        const kind =
            body?.kind === "series" ? "series" : "movie";

        const job = jobService.create({
            type: "download",
            currentStep: "download",
            metadata: { url, kind }
        });

        res.status(202).json({ job });
    }

    public async rename(
        req: Request,
        res: Response
    ): Promise<void> {
        const id = requireString(
            req.params.id,
            "Missing media id",
            "MEDIA_ID_MISSING"
        );

        const newName = requireString(
            (req.body as { newName?: unknown })?.newName,
            "newName is required",
            "RENAME_NAME_REQUIRED"
        );

        res.json({
            item: await namingService.rename(id, newName)
        });
    }

    public async renameBatch(
        req: Request,
        res: Response
    ): Promise<void> {
        const entries = (req.body as { entries?: unknown })
            ?.entries;

        const items = await namingService.renameBatch(
            entries as never[]
        );

        res.json({ items });
    }

    public async encode(
        req: Request,
        res: Response
    ): Promise<void> {
        const id = requireString(
            req.params.id,
            "Missing media id",
            "MEDIA_ID_MISSING"
        );

        const target = (req.body as { target?: unknown })
            ?.target;

        if (target !== "1080p" && target !== "720p") {
            throw new AppError(
                "target must be 1080p or 720p",
                {
                    statusCode: 400,
                    code: "ENCODE_TARGET_INVALID"
                }
            );
        }

        mediaService.get(id);

        const job = jobService.create({
            type: "encode",
            currentStep: "encode",
            metadata: { mediaId: id, target }
        });

        res.status(202).json({ job });
    }

    public async choose(
        req: Request,
        res: Response
    ): Promise<void> {
        const id = requireString(
            req.params.id,
            "Missing media id",
            "MEDIA_ID_MISSING"
        );

        const version = (req.body as { version?: unknown })
            ?.version;

        if (
            version !== "original" &&
            version !== "1080p" &&
            version !== "720p"
        ) {
            throw new AppError(
                "version must be original, 1080p or 720p",
                {
                    statusCode: 400,
                    code: "VERSION_INVALID"
                }
            );
        }

        const item = mediaService.choose(
            id,
            version as ChosenVersion
        );

        // Discard encoded variants that are not the chosen
        // version (reproducible; the original is never touched).
        for (const variant of item.encoded) {
            if (variant.target === version) {
                continue;
            }

            try {
                await deleteFile(variant.filePath);
            } catch {
                // best-effort cleanup of rejected variants
            }
        }

        const kept =
            version === "original"
                ? []
                : item.encoded.filter(
                      (variant) => variant.target === version
                  );

        const updated = mediaService.update(id, {
            encoded: kept
        });

        res.json({ item: updated });
    }

    public async upload(
        req: Request,
        res: Response
    ): Promise<void> {
        const mediaIds = (req.body as { mediaIds?: unknown })
            ?.mediaIds;

        if (
            !Array.isArray(mediaIds) ||
            mediaIds.length === 0 ||
            mediaIds.some((id) => typeof id !== "string")
        ) {
            throw new AppError(
                "mediaIds (non-empty string array) is required",
                {
                    statusCode: 400,
                    code: "UPLOAD_MEDIA_IDS_MISSING"
                }
            );
        }

        // Validate every item has a chosen version up front.
        for (const mediaId of mediaIds as string[]) {
            mediaService.getUploadSource(mediaId);
        }

        const job = jobService.create({
            type: "upload",
            currentStep: "upload",
            metadata: { mediaIds }
        });

        res.status(202).json({ job });
    }

    /**
     * Post-upload cleanup: keep or delete the VPS copy.
     * Deletion is only possible after the R2 upload is confirmed.
     */
    public async cleanup(
        req: Request,
        res: Response
    ): Promise<void> {
        const id = requireString(
            req.params.id,
            "Missing media id",
            "MEDIA_ID_MISSING"
        );

        const keep = (req.body as { keep?: unknown })?.keep;

        if (typeof keep !== "boolean") {
            throw new AppError(
                "keep (boolean) is required",
                {
                    statusCode: 400,
                    code: "CLEANUP_KEEP_REQUIRED"
                }
            );
        }

        const item = mediaService.get(id);

        await this.assertUploadConfirmed(item);

        if (keep) {
            res.json({ item });
            return;
        }

        for (const filePath of mediaService.getLocalFiles(id)) {
            await deleteFile(filePath);
        }

        res.json({
            item: mediaService.markLocalDeleted(id)
        });
    }

    /**
     * Manual deletion of local files.
     * Refused while a chosen (but not yet uploaded) version exists.
     */
    public async deleteLocal(
        req: Request,
        res: Response
    ): Promise<void> {
        const id = requireString(
            req.params.id,
            "Missing media id",
            "MEDIA_ID_MISSING"
        );

        const item = mediaService.get(id);

        if (item.chosen !== null && item.uploadedAt === null) {
            throw new AppError(
                "A version has been chosen but not uploaded yet; upload it (or unchoose) before deleting local files.",
                {
                    statusCode: 409,
                    code: "MEDIA_DELETE_BLOCKED"
                }
            );
        }

        if (item.uploadedAt !== null) {
            await this.assertUploadConfirmed(item);
        }

        for (const filePath of mediaService.getLocalFiles(id)) {
            await deleteFile(filePath);
        }

        res.json({
            item: mediaService.markLocalDeleted(id)
        });
    }

    private async assertUploadConfirmed(
        item: MediaItem
    ): Promise<void> {
        if (!item.uploadedAt || !item.r2Key) {
            throw new AppError(
                "Local files can only be removed after a confirmed R2 upload.",
                {
                    statusCode: 409,
                    code: "MEDIA_NOT_UPLOADED"
                }
            );
        }

        const exists = await r2StorageService.objectExists(
            item.r2Key
        );

        if (!exists) {
            throw new AppError(
                "R2 object no longer exists; refusing to delete local files.",
                {
                    statusCode: 409,
                    code: "R2_OBJECT_MISSING"
                }
            );
        }
    }
}

export const mediaController = new MediaController();

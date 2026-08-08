import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";

import { loadR2Config } from "../../../uploader/backend/config/r2.js";
import { AppError } from "../../../uploader/backend/errors/index.js";
import { logger } from "../../../uploader/backend/logging/index.js";
import { r2StorageService } from "../../../uploader/backend/services/r2/index.js";
import { config } from "../config.js";

let client: S3Client | null = null;
let bucket: string | null = null;

/**
 * S3 client built with the project's shared R2 configuration
 * (apps/uploader/backend/config/r2.ts) — same env vars,
 * same endpoint convention.
 */
function getClient(): { client: S3Client; bucket: string } {
    if (client && bucket) {
        return { client, bucket };
    }

    let r2Config;

    try {
        r2Config = loadR2Config();
    } catch (error) {
        throw new AppError(
            "R2 is not configured. Copy .env.example to .env and set R2_*.",
            {
                statusCode: 400,
                code: "R2_NOT_CONFIGURED",
                cause: error
            }
        );
    }

    bucket = r2Config.bucket;
    client = new S3Client({
        region: "auto",
        endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: r2Config.accessKeyId,
            secretAccessKey: r2Config.secretAccessKey
        }
    });

    return { client, bucket };
}

/**
 * Object key convention follows apps/worker/src/uploads.ts:
 * `${Date.now()}-${uuid}<ext>` — collision-proof by design;
 * the original name travels in custom metadata.
 */
export function buildObjectKey(inputPath: string): string {
    return `${Date.now()}-${randomUUID()}${path.extname(inputPath)}`;
}

/**
 * Family link convention follows apps/worker/src/files.ts
 * buildFileLink(): <origin>/public/files/<encoded key>.
 * Public, no auth, supports HTTP Range (VLC/browser streaming).
 */
export function buildFamilyLink(objectKey: string): string {
    const encoded = objectKey
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    return `${config.familyBaseUrl}/public/files/${encoded}`;
}

export interface UploadOutcome {
    objectKey: string;
    familyLink: string;
}

/**
 * Upload localPath to R2 with byte-level progress reporting.
 * Metadata follows the worker's upload conventions
 * (contentType, originalName, uploadedBy). The key is checked
 * for existence first (never overwrite an existing object),
 * and the upload is confirmed with HeadObject afterwards.
 */
export async function uploadToR2(input: {
    filePath: string;
    originalName: string;
    onProgress: (percent: number) => void;
}): Promise<UploadOutcome> {
    const { client: s3, bucket: bucketName } = getClient();

    const objectKey = buildObjectKey(input.filePath);

    const keyTaken =
        await r2StorageService.objectExists(objectKey);

    if (keyTaken) {
        throw new AppError(
            `R2 object already exists: ${objectKey}`,
            {
                statusCode: 409,
                code: "R2_KEY_COLLISION"
            }
        );
    }

    const { size } = await stat(input.filePath);

    let uploaded = 0;

    const counter = new Transform({
        transform(chunk, _encoding, callback) {
            uploaded += chunk.length;
            input.onProgress(
                Math.min(
                    99,
                    Math.round((uploaded / size) * 100)
                )
            );
            callback(null, chunk);
        }
    });

    const body = createReadStream(input.filePath).pipe(counter);

    logger.info(
        `Uploading ${input.filePath} -> r2://${bucketName}/${objectKey}`
    );

    try {
        await s3.send(
            new PutObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
                Body: body,
                ContentType: "video/mp4",
                Metadata: {
                    originalName: input.originalName,
                    uploadedBy: "link2stream-local"
                }
            })
        );
    } catch (error) {
        throw new AppError(
            `R2 upload failed for ${objectKey}`,
            {
                statusCode: 500,
                code: "R2_UPLOAD_FAILED",
                cause: error
            }
        );
    }

    const confirmed =
        await r2StorageService.objectExists(objectKey);

    if (!confirmed) {
        throw new AppError(
            `Upload could not be confirmed for ${objectKey}`,
            {
                statusCode: 500,
                code: "R2_UPLOAD_UNCONFIRMED"
            }
        );
    }

    logger.info(`Upload confirmed: ${objectKey}`);

    input.onProgress(100);

    return {
        objectKey,
        familyLink: buildFamilyLink(objectKey)
    };
}

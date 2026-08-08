import {
    DeleteObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client
} from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";

import { AppError } from "../../errors/index.js";
import { logger } from "../../logging/index.js";
import { loadR2Config } from "../../config/r2.js";

export interface UploadResult {
    objectKey: string;
    bucket: string;
    publicUrl: string | undefined;
}

export interface R2ObjectInfo {
    key: string;
    size: number;
    lastModified: string | null;
}

interface R2Context {
    client: S3Client;
    bucket: string;
    publicUrl: string | undefined;
}

export class R2StorageService {
    private context: R2Context | null = null;

    /**
     * Lazily create the S3 client so the app can boot
     * without R2 credentials configured.
     */
    private getContext(): R2Context {
        if (this.context) {
            return this.context;
        }

        let config;

        try {
            config = loadR2Config();
        } catch (error) {
            throw new AppError(
                "R2 is not configured. Set R2_* environment variables.",
                {
                    statusCode: 400,
                    code: "R2_NOT_CONFIGURED",
                    cause: error
                }
            );
        }

        this.context = {
            bucket: config.bucket,
            publicUrl: config.publicUrl,
            client: new S3Client({
                region: "auto",
                endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
                credentials: {
                    accessKeyId: config.accessKeyId,
                    secretAccessKey: config.secretAccessKey
                }
            })
        };

        return this.context;
    }

    public async uploadFile(
        localPath: string,
        objectKey: string
    ): Promise<UploadResult> {
        const { client, bucket, publicUrl } = this.getContext();

        logger.info(
            `Uploading ${localPath} -> r2://${bucket}/${objectKey}`
        );

        const body = createReadStream(localPath);

        try {
            await client.send(
                new PutObjectCommand({
                    Bucket: bucket,
                    Key: objectKey,
                    Body: body
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

        logger.info(`Upload completed: ${objectKey}`);

        return {
            objectKey,
            bucket,
            publicUrl: publicUrl
                ? `${publicUrl}/${objectKey}`
                : undefined
        };
    }

    public async objectExists(
        objectKey: string
    ): Promise<boolean> {
        const { client, bucket } = this.getContext();

        try {
            await client.send(
                new HeadObjectCommand({
                    Bucket: bucket,
                    Key: objectKey
                })
            );

            return true;
        } catch {
            return false;
        }
    }

    public async deleteObject(
        objectKey: string
    ): Promise<void> {
        const { client, bucket } = this.getContext();

        logger.info(`Deleting r2://${bucket}/${objectKey}`);

        try {
            await client.send(
                new DeleteObjectCommand({
                    Bucket: bucket,
                    Key: objectKey
                })
            );
        } catch (error) {
            throw new AppError(
                `R2 delete failed for ${objectKey}`,
                {
                    statusCode: 500,
                    code: "R2_DELETE_FAILED",
                    cause: error
                }
            );
        }
    }

    public async listObjects(): Promise<R2ObjectInfo[]> {
        const { client, bucket } = this.getContext();

        const objects: R2ObjectInfo[] = [];

        let continuationToken: string | undefined;

        do {
            let page;

            try {
                page = await client.send(
                    new ListObjectsV2Command({
                        Bucket: bucket,
                        ContinuationToken: continuationToken
                    })
                );
            } catch (error) {
                throw new AppError(
                    "R2 list objects failed",
                    {
                        statusCode: 500,
                        code: "R2_LIST_FAILED",
                        cause: error
                    }
                );
            }

            for (const entry of page.Contents ?? []) {
                if (typeof entry.Key !== "string") {
                    continue;
                }

                objects.push({
                    key: entry.Key,
                    size: entry.Size ?? 0,
                    lastModified: entry.LastModified
                        ? entry.LastModified.toISOString()
                        : null
                });
            }

            continuationToken =
                page.IsTruncated === true
                    ? page.NextContinuationToken
                    : undefined;
        } while (continuationToken);

        return objects;
    }
}

export const r2StorageService = new R2StorageService();

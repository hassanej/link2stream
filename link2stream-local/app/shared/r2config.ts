import dotenv from "dotenv";

dotenv.config();

export interface R2Config {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl?: string | undefined;
}

function requireEnv(name: string): string {
    const value = process.env[name];

    if (typeof value !== "string" || value.length === 0) {
        throw new Error(
            `Missing required environment variable: ${name}`
        );
    }

    return value;
}

export function loadR2Config(): R2Config {
    return {
        accountId: requireEnv("R2_ACCOUNT_ID"),
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
        // Bucket is fixed for this application.
        bucket: "family-share",
        publicUrl: process.env.R2_PUBLIC_URL || undefined
    };
}

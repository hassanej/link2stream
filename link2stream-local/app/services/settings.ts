import { chmod, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AppError } from "../shared/errors.js";

const LOCAL_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..", // app/services
    ".."  // app -> link2stream-local
);

const ENV_PATH = path.join(LOCAL_ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(LOCAL_ROOT, ".env.example");

/** Bucket is fixed for this application. */
export const R2_BUCKET = "family-share";

export const R2_KEYS = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY"
] as const;

export interface R2SettingsInput {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
}

export interface R2Status {
    configured: boolean;
    bucket: string;
}

export function validateR2Settings(
    input: R2SettingsInput
): R2SettingsInput {
    const cleaned: R2SettingsInput = {
        accountId: input.accountId?.trim() ?? "",
        accessKeyId: input.accessKeyId?.trim() ?? "",
        secretAccessKey: input.secretAccessKey?.trim() ?? ""
    };

    if (
        !cleaned.accountId ||
        !cleaned.accessKeyId ||
        !cleaned.secretAccessKey
    ) {
        throw new AppError(
            "All R2 fields are required (account id, access key id, secret access key).",
            {
                statusCode: 400,
                code: "R2_SETTINGS_INCOMPLETE"
            }
        );
    }

    return cleaned;
}

/**
 * Status only — secrets are never returned to any client.
 */
export function getR2Status(): R2Status {
    const configured = R2_KEYS.every(
        (key) => (process.env[key] ?? "").trim().length > 0
    );

    return {
        configured,
        bucket: R2_BUCKET
    };
}

/**
 * Persist R2 settings: update process.env immediately AND write
 * them into .env (preserving unrelated lines), chmod 600.
 * Secrets are saved server-side only and never logged or returned.
 */
export async function saveR2Settings(
    input: R2SettingsInput
): Promise<void> {
    const values: Record<string, string> = {
        R2_ACCOUNT_ID: input.accountId,
        R2_ACCESS_KEY_ID: input.accessKeyId,
        R2_SECRET_ACCESS_KEY: input.secretAccessKey
    };

    // Runtime first (takes effect immediately).
    for (const [key, value] of Object.entries(values)) {
        process.env[key] = value;
    }

    // Then .env (for future runs).
    let current: string;

    try {
        current = await readFile(ENV_PATH, "utf8");
    } catch {
        current = await readFile(ENV_EXAMPLE_PATH, "utf8").catch(
            () => ""
        );
    }

    const lines = current.split("\n");
    const handled = new Set<string>();

    const updated = lines.map((line) => {
        const match = /^([A-Z0-9_]+)=/.exec(line);

        if (
            match &&
            match[1] !== undefined &&
            match[1] in values
        ) {
            const key = match[1];
            handled.add(key);
            return `${key}=${values[key]}`;
        }

        return line;
    });

    for (const [key, value] of Object.entries(values)) {
        if (!handled.has(key)) {
            updated.push(`${key}=${value}`);
        }
    }

    // Collapse trailing blank lines and keep a single newline.
    const content =
        updated.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "") +
        "\n";

    await writeFile(ENV_PATH, content, "utf8");
    await chmod(ENV_PATH, 0o600);
}

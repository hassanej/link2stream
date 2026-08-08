import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

dotenv.config();

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_ROOT = path.dirname(APP_DIR);

const DEFAULT_FAMILY_BASE_URL =
    "https://link2stream-api.link2stream.workers.dev";

export const config = {
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 3100),
    inputDir: path.resolve(
        LOCAL_ROOT,
        process.env.INPUT_DIR ?? "input"
    ),
    outputDir: path.resolve(
        LOCAL_ROOT,
        process.env.OUTPUT_DIR ?? "output"
    ),
    familyBaseUrl:
        (process.env.L2S_PUBLIC_BASE_URL ?? DEFAULT_FAMILY_BASE_URL).replace(/\/+$/, "")
};

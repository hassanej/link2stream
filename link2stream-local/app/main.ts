import path from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";

import { errorMiddleware } from "./shared/middleware.js";
import { logger } from "./shared/logger.js";
import { config } from "./config.js";
import { apiRouter } from "./routes/api.js";
import { jobManager } from "./services/jobs.js";

const APP_DIR = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(APP_DIR, "public");

async function main() {
    await jobManager.initialize();

    const app = express();

    app.use(express.json());
    app.use(express.static(PUBLIC_DIR));
    app.use("/api", apiRouter);
    app.use(errorMiddleware);

    app.listen(config.port, config.host, () => {
        logger.info("Link2Stream Local");
        logger.info(`Input:  ${config.inputDir}`);
        logger.info(`Output: ${config.outputDir}`);
        logger.info(
            `Listening on http://${config.host}:${config.port}`
        );
    });
}

void main();

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { applicationService } from "./services/index.js";
import { logger } from "./logging/index.js";

export function startServer() {
    const app = createApp();

    app.listen(env.port, async () => {
        try {
            await applicationService.startup();
        } catch (error) {
            logger.error(
                error instanceof Error ? error.message : String(error)
            );

            process.exit(1);
        }
    });
}
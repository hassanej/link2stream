import express from "express";

import { PUBLIC_DIRECTORY } from "./constants/index.js";
import { errorMiddleware } from "./middleware/index.js";
import { router } from "./routes/index.js";

export function createApp() {
    const app = express();

    app.use(express.json());

    app.use(express.static(PUBLIC_DIRECTORY));

    app.get("/api", (_req, res) => {
        res.json({
            application: "Link2Stream Uploader",
            version: "0.1.0",
            status: "running"
        });
    });

    app.use(router);

    app.use(errorMiddleware);

    return app;
}
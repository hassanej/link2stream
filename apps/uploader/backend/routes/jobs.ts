import { Router } from "express";

import { jobsController } from "../controllers/index.js";
import { asyncHandler } from "../middleware/index.js";
import { queueService } from "../queue/index.js";

export const jobsRouter = Router();

jobsRouter.get(
    "/jobs",
    asyncHandler(jobsController.getAll.bind(jobsController))
);

jobsRouter.get(
    "/jobs/:id",
    asyncHandler(jobsController.getById.bind(jobsController))
);

jobsRouter.post(
    "/jobs",
    asyncHandler(jobsController.create.bind(jobsController))
);

jobsRouter.get("/queue", (_req, res) => {
    res.json({
        size: queueService.size(),
        items: queueService.getAll()
    });
});
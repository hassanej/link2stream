import { Router } from "express";

import { healthRouter } from "./health.js";
import { jobsRouter } from "./jobs.js";
import { mediaRouter } from "./media.js";
import { previewRouter } from "./preview.js";
import { r2Router } from "./r2.js";

export const router = Router();

router.use(healthRouter);
router.use(jobsRouter);
router.use(previewRouter);

router.use("/api", mediaRouter);
router.use("/api", r2Router);

import { Router } from "express";

import { r2Controller } from "../controllers/index.js";
import { asyncHandler } from "../middleware/index.js";

export const r2Router = Router();

r2Router.get(
    "/r2/usage",
    asyncHandler(r2Controller.usage.bind(r2Controller))
);

r2Router.post(
    "/r2/precheck",
    asyncHandler(
        r2Controller.precheck.bind(r2Controller)
    )
);

// Express 5: named wildcard captures keys containing slashes
// (e.g. "media/My Movie.720p.mp4").
r2Router.delete(
    "/r2/files/*key",
    asyncHandler(
        r2Controller.deleteFile.bind(r2Controller)
    )
);

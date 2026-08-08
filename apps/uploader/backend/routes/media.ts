import { Router } from "express";

import { mediaController } from "../controllers/index.js";
import { asyncHandler } from "../middleware/index.js";

export const mediaRouter = Router();

mediaRouter.get(
    "/media",
    asyncHandler(mediaController.list.bind(mediaController))
);

mediaRouter.post(
    "/media/download",
    asyncHandler(
        mediaController.download.bind(mediaController)
    )
);

mediaRouter.post(
    "/media/rename",
    asyncHandler(
        mediaController.rename.bind(mediaController)
    )
);

mediaRouter.post(
    "/media/rename-batch",
    asyncHandler(
        mediaController.renameBatch.bind(mediaController)
    )
);

mediaRouter.post(
    "/media/:id/encode",
    asyncHandler(
        mediaController.encode.bind(mediaController)
    )
);

mediaRouter.post(
    "/media/:id/choose",
    asyncHandler(
        mediaController.choose.bind(mediaController)
    )
);

mediaRouter.post(
    "/media/upload",
    asyncHandler(
        mediaController.upload.bind(mediaController)
    )
);

mediaRouter.post(
    "/media/:id/cleanup",
    asyncHandler(
        mediaController.cleanup.bind(mediaController)
    )
);

mediaRouter.delete(
    "/media/:id/local",
    asyncHandler(
        mediaController.deleteLocal.bind(mediaController)
    )
);

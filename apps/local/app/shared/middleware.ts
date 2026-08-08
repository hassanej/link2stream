import type {
    NextFunction,
    Request,
    RequestHandler,
    Response
} from "express";

import { AppError } from "./errors.js";
import { logger } from "./logger.js";

type AsyncHandler = (
    req: Request,
    res: Response,
    next: NextFunction
) => Promise<void>;

export function asyncHandler(
    handler: AsyncHandler
): RequestHandler {
    return (req, res, next) => {
        Promise.resolve(handler(req, res, next))
            .catch(next);
    };
}

export function errorMiddleware(
    error: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    if (error instanceof AppError) {
        logger.warn(
            `[${error.code}] ${error.message}`
        );

        res.status(error.statusCode).json({
            success: false,
            error: {
                code: error.code,
                message: error.message
            }
        });

        return;
    }

    logger.error(
        error instanceof Error
            ? error.stack ?? error.message
            : String(error)
    );

    res.status(500).json({
        success: false,
        error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Internal server error"
        }
    });
}

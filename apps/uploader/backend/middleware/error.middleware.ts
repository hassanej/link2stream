import type {
    NextFunction,
    Request,
    Response
} from "express";

import { AppError } from "../errors/index.js";
import { logger } from "../logging/index.js";

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
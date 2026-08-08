export class AppError extends Error {
    public readonly statusCode: number;

    public readonly code: string;

    public override readonly cause?: unknown;

    constructor(
        message: string,
        options?: {
            statusCode?: number;
            code?: string;
            cause?: unknown;
        }
    ) {
        super(message);

        this.name = "AppError";

        this.statusCode = options?.statusCode ?? 500;
        this.code = options?.code ?? "INTERNAL_ERROR";
        this.cause = options?.cause;

        Error.captureStackTrace?.(this, AppError);
    }
}

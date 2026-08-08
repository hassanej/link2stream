import { AppError } from "../errors/index.js";
import type { CreateJobInput, JobType } from "../jobs/index.js";

const VALID_JOB_TYPES: readonly JobType[] = [
    "download",
    "metadata",
    "encode",
    "preview",
    "upload",
    "cleanup"
];

export function validateCreateJob(
    input: Partial<CreateJobInput>
): CreateJobInput {
    if (!input.type) {
        throw new AppError("Job type is required", {
            statusCode: 400,
            code: "JOB_TYPE_REQUIRED"
        });
    }

    if (!VALID_JOB_TYPES.includes(input.type)) {
        throw new AppError("Invalid job type", {
            statusCode: 400,
            code: "INVALID_JOB_TYPE"
        });
    }

    const result: CreateJobInput = {
        type: input.type
    };

    if (input.currentStep !== undefined) {
        result.currentStep = input.currentStep;
    }

    if (input.parentJobId !== undefined) {
        result.parentJobId = input.parentJobId;
    }

    if (input.metadata !== undefined) {
        result.metadata = input.metadata;
    }

    return result;
}
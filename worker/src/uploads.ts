import type { Env } from "./types";
import { requireUser } from "./auth";
import { error, json } from "./utils";

function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

export async function uploadFile(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  if (!request.body) {
    return error("File is required");
  }

  const encodedName = request.headers.get("x-file-name");

  if (!encodedName) {
    return error("File name is required");
  }

  let originalName: string;

  try {
    originalName = sanitizeFileName(
      decodeURIComponent(encodedName)
    );
  } catch {
    return error("Invalid file name");
  }

  if (!originalName) {
    return error("Invalid file name");
  }

  const contentType =
    request.headers.get("content-type") ||
    "application/octet-stream";

  const key = `${Date.now()}-${crypto.randomUUID()}`;

  await env.BUCKET.put(key, request.body, {
    httpMetadata: {
      contentType,
    },
    customMetadata: {
      originalName,
      uploadedBy: auth.username,
    },
  });

  return json(
    {
      success: true,
      file: {
        key,
        name: originalName,
      },
    },
    201
  );
}

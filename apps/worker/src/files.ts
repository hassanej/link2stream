import type { Env, FileItem } from "./types";
import { requireUser } from "./auth";
import { error, json } from "./utils";

const STORAGE_LIMIT = 10 * 1024 * 1024 * 1024;

function encodeKey(key: string): string {
  return key
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

export async function listFiles(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  const files: FileItem[] = [];
  let usedStorage = 0;
  let cursor: string | undefined;

  do {
    const result = await env.BUCKET.list({
      cursor,
      limit: 1000,
    });

    for (const object of result.objects) {
      usedStorage += object.size;

      files.push({
        key: object.key,
        name: object.customMetadata?.originalName ?? object.key,
        size: object.size,
        uploaded: object.uploaded.toISOString(),
        contentType:
          object.httpMetadata?.contentType ??
          "application/octet-stream",
      });
    }

    cursor = result.truncated
      ? result.cursor
      : undefined;
  } while (cursor);

  files.sort(
    (first, second) =>
      new Date(second.uploaded).getTime() -
      new Date(first.uploaded).getTime()
  );

  return json({
    files,
    usedStorage,
    storageLimit: STORAGE_LIMIT,
  });
}

export async function downloadFile(
  request: Request,
  env: Env,
  key: string
): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  const object = await env.BUCKET.get(key);

  if (!object) {
    return error("File not found", 404);
  }

  const headers = new Headers();

  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set(
    "content-disposition",
    `attachment; filename*=UTF-8''${encodeURIComponent(
      object.customMetadata?.originalName ?? key
    )}`
  );

  return new Response(object.body, {
    headers,
  });
}

export async function streamFile(
  request: Request,
  env: Env,
  key: string
): Promise<Response> {
  const rangeHeader = request.headers.get("range");

  const object = await env.BUCKET.get(
    key,
    rangeHeader
      ? {
          range: request.headers,
        }
      : undefined
  );

  if (!object) {
    return error("File not found", 404);
  }

  const headers = new Headers();

  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set(
    "content-disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(
      object.customMetadata?.originalName ?? key
    )}`
  );

  if (rangeHeader && object.range) {
    const range = object.range;

    if ("offset" in range) {
      const start = range.offset;
      const end =
        start + range.length - 1;

      headers.set(
        "content-range",
        `bytes ${start}-${end}/${object.size}`
      );

      headers.set(
        "content-length",
        String(range.length)
      );
    }
  }

  return new Response(object.body, {
    status: rangeHeader ? 206 : 200,
    headers,
  });
}


export async function deleteFile(
  request: Request,
  env: Env,
  key: string
): Promise<Response> {
  const { requireAdmin } = await import("./auth");

  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const object = await env.BUCKET.head(key);

  if (!object) {
    return error("File not found", 404);
  }

  await env.BUCKET.delete(key);

  return json({
    success: true,
  });
}

export function buildFileLink(
  request: Request,
  key: string
): string {
  const url = new URL(request.url);

  return `${url.origin}/public/files/${encodeKey(key)}`;
}


export async function deleteFiles(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await requireAdmin(request, env);

  if (user instanceof Response) {
    return user;
  }

  const body = await request.json().catch(() => ({}));
  const keys = Array.isArray(body.keys) ? body.keys : [];

  if (!keys.length) {
    return json({ error: "No files selected" }, 400);
  }

  let deleted = 0;

  for (const key of keys) {
    await env.BUCKET.delete(key);
    deleted++;
  }

  return json({
    success: true,
    deleted
  });
}

import { zipSync } from "fflate";

import type { Env } from "./types";
import { requireUser } from "./auth";
import { error } from "./utils";

type ZipRequest = {
  keys?: string[];
};

function safeZipName(name: string): string {
  return name
    .replace(/[/\\]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim() || "file";
}

function uniqueName(
  name: string,
  usedNames: Set<string>
): string {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const dotIndex = name.lastIndexOf(".");
  const base =
    dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const extension =
    dotIndex > 0 ? name.slice(dotIndex) : "";

  let number = 2;
  let candidate = `${base} (${number})${extension}`;

  while (usedNames.has(candidate)) {
    number += 1;
    candidate = `${base} (${number})${extension}`;
  }

  usedNames.add(candidate);
  return candidate;
}

export async function downloadZip(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireUser(request, env);
  if (auth instanceof Response) return auth;

  let body: ZipRequest;

  try {
    body = await request.json();
  } catch {
    return error("Invalid request");
  }

  const keys = Array.from(
    new Set(
      (body.keys ?? []).filter(
        (key): key is string =>
          typeof key === "string" && key.length > 0
      )
    )
  );

  if (keys.length === 0) {
    return error("No files selected");
  }

  const zipFiles: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();

  for (const key of keys) {
    const object = await env.BUCKET.get(key);

    if (!object) {
      return error(`File not found: ${key}`, 404);
    }

    const originalName =
      object.customMetadata?.originalName ?? key;

    const fileName = uniqueName(
      safeZipName(originalName),
      usedNames
    );

    zipFiles[fileName] = new Uint8Array(
      await object.arrayBuffer()
    );
  }

  const archive = zipSync(zipFiles, {
    level: 0,
  });

  return new Response(archive, {
    headers: {
      "content-type": "application/zip",
      "content-disposition":
        'attachment; filename="link2stream-files.zip"',
      "content-length": String(archive.byteLength),
      "cache-control": "no-store",
    },
  });
}

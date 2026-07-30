import type { Env } from "./types";

import {
  handleLogin,
  handleLogout,
  handleSession,
} from "./auth";

import {
  createUser,
  deleteUser,
  listUsers,
  resetPassword,
  updateDisplayName,
} from "./users";

import {
  buildFileLink,
  deleteFile,
  deleteFiles,
  downloadFile,
  listFiles,
  streamFile,
} from "./files";

import { uploadFile } from "./uploads";
import { downloadZip } from "./zip";
import { error, json } from "./utils";

function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);

    return (
      url.hostname === "link2stream.pages.dev" ||
      url.hostname.endsWith(".link2stream.pages.dev") ||
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1"
    );
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers();
  const origin = request.headers.get("origin");

  if (origin && isAllowedOrigin(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "Origin");
  }

  headers.set(
    "access-control-allow-methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  );

  headers.set(
    "access-control-allow-headers",
    "Content-Type, X-File-Name"
  );

  headers.set("access-control-max-age", "86400");

  return headers;
}

function withCors(
  request: Request,
  response: Response
): Response {
  const headers = new Headers(response.headers);

  for (const [key, value] of corsHeaders(request)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function decodeKey(
  pathname: string,
  prefix: string
): string | null {
  const encoded = pathname.slice(prefix.length);

  if (!encoded) {
    return null;
  }

  try {
    return encoded
      .split("/")
      .map(decodeURIComponent)
      .join("/");
  } catch {
    return null;
  }
}

async function route(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (method === "GET" && path === "/") {
    return json({
      name: "Link2Stream API",
      status: "ok",
    });
  }

  if (method === "POST" && path === "/auth/login") {
    return handleLogin(request, env);
  }

  if (method === "POST" && path === "/auth/logout") {
    return handleLogout(request, env);
  }

  if (method === "GET" && path === "/auth/session") {
    return handleSession(request, env);
  }

  if (method === "GET" && path === "/users") {
    return listUsers(request, env);
  }

  if (method === "POST" && path === "/users") {
    return createUser(request, env);
  }

  if (
    method === "PATCH" &&
    path === "/users/display-name"
  ) {
    return updateDisplayName(request, env);
  }

  if (
    method === "PATCH" &&
    path === "/users/password"
  ) {
    return resetPassword(request, env);
  }


  if (
    method === "DELETE" &&
    path === "/users"
  ) {
    return deleteUser(request, env);
  }

  if (method === "GET" && path === "/files") {
    return listFiles(request, env);
  }

  if (method === "PUT" && path === "/uploads") {
    return uploadFile(request, env);
  }

  if (method === "POST" && path === "/zip") {
    return downloadZip(request, env);
  }

  if (
    method === "GET" &&
    path.startsWith("/files/") &&
    path.endsWith("/link")
  ) {
    const keyPath = path.slice(
      0,
      path.length - "/link".length
    );

    const key = decodeKey(keyPath, "/files/");

    if (!key) {
      return error("Invalid file key");
    }

    return json({
      link: buildFileLink(request, key),
    });
  }

  if (
    method === "GET" &&
    path.startsWith("/files/")
  ) {
    const key = decodeKey(path, "/files/");

    if (!key) {
      return error("Invalid file key");
    }

    return downloadFile(request, env, key);
  }

  if (
    method === "DELETE" &&
    path === "/files"
  ) {
    return deleteFiles(request, env);
  }


  if (
    method === "DELETE" &&
    path.startsWith("/files/")
  ) {
    const key = decodeKey(path, "/files/");

    if (!key) {
      return error("Invalid file key");
    }

    return deleteFile(request, env, key);
  }


  if (
    method === "GET" &&
    path.startsWith("/public/files/")
  ) {
    const key = decodeKey(
      path,
      "/public/files/"
    );

    if (!key) {
      return error("Invalid file key");
    }

    return streamFile(request, env, key);
  }

  return error("Not found", 404);
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    try {
      const response = await route(request, env);
      return withCors(request, response);
    } catch (caught) {
      console.error(caught);

      return withCors(
        request,
        error("Internal server error", 500)
      );
    }
  },
};

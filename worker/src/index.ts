export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
}

const SESSION_COOKIE = "link2stream_session";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://link2stream.pages.dev",
]);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin") ?? "";

  if (!ALLOWED_ORIGINS.has(origin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(
  request: Request,
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders(request),
      ...extraHeaders,
    },
  });
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [key, ...valueParts] = cookie.trim().split("=");

    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }

  return null;
}

function sessionCookie(
  request: Request,
  sessionId: string,
  maxAge: number,
): string {
  const isHttps = new URL(request.url).protocol === "https:";

  return [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${maxAge}`,
    isHttps ? "Secure" : "",
    isHttps ? "SameSite=None" : "SameSite=Lax",
  ]
    .filter(Boolean)
    .join("; ");
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Invalid hexadecimal value");
  }

  return new Uint8Array(
    hex.match(/.{2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [],
  );
}

async function hashPassword(password: string, saltHex: string): Promise<string> {
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: hexToBytes(saltHex),
      iterations: 100_000,
    },
    passwordKey,
    256,
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

function createSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

async function getCurrentUser(request: Request, env: Env) {
  const sessionId = getCookie(request, SESSION_COOKIE);

  if (!sessionId) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  const user = await env.DB.prepare(
    `
      SELECT users.id, users.username, users.role
      FROM sessions
      INNER JOIN users ON users.id = sessions.user_id
      WHERE sessions.id = ?
        AND sessions.expires_at > ?
    `,
  )
    .bind(sessionId, now)
    .first<{
      id: number;
      username: string;
      role: "admin" | "family";
    }>();

  return user ?? null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request),
      });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      try {
        await env.DB.prepare("SELECT 1 AS ok").first();

        return json(request, {
          ok: true,
          database: "connected",
        });
      } catch (error) {
        return json(
          request,
          {
            ok: false,
            database: "error",
            message:
              error instanceof Error ? error.message : "Unknown database error",
          },
          500,
        );
      }
    }

    if (request.method === "GET" && url.pathname === "/api/files") {
      const user = await getCurrentUser(request, env);

      if (!user) {
        return json(request, { error: "Unauthorized" }, 401);
      }

      try {
        const files: Array<{
          key: string;
          name: string;
          size: number;
          uploaded: string;
        }> = [];

        let cursor: string | undefined;

        do {
          const result = await env.BUCKET.list({
            cursor,
            limit: 1000,
          });

          for (const object of result.objects) {
            files.push({
              key: object.key,
              name: object.key.split("/").pop() ?? object.key,
              size: object.size,
              uploaded: object.uploaded.toISOString(),
            });
          }

          cursor = result.truncated ? result.cursor : undefined;
        } while (cursor);

        files.sort(
          (left, right) =>
            new Date(right.uploaded).getTime() -
            new Date(left.uploaded).getTime(),
        );

        const totalBytes = files.reduce(
          (total, file) => total + file.size,
          0,
        );

        return json(request, {
          files,
          totalBytes,
          count: files.length,
        });
      } catch (error) {
        return json(
          request,
          {
            error: "Unable to list files",
            message:
              error instanceof Error ? error.message : "Unknown R2 error",
          },
          500,
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/api/login") {
      let body: { username?: string; password?: string };

      try {
        body = await request.json();
      } catch {
        return json(request, { error: "Invalid JSON body" }, 400);
      }

      const username = body.username?.trim().toLowerCase();
      const password = body.password;

      if (!username || !password) {
        return json(request, { error: "Username and password are required" }, 400);
      }

      const user = await env.DB.prepare(
        `
          SELECT id, username, password_hash, password_salt, role
          FROM users
          WHERE username = ?
        `,
      )
        .bind(username)
        .first<{
          id: number;
          username: string;
          password_hash: string;
          password_salt: string;
          role: "admin" | "family";
        }>();

      if (!user) {
        return json(request, { error: "Invalid username or password" }, 401);
      }

      const suppliedHash = await hashPassword(password, user.password_salt);

      if (!constantTimeEqual(suppliedHash, user.password_hash)) {
        return json(request, { error: "Invalid username or password" }, 401);
      }

      const sessionId = createSessionId();
      const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;

      await env.DB.prepare(
        `
          INSERT INTO sessions (id, user_id, expires_at)
          VALUES (?, ?, ?)
        `,
      )
        .bind(sessionId, user.id, expiresAt)
        .run();

      return json(
        request,
        {
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
          },
        },
        200,
        {
          "Set-Cookie": sessionCookie(request, sessionId, SESSION_SECONDS),
        },
      );
    }

    if (request.method === "GET" && url.pathname === "/api/session") {
      const user = await getCurrentUser(request, env);

      if (!user) {
        return json(request, { authenticated: false }, 401);
      }

      return json(request, {
        authenticated: true,
        user,
      });
    }

    if (request.method === "POST" && url.pathname === "/api/logout") {
      const sessionId = getCookie(request, SESSION_COOKIE);

      if (sessionId) {
        await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
          .bind(sessionId)
          .run();
      }

      return json(
        request,
        { ok: true },
        200,
        {
          "Set-Cookie": sessionCookie(request, "", 0),
        },
      );
    }

    return json(request, { error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;

import type {
  Env,
  SessionUser,
  UserRow,
} from "./types";

import {
  clearSessionCookie,
  error,
  getCookie,
  json,
  randomToken,
  sessionCookie,
  verifyPassword,
} from "./utils";

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function getSessionUser(
  request: Request,
  env: Env
): Promise<SessionUser | null> {
  const token = getCookie(request, "session");

  if (!token) {
    return null;
  }

  const row = await env.DB.prepare(
    `
    SELECT
      users.id,
      users.username,
      users.display_name,
      users.role
    FROM sessions
    JOIN users
      ON users.id = sessions.user_id
    WHERE sessions.token = ?
      AND sessions.expires_at > CURRENT_TIMESTAMP
    LIMIT 1
    `
  )
    .bind(token)
    .first<{
      id: number;
      username: string;
      display_name: string;
      role: "admin" | "user";
    }>();

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function requireUser(
  request: Request,
  env: Env
): Promise<SessionUser | Response> {
  const user = await getSessionUser(request, env);

  if (!user) {
    return error("Unauthorized", 401);
  }

  return user;
}

export async function requireAdmin(
  request: Request,
  env: Env
): Promise<SessionUser | Response> {
  const user = await getSessionUser(request, env);

  if (!user) {
    return error("Unauthorized", 401);
  }

  if (user.role !== "admin") {
    return error("Forbidden", 403);
  }

  return user;
}

export async function handleLogin(
  request: Request,
  env: Env
): Promise<Response> {
  let body: {
    username?: string;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return error("Invalid request body");
  }

  const username = body.username
  ?.trim()
  .toLowerCase();
  const password = body.password ?? "";

  if (!username || !password) {
    return error("Username and password are required");
  }

  const user = await env.DB.prepare(
    `
    SELECT *
    FROM users
    WHERE username = ?
    LIMIT 1
    `
  )
    .bind(username)
    .first<UserRow>();

  if (
    !user ||
    !(await verifyPassword(password, user.password_hash))
  ) {
    return error("Invalid username or password", 401);
  }

  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + SESSION_SECONDS * 1000
  ).toISOString();

  await env.DB.prepare(
    `
    INSERT INTO sessions (
      token,
      user_id,
      expires_at
    )
    VALUES (?, ?, ?)
    `
  )
    .bind(token, user.id, expiresAt)
    .run();

  return json(
    {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    },
    200,
    {
      "set-cookie": sessionCookie(
        token,
        SESSION_SECONDS
      ),
    }
  );
}

export async function handleLogout(
  request: Request,
  env: Env
): Promise<Response> {
  const token = getCookie(request, "session");

  if (token) {
    await env.DB.prepare(
      `
      DELETE FROM sessions
      WHERE token = ?
      `
    )
      .bind(token)
      .run();
  }

  return json(
    {
      success: true,
    },
    200,
    {
      "set-cookie": clearSessionCookie(),
    }
  );
}

export async function handleSession(
  request: Request,
  env: Env
): Promise<Response> {
  const user = await getSessionUser(request, env);

  if (!user) {
    return json({
      authenticated: false,
    });
  }

  return json({
    authenticated: true,
    user,
  });
}

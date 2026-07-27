import type { Env, PublicUser, UserRow } from "./types";
import { getSessionUser, requireAdmin } from "./auth";
import { error, hashPassword, json } from "./utils";

function toPublicUser(user: UserRow): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    role: user.role,
  };
}

export async function listUsers(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const rows = await env.DB.prepare(
    `
    SELECT *
    FROM users
    ORDER BY username
    `
  ).all<UserRow>();

  return json({
    users: (rows.results ?? []).map(toPublicUser),
  });
}

export async function createUser(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  let body: {
    username?: string;
    displayName?: string;
    password?: string;
    role?: "admin" | "user";
  };

  try {
    body = await request.json();
  } catch {
    return error("Invalid request");
  }

  const username = body.username?.trim();
  const displayName = body.displayName?.trim();
  const password = body.password ?? "";
  const role = body.role === "admin" ? "admin" : "user";

  if (!username || !displayName || !password) {
    return error("Missing fields");
  }

  const existing = await env.DB.prepare(
    "SELECT id FROM users WHERE username=?"
  )
    .bind(username)
    .first();

  if (existing) {
    return error("Username already exists");
  }

  const hash = await hashPassword(password);

  await env.DB.prepare(
    `
    INSERT INTO users
    (
      username,
      display_name,
      password_hash,
      role
    )
    VALUES (?, ?, ?, ?)
    `
  )
    .bind(
      username,
      displayName,
      hash,
      role
    )
    .run();

  return json({ success: true });
}

export async function updateDisplayName(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  let body: {
    id?: number;
    displayName?: string;
  };

  try {
    body = await request.json();
  } catch {
    return error("Invalid request");
  }

  if (!body.id || !body.displayName?.trim()) {
    return error("Missing fields");
  }

  await env.DB.prepare(
    `
    UPDATE users
    SET
      display_name=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
    `
  )
    .bind(
      body.displayName.trim(),
      body.id
    )
    .run();

  return json({ success: true });
}

export async function resetPassword(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  let body: {
    id?: number;
    password?: string;
  };

  try {
    body = await request.json();
  } catch {
    return error("Invalid request");
  }

  if (!body.id || !body.password) {
    return error("Missing fields");
  }

  const hash = await hashPassword(body.password);

  await env.DB.prepare(
    `
    UPDATE users
    SET
      password_hash=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
    `
  )
    .bind(hash, body.id)
    .run();

  return json({ success: true });
}


export async function deleteUser(
  request: Request,
  env: Env
): Promise<Response> {
  const auth = await requireAdmin(request, env);
  if (auth instanceof Response) return auth;

  const current = await getSessionUser(request, env);

  if (!current) {
    return error("Unauthorized", 401);
  }

  let body: {
    id?: number;
  };

  try {
    body = await request.json();
  } catch {
    return error("Invalid request");
  }

  if (!body.id) {
    return error("Missing user id");
  }

  if (body.id === current.id) {
    return error("You cannot delete your own account");
  }

  const target = await env.DB.prepare(
    "SELECT role FROM users WHERE id=?"
  )
  .bind(body.id)
  .first<{role:string}>();

  if (!target) {
    return error("User not found",404);
  }

  if (target.role === "admin") {

    const admins = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM users WHERE role='admin'"
    ).first<{count:number}>();

    if ((admins?.count ?? 0) <= 1) {
      return error("Cannot delete the last admin");
    }
  }

  await env.DB.prepare(
    "DELETE FROM users WHERE id=?"
  )
  .bind(body.id)
  .run();

  return json({
    success:true
  });
}

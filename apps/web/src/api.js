const API = "/api";

async function request(path, options = {}) {
  const res = await fetch(API + path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
}

export function login(username, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username: username.trim().toLowerCase(),
      password,
    }),
  });
}

export function session() {
  return request("/auth/session");
}

export function logout() {
  return request("/auth/logout", {
    method: "POST",
  });
}

export function listFiles() {
  return request("/files");
}

export function downloadFile(key) {
  window.open(
    `${API}/files/${encodeURIComponent(key)}`,
    "_blank"
  );
}

export async function copyPublicLink(key) {
  const result = await request(
    `/files/${encodeURIComponent(key)}/link`
  );

  await navigator.clipboard.writeText(result.link);

  return result.link;
}

export function deleteFile(key) {
  return request(`/files/${encodeURIComponent(key)}`, {
    method: "DELETE",
  });
}

export function deleteFiles(keys) {
  return request("/files", {
    method: "DELETE",
    body: JSON.stringify({ keys }),
  });
}

export function listUsers() {
  return request("/users");
}

export function createUser({
  username,
  displayName,
  password,
}) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify({
      username,
      displayName,
      password,
      role: "user",
    }),
  });
}

export function updateDisplayName(id, displayName) {
  return request("/users/display-name", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      displayName,
    }),
  });
}

export function resetUserPassword(id, password) {
  return request("/users/password", {
    method: "PATCH",
    body: JSON.stringify({
      id,
      password,
    }),
  });
}

export function deleteUser(id) {
  return request("/users", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });
}

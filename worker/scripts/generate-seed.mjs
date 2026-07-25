import crypto from "node:crypto";

const users = [
  {
    username: "admin",
    password: "admin123",
    role: "admin",
  },
  {
    username: "family",
    password: "family123",
    role: "family",
  },
];

function hashPassword(password, salt) {
  return crypto
    .pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256")
    .toString("hex");
}

function sqlEscape(value) {
  return value.replaceAll("'", "''");
}

console.log("DELETE FROM sessions;");

for (const user of users) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = hashPassword(user.password, salt);

  console.log(`
INSERT INTO users (
  username,
  password_hash,
  password_salt,
  role
)
VALUES (
  '${sqlEscape(user.username)}',
  '${hash}',
  '${salt}',
  '${sqlEscape(user.role)}'
)
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  role = excluded.role;
`);
}

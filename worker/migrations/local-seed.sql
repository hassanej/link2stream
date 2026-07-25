DELETE FROM sessions;

INSERT INTO users (
  username,
  password_hash,
  password_salt,
  role
)
VALUES (
  'admin',
  '096bf1c8b684e6d2d08262eaf4a2924c45b4b4ceca3fb2cd78300759d17d382a',
  'd8f7d8d8bd9e0f11a702314d9a877937',
  'admin'
)
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  role = excluded.role;


INSERT INTO users (
  username,
  password_hash,
  password_salt,
  role
)
VALUES (
  'family',
  '6c13a6fab33069924421f72ccdf09e4a450eb0b689e9bd8748c2342c468ebab3',
  'f201529c2465798feea6419028ff947b',
  'family'
)
ON CONFLICT(username) DO UPDATE SET
  password_hash = excluded.password_hash,
  password_salt = excluded.password_salt,
  role = excluded.role;


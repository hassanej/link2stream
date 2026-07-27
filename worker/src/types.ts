export type UserRole = "admin" | "user";

export type Env = {
  DB: D1Database;
  BUCKET: R2Bucket;
};

export type UserRow = {
  id: number;
  username: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
};

export type SessionUser = PublicUser;

export type SessionRow = {
  token: string;
  user_id: number;
  expires_at: string;
  created_at: string;
};

export type FileItem = {
  key: string;
  name: string;
  size: number;
  uploaded: string;
  contentType: string;
};

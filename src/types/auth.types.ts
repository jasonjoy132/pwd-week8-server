import type { ProfileRow } from "./database.types";

export function profileResponse(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    provider: row.provider,
    userType: row.user_type,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export type AppUser = ReturnType<typeof profileResponse>;
declare global {
  namespace Express {
    interface Request {
      auth?: AppUser;
    }
  }
}

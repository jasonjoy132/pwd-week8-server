import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { profile } from "../controllers/users.controller";
import { createAuthProvidersReader } from "../services/auth-providers.service";
import asyncHandler from "../utils/asyncHandler";

export default function createAuthRouter() {
  const router = Router();
  const readProviders = createAuthProvidersReader();
  // 가입·로그인·갱신·로그아웃·비밀번호 변경은 브라우저 Supabase Auth SDK가 담당합니다.
  router.get(
    "/providers",
    asyncHandler(async (_req, res) => {
      res
        .set("Cache-Control", "no-store")
        .json({ data: await readProviders() });
    }),
  );
  router.get("/me", isAuthenticated, profile);
  return router;
}

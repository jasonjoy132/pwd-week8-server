import type { RequestHandler } from "express";
import { getSupabase, throwDatabaseError } from "../config/supabase";
import { profileResponse } from "../types/auth.types";
import HttpError from "../utils/httpError";
import asyncHandler from "../utils/asyncHandler";

export const isAuthenticated = asyncHandler(async (req, _res, next) => {
  // [이론: HTTP의 무상태성·토큰] 매 요청의 증표를 읽습니다. Bearer 형식만 맞는다고 인증된 것은 아닙니다.
  const match = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new HttpError(401, "로그인이 필요합니다.");
  const db = getSupabase();
  // [이론: JWT 검증] Supabase Auth에 검증을 맡깁니다. 디코딩한 값만으로 신원을 인정하지 않습니다.
  const { data, error } = await db.auth.getUser(match[1]);
  if (error) {
    if (!error.status || error.status >= 500)
      throw new HttpError(503, "인증 서버에 연결할 수 없습니다.");
    throw new HttpError(401, "로그인이 만료되었거나 유효하지 않습니다.");
  }
  if (!data.user) throw new HttpError(401, "로그인이 필요합니다.");
  // [이론: 계정과 사용자 ID] 요청 본문의 ID가 아니라 검증 결과의 UUID로 앱 프로필을 찾습니다.
  const result = await db
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();
  if (result.error) throwDatabaseError(result.error);
  if (!result.data)
    throw new HttpError(
      403,
      "사용자 프로필이 없습니다. Supabase 스키마 설정을 확인하세요.",
    );
  if (!result.data.is_active)
    throw new HttpError(403, "비활성화된 계정입니다.");
  req.auth = profileResponse(result.data);
  next();
});
export const requireAdmin: RequestHandler = (req, _res, next) => {
  // [이론: 식별과 권한] 인증한 사용자가 관리자 작업을 할 수 있는지는 별도로 판단합니다.
  if (req.auth?.userType !== "admin")
    return next(new HttpError(403, "관리자 권한이 필요합니다."));
  next();
};

jest.mock("../src/config/supabase", () => ({
  ...jest.requireActual("../src/config/supabase"),
  getSupabase: jest.fn(),
}));
jest.mock("../src/services/restaurants.service");
jest.mock("../src/services/submissions.service");
jest.mock("../src/services/users.service");
import request from "supertest";
import createApp from "../src/app";
import { getSupabase } from "../src/config/supabase";
import * as restaurants from "../src/services/restaurants.service";
import * as submissions from "../src/services/submissions.service";
import * as users from "../src/services/users.service";
import type { ProfileRow } from "../src/types/database.types";

const profile: ProfileRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.test",
  name: "사용자",
  avatar: "",
  provider: "email",
  user_type: "user",
  is_active: true,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
};
const profileQuery = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
};
const client = {
  auth: { getUser: jest.fn() },
  from: jest.fn(() => profileQuery),
};
const app = createApp();
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getSupabase)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabase>);
  client.auth.getUser.mockResolvedValue({
    data: { user: { id: profile.id } },
    error: null,
  });
  profileQuery.maybeSingle.mockResolvedValue({
    data: { ...profile },
    error: null,
  });
});
const adminRoutes: [string, string][] = [
  ["get", "/api/users/all"],
  ["put", `/api/users/${profile.id}/type`],
  ["post", "/api/restaurants"],
  ["put", "/api/restaurants/1"],
  ["delete", "/api/restaurants/1"],
  ["get", "/api/submissions"],
  ["get", "/api/submissions/1"],
  ["put", "/api/submissions/1"],
  ["post", "/api/submissions/1/approve"],
  ["delete", "/api/submissions/1"],
];
test.each(adminRoutes)("비로그인 %s %s 요청은 401", async (method, url) => {
  const result = await request(app)[method as "get"](url);
  expect(result.status).toBe(401);
  expect(getSupabase).not.toHaveBeenCalled();
});
test.each(adminRoutes)("일반 사용자 %s %s 요청은 403", async (method, url) => {
  const result = await request(app)
    [method as "get"](url)
    .set("Authorization", "Bearer user-token");
  expect(result.status).toBe(403);
});
test.each(adminRoutes)(
  "관리자 %s %s 요청은 컨트롤러로 전달",
  async (method, url) => {
    profileQuery.maybeSingle.mockResolvedValue({
      data: { ...profile, user_type: "admin" },
      error: null,
    });
    const result = await request(app)
      [method as "get"](url)
      .set("Authorization", "Bearer admin-token")
      .send({ status: "rejected", userType: "user" });
    expect([200, 201, 204]).toContain(result.status);
  },
);
test("공개 맛집 조회와 health는 인증을 요구하지 않는다", async () => {
  jest.mocked(restaurants.getAllRestaurants).mockResolvedValue([]);
  expect((await request(app).get("/api/restaurants")).body).toEqual({
    data: [],
  });
  expect((await request(app).get("/health")).body).toEqual({ status: "ok" });
  expect(client.auth.getUser).not.toHaveBeenCalled();
});
// [이론: JWT 검증] 아래 대역은 Auth의 검증 실패를 가정해 HTTP 처리를 확인합니다.
// 실제 JWT의 서명을 변조하거나 만료 시각을 지나서 보내는 실험은 아닙니다.
test("만료·위조 토큰, 비활성 계정, 누락 프로필을 거절한다", async () => {
  client.auth.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: { status: 401 },
  });
  expect(
    (
      await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer invalid")
    ).status,
  ).toBe(401);
  profileQuery.maybeSingle.mockResolvedValueOnce({
    data: { ...profile, is_active: false },
    error: null,
  });
  expect(
    (
      await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer token")
    ).status,
  ).toBe(403);
  profileQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect(
    (
      await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer token")
    ).status,
  ).toBe(403);
});
test("인증 서버 장애는 로그인 오류와 구별한다", async () => {
  client.auth.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: { status: 503 },
  });
  expect(
    (
      await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer token")
    ).status,
  ).toBe(503);
  client.auth.getUser.mockResolvedValueOnce({
    data: { user: null },
    error: { name: "AuthRetryableFetchError", status: 0 },
  });
  expect(
    (
      await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer token")
    ).status,
  ).toBe(503);
});
test("프로필 응답에는 UUID와 camelCase 역할이 있다", async () => {
  const response = await request(app)
    .get("/api/auth/me")
    .set("Authorization", "Bearer token");
  expect(response.body.data.user).toMatchObject({
    id: profile.id,
    userType: "user",
    isActive: true,
  });
  expect(response.body.data.user).not.toHaveProperty("password");
  expect(client.auth.getUser).toHaveBeenCalledWith("token");
});
test("제보·프로필 수정은 검증한 사용자로 서비스를 호출한다", async () => {
  await request(app)
    .post("/api/submissions")
    .set("Authorization", "Bearer token")
    .send({ submitterId: "forged" });
  expect(submissions.createSubmission).toHaveBeenCalledWith(
    { submitterId: "forged" },
    expect.objectContaining({ id: profile.id }),
  );
  await request(app)
    .put("/api/users/profile")
    .set("Authorization", "Bearer token")
    .send({ name: "이름" });
  expect(users.updateProfile).toHaveBeenCalledWith(profile.id, {
    name: "이름",
  });
});
test("CORS는 허용한 클라이언트의 Authorization 사전 요청을 허용한다", async () => {
  const response = await request(app)
    .options("/api/users/all")
    .set("Origin", "http://localhost:5173")
    .set("Access-Control-Request-Method", "GET")
    .set("Access-Control-Request-Headers", "authorization");
  expect(response.status).toBe(204);
  expect(response.headers["access-control-allow-headers"]).toContain(
    "Authorization",
  );
  expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
});
test("로그인은 Auth에 맡기고 등록되지 않은 작업은 404로 응답한다", async () => {
  expect((await request(app).post("/api/auth/login")).status).toBe(404);
  expect((await request(app).post("/api/restaurants/unregistered-action")).status).toBe(
    404,
  );
});

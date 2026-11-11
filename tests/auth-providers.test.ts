import request from "supertest";
import createApp from "../src/app";

const settings = {
  external: { email: true, google: true },
  secret: "must-not-be-exposed",
};
const naver = {
  identifier: "custom:naver",
  provider_type: "oidc",
  issuer: "https://nid.naver.com",
  scopes: ["openid"],
  enabled: true,
  email_optional: true,
  pkce_enabled: true,
  client_id: "private-client-id",
  client_secret: "private-client-secret",
};
let app: ReturnType<typeof createApp>;
let fetchMock: jest.SpiedFunction<typeof fetch>;
const previousUrl = process.env.SUPABASE_URL;
const previousKey = process.env.SUPABASE_SECRET_KEY;

beforeEach(() => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "private-server-key";
  fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input) =>
      Response.json(
        String(input).endsWith("/settings") ? settings : { providers: [naver] },
      ),
    );
  app = createApp();
});
afterEach(() => {
  jest.restoreAllMocks();
  if (previousUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = previousUrl;
  if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = previousKey;
});

test("비로그인 상태에서 세 방식의 사용 가능 여부만 반환한다", async () => {
  const response = await request(app).get("/api/auth/providers");
  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    data: {
      email: { provider: "email", enabled: true },
      google: { provider: "google", enabled: true },
      naver: { provider: "custom:naver", enabled: true },
    },
  });
  expect(response.text).not.toMatch(
    /private|must-not-be-exposed|client_id|client_secret/,
  );
  expect(response.headers["cache-control"]).toBe("no-store");
});

test("미등록 Google·네이버도 목록에서 사라지지 않고 비활성으로 반환한다", async () => {
  fetchMock.mockImplementation(async (input) =>
    Response.json(
      String(input).endsWith("/settings")
        ? { external: { email: true, google: false } }
        : { providers: [] },
    ),
  );
  const response = await request(app).get("/api/auth/providers");
  expect(response.body.data.google.enabled).toBe(false);
  expect(response.body.data.naver).toEqual({
    provider: "custom:naver",
    enabled: false,
  });
});

test.each([
  { issuer: "https://other.example" },
  { provider_type: "oauth2" },
  { pkce_enabled: false },
  { email_optional: false },
  { scopes: [] },
  { enabled: false },
])(
  "네이버 필수 설정이 맞지 않으면 사용 가능으로 표시하지 않는다: %p",
  async (override) => {
    fetchMock.mockImplementation(async (input) =>
      Response.json(
        String(input).endsWith("/settings")
          ? settings
          : { providers: [{ ...naver, ...override }] },
      ),
    );
    expect(
      (await request(app).get("/api/auth/providers")).body.data.naver.enabled,
    ).toBe(false);
  },
);

test("동시·반복 요청은 캐시를 공유하고 만료 후 설정을 다시 조회한다", async () => {
  const clock = jest.spyOn(Date, "now").mockReturnValue(1000);
  await Promise.all(
    Array.from({ length: 5 }, () => request(app).get("/api/auth/providers")),
  );
  expect(fetchMock).toHaveBeenCalledTimes(2);
  clock.mockReturnValue(61_001);
  await request(app).get("/api/auth/providers");
  expect(fetchMock).toHaveBeenCalledTimes(4);
});

test("장애 시 비밀정보 없이 503을 반환하고 다음 요청에서 재시도한다", async () => {
  fetchMock.mockRejectedValueOnce(new Error("private-server-key"));
  const failed = await request(app).get("/api/auth/providers");
  expect(failed.status).toBe(503);
  expect(failed.text).not.toContain("private-server-key");
  expect((await request(app).get("/api/auth/providers")).status).toBe(200);
});

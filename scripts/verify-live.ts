import "dotenv/config";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { AddressInfo } from "node:net";
import createApp from "../src/app";
import { getSupabase, throwDatabaseError } from "../src/config/supabase";

// 실제 연결 검사는 이 실행에서 만든 계정·행만 수정/삭제합니다.
// --keep-fixtures는 브라우저 실습 계정 둘과 대기 제보 하나를 남깁니다.
async function main() {
  const db = getSupabase();
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key)
    throw new Error(
      "실제 인증 검사에는 서버 .env의 SUPABASE_PUBLISHABLE_KEY가 필요합니다.",
    );
  const clientOptions = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  };
  const anonymous = createClient(url, key, clientOptions);
  const adminAuth = createClient(url, key, clientOptions);
  const userAuth = createClient(url, key, clientOptions);
  const run = `week8-${Date.now()}-${randomBytes(3).toString("hex")}`;
  const password = `W8!${randomBytes(18).toString("base64url")}`;
  const emails = {
    admin: `${run}-admin@example.com`,
    user: `${run}-user@example.com`,
  };
  const accountIds: string[] = [];
  const restaurantIds: number[] = [];
  const submissionIds: number[] = [];
  const report: string[] = [];
  let success = false;
  const keep = process.argv.includes("--keep-fixtures");
  if (keep && existsSync(".env.live-test.local"))
    throw new Error(
      "기존 브라우저 테스트 계정 파일이 있습니다. .env.live-test.local을 확인하세요. 기본 test:live는 새 계정을 정리하며 검사할 수 있습니다.",
    );
  const baseline = await db.from("restaurants").select("*").order("id");
  if (baseline.error) throwDatabaseError(baseline.error);
  const initialAdmins = await db
    .from("profiles")
    .select("id")
    .eq("user_type", "admin")
    .eq("is_active", true);
  if (initialAdmins.error) throwDatabaseError(initialAdmins.error);
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function api(
    path: string,
    expected: number,
    token?: string,
    method = "GET",
    body?: unknown,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    assert.equal(response.status, expected, `${method} ${path}: ${text}`);
    return text ? JSON.parse(text) : null;
  }
  try {
    for (const [role, email] of Object.entries(emails)) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name: role === "admin" ? "8주차 실습 관리자" : "8주차 실습 사용자",
          user_type: "admin",
        },
      });
      if (error) throw error;
      accountIds.push(data.user.id);
    }
    const [adminId, userId] = accountIds;
    const profiles = await db.from("profiles").select("*").in("id", accountIds);
    if (profiles.error) throwDatabaseError(profiles.error);
    assert.equal(profiles.data?.length, 2);
    assert.ok(profiles.data?.every((profile) => profile.user_type === "user"));
    const promote = await db.rpc("set_foodmap_user_type", {
      p_user_id: adminId,
      p_user_type: "admin",
    });
    if (promote.error) throwDatabaseError(promote.error);
    const a = await adminAuth.auth.signInWithPassword({
      email: emails.admin,
      password,
    });
    const u = await userAuth.auth.signInWithPassword({
      email: emails.user,
      password,
    });
    if (a.error) throw a.error;
    if (u.error) throw u.error;
    const adminToken = a.data.session.access_token,
      userToken = u.data.session.access_token;
    report.push(
      "실제 Supabase Auth 로그인·프로필 생성·metadata 역할 위조 차단",
    );
    await api("/api/restaurants", 200);
    await api("/api/users/all", 401);
    await api("/api/users/all", 401, "invalid-token");
    await api("/api/users/all", 403, userToken);
    const me = await api("/api/auth/me", 200, userToken);
    assert.equal(me.data.user.id, userId);
    const listed = await api("/api/users/all", 200, adminToken);
    assert.ok(
      listed.data.users.some((entry: { id: string }) => entry.id === userId),
    );
    const denied = await anonymous.from("profiles").select("id");
    assert.ok(
      denied.error,
      "브라우저의 업무 테이블 직접 조회가 차단되어야 합니다.",
    );
    const deniedSignedIn = await userAuth.from("restaurants").select("id");
    assert.ok(
      deniedSignedIn.error,
      "로그인 사용자도 DB에 직접 접근할 수 없어야 합니다.",
    );
    report.push(
      "공개 조회·401/403·관리자 사용자 목록·브라우저 DB 직접 접근 차단",
    );
    const created = await api("/api/restaurants", 201, adminToken, "POST", {
      name: `${run} CRUD`,
      category: "한식",
      location: "검증 캠퍼스",
      recommendedMenu: ["김밥"],
    });
    restaurantIds.push(created.data.id);
    const updated = await api(
      `/api/restaurants/${created.data.id}`,
      200,
      adminToken,
      "PUT",
      { name: `${run} 수정` },
    );
    assert.deepEqual(updated.data.recommendedMenu, ["김밥"]);
    await api(`/api/restaurants/${created.data.id}`, 200);
    await api(`/api/restaurants/${created.data.id}`, 204, adminToken, "DELETE");
    report.push("관리자 맛집 등록·부분 수정·공개 조회·삭제");
    const submission = await api("/api/submissions", 201, userToken, "POST", {
      restaurantName: `${run} 승인`,
      category: "한식",
      location: "검증 캠퍼스",
      submitterEmail: "forged@example.com",
      status: "approved",
    });
    submissionIds.push(submission.data.id);
    assert.equal(submission.data.submitterEmail, emails.user);
    assert.equal(submission.data.status, "pending");
    const approvals = await Promise.all([
      api(
        `/api/submissions/${submission.data.id}/approve`,
        200,
        adminToken,
        "POST",
      ),
      api(
        `/api/submissions/${submission.data.id}/approve`,
        200,
        adminToken,
        "POST",
      ),
    ]);
    assert.equal(approvals[0].data.id, approvals[1].data.id);
    restaurantIds.push(approvals[0].data.id);
    await api(
      `/api/submissions/${submission.data.id}`,
      409,
      adminToken,
      "PUT",
      { status: "rejected" },
    );
    const second = await api("/api/submissions", 201, userToken, "POST", {
      restaurantName: `${run} 거절`,
      category: "한식",
      location: "검증 캠퍼스",
    });
    submissionIds.push(second.data.id);
    await api(`/api/submissions/${second.data.id}`, 200, adminToken, "PUT", {
      status: "rejected",
    });
    await api(
      `/api/submissions/${second.data.id}/approve`,
      409,
      adminToken,
      "POST",
    );
    report.push(
      "제보자 식별·동시 승인 시 맛집 한 건 생성·재승인·거절 상태 검증",
    );
    await api(`/api/users/${userId}/type`, 200, adminToken, "PUT", {
      userType: "admin",
    });
    await api("/api/users/all", 200, userToken);
    await api(`/api/users/${userId}/type`, 200, adminToken, "PUT", {
      userType: "user",
    });
    await api("/api/users/all", 403, userToken);
    const profile = await api("/api/users/profile", 200, userToken, "PUT", {
      name: "검증한 사용자",
      user_type: "admin",
    });
    assert.equal(profile.data.user.userType, "user");
    if (!initialAdmins.data?.length) {
      await api(`/api/users/${adminId}/type`, 409, adminToken, "PUT", {
        userType: "user",
      });
      await api("/api/users/account", 409, adminToken, "DELETE");
      report.push("마지막 관리자 권한 해제·비활성화 차단");
    }
    await api("/api/users/account", 200, userToken, "DELETE");
    await api("/api/auth/me", 403, userToken);
    const reactivate = await db
      .from("profiles")
      .update({ is_active: true })
      .eq("id", userId);
    if (reactivate.error) throwDatabaseError(reactivate.error);
    // [이론: 리프레시 토큰] 새 액세스 토큰 발급과 사용을 확인합니다. 만료 경계 실험은 아닙니다.
    const refreshed = await userAuth.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    await api("/api/auth/me", 200, refreshed.data.session!.access_token);
    // [이론: 로그아웃] 현재 세션의 로그아웃과 SDK 보관값 제거를 확인합니다.
    // 로그아웃 전 복사한 액세스 토큰의 즉시 거절이나 갱신 토큰 재사용 실패는 검사하지 않습니다.
    const logout = await userAuth.auth.signOut({ scope: "local" });
    if (logout.error) throw logout.error;
    assert.equal((await userAuth.auth.getSession()).data.session, null);
    report.push(
      "역할 변경 즉시 반영·프로필 권한 위조 차단·비활성 계정 차단·세션 갱신·로그아웃",
    );
    if (keep) {
      const pending = await api("/api/submissions", 201, adminToken, "POST", {
        restaurantName: "브라우저 승인 확인용 식당",
        category: "한식",
        location: "아주대학교 정문",
        review: "실제 브라우저에서 승인 버튼을 확인하는 테스트 제보입니다.",
      });
      const fixture = {
        run,
        admin: { id: adminId, email: emails.admin, password },
        user: { id: userId, email: emails.user, password },
        pendingSubmissionId: pending.data.id,
      };
      writeFileSync(
        ".env.live-test.local",
        JSON.stringify(fixture, null, 2) + "\n",
        { mode: 0o600 },
      );
      report.push(
        "브라우저용 테스트 계정·대기 제보 보관: .env.live-test.local (Git 제외)",
      );
    }
    success = true;
  } finally {
    // 조회해 둔 기존 행은 수정하지 않았고, 이번 검사에서 생성한 ID만 제거합니다.
    for (const id of restaurantIds) {
      const result = await db.from("restaurants").delete().eq("id", id);
      if (result.error) throwDatabaseError(result.error);
    }
    for (const id of submissionIds) {
      const result = await db.from("submissions").delete().eq("id", id);
      if (result.error) throwDatabaseError(result.error);
    }
    if (!keep || !success) {
      for (const id of accountIds) {
        const result = await db.auth.admin.deleteUser(id);
        if (result.error) throw result.error;
      }
    }
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    const final = await db.from("restaurants").select("*").order("id");
    if (final.error) throwDatabaseError(final.error);
    assert.deepEqual(
      final.data,
      baseline.data,
      "기존 맛집 행은 그대로 보존되어야 합니다.",
    );
  }
  report.push(`기존 맛집 ${baseline.data?.length ?? 0}건 내용 보존 확인`);
  console.log(JSON.stringify({ passed: true, checks: report }, null, 2));
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

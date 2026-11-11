import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { test, before, beforeEach, after } from "node:test";

const schema = readFileSync(
  path.join(__dirname, "../supabase/schema.sql"),
  "utf8",
);
const seed = readFileSync(path.join(__dirname, "../supabase/seed.sql"), "utf8");
const adminId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const authBootstrap = `create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);`;
let db: PGlite;
before(async () => {
  db = new PGlite();
  await db.exec(authBootstrap);
  await db.exec(schema);
});
beforeEach(async () => {
  await db.exec(
    "reset role; drop function if exists public.fail_approval() cascade; truncate auth.users,public.profiles,public.submissions,public.restaurants restart identity cascade;",
  );
  await db.exec(seed);
  await db.query(
    `insert into auth.users values ($1,'admin@example.test','{"name":"관리자","user_type":"admin"}','{"provider":"email"}'),($2,'user@example.test','{"name":"일반 사용자"}','{"provider":"email"}')`,
    [adminId, userId],
  );
  await db.query("update public.profiles set user_type=$1 where id=$2", [
    "admin",
    adminId,
  ]);
});
after(async () => {
  await db?.close();
});

test("빈 DB에 구조와 기본 맛집을 만들고 재실행해도 데이터·프로필을 보존한다", async () => {
  const fresh = new PGlite();
  const id = "55555555-5555-4555-8555-555555555555";
  try {
    // 로컬 검사에만 Supabase Auth의 역할·계정 테이블을 준비합니다.
    // 실제 Supabase 프로젝트에는 이 구조가 이미 제공됩니다.
    await fresh.exec(authBootstrap);
    await fresh.query(
      `insert into auth.users values ($1,'before-schema@example.test','{"name":"등록 사용자","user_type":"admin"}','{"provider":"email"}')`,
      [id],
    );
    await fresh.exec(schema);
    const tables = await fresh.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' order by table_name",
    );
    assert.deepEqual(tables.rows.map((row) => row.table_name), [
      "profiles", "restaurants", "submissions",
    ]);
    const profile = await fresh.query<{ id: string; user_type: string }>(
      "select id,user_type from public.profiles where id=$1", [id],
    );
    assert.equal(profile.rows[0].id, id);
    assert.equal(profile.rows[0].user_type, "user");
    await fresh.exec(seed);
    assert.equal((await fresh.query("select * from public.restaurants")).rows.length, 3);
    await fresh.exec("update public.restaurants set description='다시 실행해도 보존' where id=1");
    await fresh.exec(schema);
    await fresh.exec(seed);
    assert.equal((await fresh.query("select * from public.restaurants")).rows.length, 3);
    assert.equal((await fresh.query<{ description: string }>(
      "select description from public.restaurants where id=1",
    )).rows[0].description, "다시 실행해도 보존");
  } finally {
    await fresh.close();
  }
});

test("이메일·이름이 없는 네이버 OIDC 사용자도 UUID 프로필을 만들고 이름을 보완할 수 있다", async () => {
  const id = "44444444-4444-4444-8444-444444444444";
  await db.query(
    `insert into auth.users values ($1,null,'{}','{"provider":"custom:naver"}')`,
    [id],
  );
  const { rows } = await db.query<{
    id: string;
    email: string;
    name: string;
    provider: string;
    user_type: string;
  }>("select * from public.profiles where id=$1", [id]);
  assert.equal(rows[0].id, id);
  assert.equal(rows[0].email, "");
  assert.equal(rows[0].name, "사용자");
  assert.equal(rows[0].provider, "custom:naver");
  assert.equal(rows[0].user_type, "user");
  await db.query(
    "update public.profiles set name='네이버 실습 사용자' where id=$1",
    [id],
  );
  assert.equal(
    (
      await db.query<{ name: string }>(
        "select name from public.profiles where id=$1",
        [id],
      )
    ).rows[0].name,
    "네이버 실습 사용자",
  );
});
async function createSubmission() {
  const { rows } = await db.query<{ id: number }>(
    `insert into public.submissions(restaurant_name,category,location,submitter_id,submitter_name,submitter_email)
    values ('제보 식당','한식','캠퍼스',$1,'사용자','user@example.test') returning id`,
    [userId],
  );
  return rows[0].id;
}
test("Auth 트리거가 프로필을 생성하며 metadata로 관리자 권한을 얻을 수 없다", async () => {
  const id = "33333333-3333-4333-8333-333333333333";
  await db.query(
    `insert into auth.users values ($1,'injected@example.test','{"name":"관리자","user_type":"admin","userType":"admin"}','{"provider":"email"}')`,
    [id],
  );
  const { rows } = await db.query<{ user_type: string; name: string }>(
    "select * from public.profiles where id=$1",
    [id],
  );
  assert.equal(rows[0].user_type, "user");
  assert.equal(rows[0].name, "관리자");
});
test("스키마·seed 재실행이 기존 맛집과 관리자 역할을 보존한다", async () => {
  await db.query(
    "update public.restaurants set description='보존할 값' where id=1",
  );
  await db.exec(schema);
  await db.exec(seed);
  assert.equal(
    (
      await db.query<{ description: string }>(
        "select description from public.restaurants where id=1",
      )
    ).rows[0].description,
    "보존할 값",
  );
  assert.equal(
    (
      await db.query<{ user_type: string }>(
        "select user_type from public.profiles where id=$1",
        [adminId],
      )
    ).rows[0].user_type,
    "admin",
  );
});
test("서버 역할은 맛집을 수정할 수 있고 브라우저 역할은 테이블·RPC에 접근할 수 없다", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const table of ["restaurants", "profiles", "submissions"])
      await assert.rejects(db.query(`select * from public.${table}`), {
        code: "42501",
      });
    await assert.rejects(
      db.query("select public.set_foodmap_user_type($1,$2)", [userId, "admin"]),
      { code: "42501" },
    );
    await assert.rejects(
      db.query("select public.approve_foodmap_submission(1,$1)", [adminId]),
      { code: "42501" },
    );
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  await db.query("update public.restaurants set name='수정 성공' where id=1");
});
test("승인하면 맛집·제보 상태가 함께 바뀌고 재호출은 같은 맛집을 반환한다", async () => {
  const id = await createSubmission();
  const first = await db.query<{ id: number }>(
    "select * from public.approve_foodmap_submission($1,$2)",
    [id, adminId],
  );
  const second = await db.query<{ id: number }>(
    "select * from public.approve_foodmap_submission($1,$2)",
    [id, adminId],
  );
  assert.equal(first.rows[0].id, second.rows[0].id);
  assert.equal(
    (await db.query("select * from public.restaurants")).rows.length,
    4,
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.submissions where id=$1",
        [id],
      )
    ).rows[0].status,
    "approved",
  );
});
test("일반 사용자를 검토자로 전달하거나 거절된 제보를 승인할 수 없다", async () => {
  const id = await createSubmission();
  await assert.rejects(
    db.query("select * from public.approve_foodmap_submission($1,$2)", [
      id,
      userId,
    ]),
    /REVIEWER_NOT_ADMIN/,
  );
  await db.query(
    "update public.submissions set status='rejected' where id=$1",
    [id],
  );
  await assert.rejects(
    db.query("select * from public.approve_foodmap_submission($1,$2)", [
      id,
      adminId,
    ]),
    /SUBMISSION_NOT_PENDING/,
  );
});
test("승인 상태 저장이 실패하면 생성한 맛집도 롤백된다", async () => {
  const id = await createSubmission();
  await db.exec(`create function public.fail_approval() returns trigger language plpgsql as $$ begin raise exception 'forced failure'; end $$;
    create trigger fail_approval before update on public.submissions for each row execute function public.fail_approval();`);
  await assert.rejects(
    db.query("select * from public.approve_foodmap_submission($1,$2)", [
      id,
      adminId,
    ]),
    /forced failure/,
  );
  assert.equal(
    (await db.query("select * from public.restaurants")).rows.length,
    3,
  );
  assert.equal(
    (
      await db.query<{ status: string }>(
        "select status from public.submissions",
      )
    ).rows[0].status,
    "pending",
  );
});
test("마지막 관리자의 권한 해제·비활성화를 차단하고 다른 관리자가 있으면 변경한다", async () => {
  await assert.rejects(
    db.query("select public.set_foodmap_user_type($1,$2)", [adminId, "user"]),
    /LAST_ADMIN/,
  );
  await assert.rejects(
    db.query("select public.deactivate_foodmap_account($1)", [adminId]),
    /LAST_ADMIN/,
  );
  await db.query("select public.set_foodmap_user_type($1,$2)", [
    userId,
    "admin",
  ]);
  await db.query("select public.set_foodmap_user_type($1,$2)", [
    adminId,
    "user",
  ]);
  await db.query("select public.deactivate_foodmap_account($1)", [adminId]);
  await assert.rejects(
    db.query("select public.set_foodmap_user_type($1,$2)", [adminId, "admin"]),
    /INACTIVE_USER/,
  );
});
test("DB가 ID를 생성하고 잘못된 평점·빈 이름·상태를 거절한다", async () => {
  const { rows } = await db.query<{ id: number }>(
    "insert into public.restaurants(name,category,location) values ('추가 식당','한식','캠퍼스') returning id",
  );
  assert.equal(rows[0].id, 4);
  await assert.rejects(
    db.query("update public.restaurants set rating=6 where id=1"),
    { code: "23514" },
  );
  await assert.rejects(
    db.query("update public.restaurants set name=' ' where id=1"),
    { code: "23514" },
  );
  const id = await createSubmission();
  await assert.rejects(
    db.query("update public.submissions set status='other' where id=$1", [id]),
    { code: "23514" },
  );
});

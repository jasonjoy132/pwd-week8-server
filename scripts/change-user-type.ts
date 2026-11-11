import "dotenv/config";
import { getSupabase, throwDatabaseError } from "../src/config/supabase";

async function main() {
  const [email, role] = process.argv.slice(2);
  if (!email || !["user", "admin"].includes(role))
    throw new Error(
      "사용법: npm run change-user-type -- <이메일> <user|admin>",
    );
  const db = getSupabase();
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .eq("email", email.trim().toLowerCase());
  if (error) throwDatabaseError(error);
  if (!data || data.length !== 1)
    throw new Error(
      "해당 이메일의 프로필 한 개가 필요합니다. 먼저 회원가입하세요.",
    );
  const result = await db.rpc("set_foodmap_user_type", {
    p_user_id: data[0].id,
    p_user_type: role,
  });
  if (result.error) throwDatabaseError(result.error);
  console.log(`사용자 역할을 ${role}(으)로 변경했습니다.`);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

import "dotenv/config";
import { getSupabase, throwDatabaseError } from "../src/config/supabase";

async function main() {
  for (const table of ["restaurants", "profiles", "submissions"] as const) {
    const { error } = await getSupabase().from(table).select("id").limit(1);
    if (error) throwDatabaseError(error);
    console.log(`[Supabase] ${table} 연결 확인 성공`);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

import "dotenv/config";
import { getSupabase } from "../src/config/supabase";

// 개발자 전용 초기 설정입니다. Express 라우트로 노출하지 않습니다.
// .env의 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET은 네이버 앱 발급값입니다.
async function main() {
  const clientId = process.env.NAVER_CLIENT_ID?.trim();
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim();
  if (
    !clientId ||
    !clientSecret ||
    /replace_with|your_client/i.test(clientId + clientSecret)
  ) {
    throw new Error(
      "먼저 네이버 앱의 NAVER_CLIENT_ID와 NAVER_CLIENT_SECRET을 서버 .env에 설정하세요.",
    );
  }
  const api = getSupabase().auth.admin.customProviders;
  const list = await api.listProviders();
  if (list.error) throw list.error;
  const existing = list.data.providers.find(
    (provider) => provider.identifier === "custom:naver",
  );
  if (
    existing &&
    (existing.provider_type !== "oidc" || existing.client_id !== clientId)
  ) {
    throw new Error(
      "custom:naver가 다른 종류 또는 Client ID로 이미 설정되어 있습니다. 기존 사용자 연결을 확인한 뒤 설정하세요.",
    );
  }
  const config = {
    name: "Naver",
    client_id: clientId,
    client_secret: clientSecret,
    issuer: "https://nid.naver.com",
    scopes: ["openid"],
    pkce_enabled: true,
    email_optional: true,
    enabled: true,
  };
  const result = existing
    ? await api.updateProvider("custom:naver", config)
    : await api.createProvider({
        provider_type: "oidc",
        identifier: "custom:naver",
        ...config,
      });
  if (result.error) throw result.error;
  console.log(
    "custom:naver OIDC 공급자 설정 완료. Client Secret은 Supabase Auth에 저장되며 화면에 출력하지 않습니다.",
  );
  console.log(
    "이제 npm run auth:check와 실제 네이버 계정 로그인을 확인하세요.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

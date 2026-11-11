import "dotenv/config";
import { getSupabase } from "../src/config/supabase";

// 읽기 전용입니다. OAuth 앱·공급자를 생성하거나 비밀키를 출력하지 않습니다.
async function main() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key)
    throw new Error("서버의 Supabase URL과 Secret key를 설정하세요.");
  const [settingsResponse, discoveryResponse, providers] = await Promise.all([
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }),
    fetch("https://nid.naver.com/.well-known/openid-configuration"),
    getSupabase().auth.admin.customProviders.listProviders(),
  ]);
  if (!settingsResponse.ok)
    throw new Error(
      `Supabase Auth 설정 조회 실패 (${settingsResponse.status})`,
    );
  if (!discoveryResponse.ok)
    throw new Error(
      `네이버 OIDC 공개 설정 조회 실패 (${discoveryResponse.status})`,
    );
  if (providers.error)
    throw new Error(`Custom Provider 조회 실패: ${providers.error.message}`);
  const settings = await settingsResponse.json();
  const discovery = await discoveryResponse.json();
  const naver = providers.data?.providers.find(
    (provider) => provider.identifier === "custom:naver",
  );
  const checks = {
    emailPasswordEnabled: settings.external?.email === true,
    googleEnabled: settings.external?.google === true,
    naverProviderExists: Boolean(naver),
    naverEnabled: naver?.enabled === true,
    naverUsesOidc: naver?.provider_type === "oidc",
    naverIssuerMatches: naver?.issuer === "https://nid.naver.com",
    naverAllowsMissingEmail: naver?.email_optional === true,
    naverPkceEnabled: naver?.pkce_enabled === true,
    naverRequestsOpenId: naver?.scopes?.includes("openid") === true,
    naverDiscoveryIssuerMatches: discovery.issuer === "https://nid.naver.com",
    naverDiscoverySupportsPkce:
      Array.isArray(discovery.code_challenge_methods_supported) &&
      discovery.code_challenge_methods_supported.includes("S256"),
  };
  console.log(
    JSON.stringify(
      {
        checks,
        providerCallback: `${url}/auth/v1/callback`,
        note: "공급자 설정의 준비 상태입니다. 실제 계정 로그인·동의·콜백·세션·API 권한 검증은 별도로 수행하세요.",
      },
      null,
      2,
    ),
  );
  if (Object.values(checks).some((value) => !value)) process.exitCode = 1;
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

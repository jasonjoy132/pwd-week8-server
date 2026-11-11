import HttpError from "../utils/httpError";

export interface AuthProviders {
  email: { provider: "email"; enabled: boolean };
  google: { provider: "google"; enabled: boolean };
  naver: { provider: "custom:naver"; enabled: boolean };
}

type CustomProviderSettings = {
  identifier?: string;
  provider_type?: string;
  issuer?: string;
  scopes?: string[];
  enabled?: boolean;
  email_optional?: boolean;
  pkce_enabled?: boolean;
};

async function readProviders(): Promise<AuthProviders> {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error("Supabase configuration missing");

  // 응답에는 공급자 사용 가능 여부만 포함합니다. 키·Client ID·내부 설정은 반환하지 않습니다.
  const responses = await Promise.all(
    ["/auth/v1/settings", "/auth/v1/admin/custom-providers"].map((path) =>
      fetch(`${url}${path}`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(5000),
      }),
    ),
  );
  if (responses.some((response) => !response.ok)) {
    throw new Error("Supabase Auth settings request failed");
  }
  const settings = (await responses[0].json()) as {
    external?: Record<string, boolean>;
  };
  const custom = (await responses[1].json()) as {
    providers?: CustomProviderSettings[];
  };
  if (!settings.external || !Array.isArray(custom.providers)) {
    throw new Error("Invalid Supabase Auth settings response");
  }
  const naver = custom.providers.find(
    (provider) => provider.identifier === "custom:naver",
  );
  return {
    email: { provider: "email", enabled: settings.external.email === true },
    google: { provider: "google", enabled: settings.external.google === true },
    naver: {
      provider: "custom:naver",
      enabled:
        naver?.enabled === true &&
        naver.provider_type === "oidc" &&
        naver.issuer === "https://nid.naver.com" &&
        naver.pkce_enabled === true &&
        naver.email_optional === true &&
        naver.scopes?.includes("openid") === true,
    },
  };
}

// 앱별 60초 캐시와 진행 중인 요청 공유로 로그인 화면마다 Admin API를 호출하지 않습니다.
export function createAuthProvidersReader() {
  let cached: { data: AuthProviders; expiresAt: number } | undefined;
  let pending: Promise<AuthProviders> | undefined;
  return async (): Promise<AuthProviders> => {
    if (cached && Date.now() < cached.expiresAt) return cached.data;
    if (pending) return pending;
    pending = readProviders()
      .then((data) => {
        cached = { data, expiresAt: Date.now() + 60_000 };
        return data;
      })
      .catch(() => {
        // 장애를 공급자 비활성 상태로 오인하거나 이전 결과를 계속 제공하지 않습니다.
        throw new HttpError(503, "로그인 서비스 상태를 확인하지 못했습니다.");
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}

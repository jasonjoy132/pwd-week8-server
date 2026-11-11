# 8주차 서버 실습 — Ajou Campus Foodmap API

TypeScript와 Express로 맛집·계정·제보 API를 구현하고 Supabase의 PostgreSQL과 Auth를 연결합니다. 사용자 인증과 관리자 권한을 검사하고, 제보 승인에서 맛집 생성과 상태 변경을 함께 처리합니다. Google·네이버 로그인용 자격 증명을 발급하여 같은 인증 서비스에 연결하고 Render에 배포합니다.

## 프로젝트 소개와 완료 목표

| 기능 | 완료할 동작 |
| --- | --- |
| 맛집 조회 | 공개 목록·상세·인기 목록 |
| 요청 인증 | 매 요청의 Bearer 토큰 검증, 같은 UUID의 앱 프로필 조회 |
| 맛집 관리 | 관리자만 생성·수정·삭제 |
| 계정 관리 | 본인 이름·이미지 수정, 계정 비활성화, 관리자 역할 변경 |
| 제보 | 로그인 사용자와 제보 연결, 관리자 승인·거절·삭제 |
| 승인 처리 | 맛집 생성과 승인 상태 변경을 한 트랜잭션으로 처리 |
| 로그인 연결 | 이메일·Google·네이버가 같은 앱 사용자·권한 API 사용 |
| 배포 | 본인 GitHub 저장소와 Render 서버 |

| 구성 요소 | 담당 |
| --- | --- |
| 브라우저의 Supabase SDK | 가입·로그인 요청, 액세스 토큰 보관·갱신 |
| Supabase Auth | 계정 인증·비밀번호 검증·로그인 세션과 토큰 발급 |
| Express 서버 | 요청 토큰 검증, 프로필·역할 검사, 업무 API 처리 |
| PostgreSQL | 앱 프로필·맛집·제보 저장, 승인 트랜잭션 실행 |

**요청 흐름:** 브라우저의 로그인 → Supabase Auth → 앱용 토큰 발급 → Express 요청의 Authorization 헤더 → Auth 검증 → 프로필·역할 확인 → 업무 처리.

`auth.users`는 Supabase가 관리하는 인증 계정입니다. `public.profiles`는 이 앱에서 쓰는 이름·이메일·역할·활성 상태입니다. 같은 UUID로 연결하므로 이름이 바뀌거나 이메일이 없어도 같은 계정의 데이터로 구분합니다. 비밀번호·해시·솔트는 profiles에 복사하지 않습니다.

## 실습 순서

1. [프로젝트 생성](#1-프로젝트-생성)
2. [개발 환경 설정](#2-개발-환경-설정)
3. [Supabase 프로젝트와 데이터베이스 준비](#3-supabase-프로젝트와-데이터베이스-준비)
4. [요청 인증과 공통 서버 구현](#4-요청-인증과-공통-서버-구현)
5. [맛집 조회와 관리자 쓰기 API](#5-맛집-조회와-관리자-쓰기-api)
6. [계정과 관리자 역할 관리](#6-계정과-관리자-역할-관리)
7. [제보와 승인 트랜잭션](#7-제보와-승인-트랜잭션)
8. [Google·네이버 인증 공급자 연결](#8-google네이버-인증-공급자-연결)
9. [API·업무·SQL 검사](#9-api업무sql-검사)
10. [GitHub·Render 배포와 최종 확인](#10-githubrender-배포와-최종-확인)

## 사전 준비

- Node.js 24.x, npm, Git, VS Code, 브라우저를 준비합니다.
- GitHub·Supabase·Render 계정과 Google·네이버 개발 설정에 사용할 계정을 준비합니다.
- 이메일·Google·네이버 세 로그인 방식을 모두 연결합니다. 로그인 화면은 [클라이언트 실습서](https://github.com/ajou-hyunseok-oh/pwd-week8-client/blob/main/README.md)에서 별도 프로젝트로 작성합니다.

명령과 curl 예시는 Windows Git Bash 또는 macOS·Linux 터미널 기준입니다. VS Code의 **터미널 → 새 터미널**에서 실행합니다.

```bash
node --version
npm --version
git --version
```

Node 출력이 `v24.`로 시작해야 합니다. 서버는 `http://localhost:3000`, React 앱은 `http://127.0.0.1:5173`을 사용합니다. 앱의 로그인 시작과 복귀에서 127.0.0.1과 localhost를 섞지 않습니다. 브라우저의 출처는 프로토콜·호스트·포트의 조합이며 저장소와 인증 복귀 검증값의 기준이 됩니다.

## 1. 프로젝트 생성

### 1-1. 새 프로젝트 폴더 만들기

**목적:** 서버 코드·설정·검사를 저장할 새 프로젝트를 만듭니다. **작업 위치:** 프로젝트를 만들 상위 폴더입니다. 같은 이름의 폴더가 있으면 다른 새 폴더 이름을 사용합니다.

```bash
mkdir pwd-week8-server
cd pwd-week8-server
npm init -y
```

`mkdir`은 폴더 생성, `cd`는 작업 위치 이동, `npm init -y`는 기본 package.json 생성입니다. VS Code의 **파일 → 폴더 열기**로 이 폴더를 엽니다.

**정상 결과:** 탐색기 루트에 package.json이 있습니다. 이후 파일 경로와 명령은 모두 이 프로젝트 루트가 기준입니다.

### 1-2. 폴더 준비

```bash
mkdir -p src/config src/controllers src/middleware src/models
mkdir -p src/routes src/services src/types src/utils
mkdir -p scripts tests supabase
```

| 폴더 | 작성할 내용 |
| --- | --- |
| src/routes·controllers | URL 연결과 HTTP 응답 |
| src/services·models | 업무 처리·DB 요청·응답 변환 |
| src/config·middleware·utils | Supabase 설정·인증·공통 처리 |
| src/types | DB·요청·응답 타입 |
| scripts | 연결 점검·초기 관리자·인증 공급자 설정 명령 |
| tests | API·업무·SQL 자동 검사 |
| supabase | 테이블·함수·권한·초기 데이터 SQL |

## 2. 개발 환경 설정

**목적:** Express·TypeScript 실행 환경과 검사 명령을 설정합니다. 화면이나 외부 계정과 연결하기 전에 패키지 설치부터 마칩니다.


### 2-1. 패키지와 실행 명령 작성


Express는 HTTP 서버, Supabase SDK는 Auth·Data API 요청, dotenv는 .env 로딩을 담당합니다. TypeScript는 타입 검사·빌드, Jest·Supertest는 API 검사, PGlite는 로컬 SQL 검사에 사용합니다.

**파일:** `package.json` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="2" path="package.json" -->
```json
{
  "name": "pwd-week8-server",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "main": "dist/server.js",
  "engines": {
    "node": "24.x"
  },
  "scripts": {
    "dev": "tsx watch server.ts",
    "typecheck": "tsc --noEmit",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "test": "jest --runInBand && npm run test:sql",
    "test:watch": "jest --watch --runInBand",
    "test:sql": "node --import tsx --test tests/schema.postgres.ts",
    "db:check": "tsx scripts/check-db.ts",
    "change-user-type": "tsx scripts/change-user-type.ts",
    "test:live": "tsx scripts/verify-live.ts",
    "auth:check": "tsx scripts/check-auth.ts",
    "auth:setup-naver": "tsx scripts/setup-naver-oidc.ts"
  },
  "dependencies": {
    "cors": "2.8.5",
    "express": "5.1.0",
    "@supabase/supabase-js": "2.118.0",
    "dotenv": "17.2.2"
  },
  "devDependencies": {
    "@types/cors": "2.8.19",
    "@types/express": "5.0.6",
    "@types/jest": "29.5.14",
    "@types/node": "22.20.5",
    "@types/supertest": "6.0.3",
    "jest": "29.7.0",
    "supertest": "7.1.4",
    "ts-jest": "29.4.15",
    "tsx": "4.23.15",
    "typescript": "5.9.3",
    "@electric-sql/pglite": "0.5.14",
    "@types/emscripten": "1.41.6"
  },
  "description": "Foodmap API with Supabase Auth, role checks and transactional submissions"
}
```


파일을 저장한 뒤 설치합니다.

```bash
npm install
npm ls --depth=0
```

**정상 결과:** 패키지 설치가 완료되고 express·typescript·@supabase/supabase-js 등이 목록에 표시됩니다. 생성된 package-lock.json을 함께 보관합니다. 이후 같은 프로젝트를 다시 설치할 때는 `npm ci --include=dev`를 사용합니다.


### 2-2. TypeScript 검사 설정


서버·scripts·tests를 엄격한 타입으로 검사합니다. CommonJS로 실행할 Node 서버의 모듈 방식을 설정합니다.

**파일:** `tsconfig.json` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="2" path="tsconfig.json" -->
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noEmitOnError": true,
    "sourceMap": true,
    "types": [
      "node",
      "jest",
      "emscripten"
    ]
  },
  "include": [
    "server.ts",
    "src/**/*.ts",
    "tests/**/*.ts",
    "scripts/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "coverage"
  ]
}
```


### 2-3. 배포 빌드 설정


실제 서버 실행에 필요한 server.ts와 src만 dist에 컴파일합니다. 검사·설정용 scripts는 배포 서버 시작에 포함하지 않습니다.

**파일:** `tsconfig.build.json` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="2" path="tsconfig.build.json" -->
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["node"]
  },
  "include": ["server.ts", "src/**/*.ts"],
  "exclude": ["node_modules", "dist", "coverage", "tests", "scripts"]
}
```


### 2-4. Jest 검사 설정


tests의 .test.ts 파일을 ts-jest로 검사합니다. SQL 검사는 package.json의 test:sql이 별도로 실행합니다.

**파일:** `jest.config.cjs` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="2" path="jest.config.cjs" -->
```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['node_modules', 'src/data'],
  moduleFileExtensions: ['ts', 'js', 'json'],
};
```


### 2-5. Git 제외 파일 설정


설치 패키지·빌드·실제 키가 든 .env를 저장소에서 제외합니다. 변수 이름만 있는 .env.example은 공유합니다.

**파일:** `.gitignore` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="2" path=".gitignore" -->
```gitignore
node_modules/
dist/
coverage/
*.log
*.tsbuildinfo
.env
.env.*
!.env.example
.vscode/
.idea/
.DS_Store
```


**설정 확인:** 탐색기에 위 설정 파일과 node_modules·package-lock.json이 보여야 합니다. 서버 진입 파일은 4절에서 작성하므로 아직 dev·build를 실행하지 않습니다.

## 3. Supabase 프로젝트와 데이터베이스 준비

**목적:** 새 Supabase 프로젝트에 앱 테이블·함수·권한과 기본 맛집을 준비합니다. SQL 파일을 로컬에 저장한 뒤 대시보드에서 실행해야 원격 DB가 바뀝니다.


### 3-1. Supabase 프로젝트 만들기


1. [Supabase 대시보드](https://supabase.com/dashboard)에 로그인합니다.
2. 사용할 개인 조직을 선택합니다. 조직이 없다면 **New organization**에서 이름을 입력하고 개인 실습에 사용할 요금제를 확인하여 조직을 만듭니다.
3. 조직의 **New project**를 누릅니다. 다음을 입력합니다.

   | 화면 항목 | 입력·선택 |
   | --- | --- |
   | Organization | 방금 선택한 본인 조직 |
   | Project name | `Ajou Foodmap` |
   | Database password | Generate a password로 생성하거나 충분히 긴 새 비밀번호 입력 후 보관 |
   | Region | 본인이 사용할 지역. 한국에서 실습하면 Seoul이 표시될 때 선택 가능 |

4. 화면에서 선택한 요금제와 프로젝트 정보를 확인하고 **Create new project**를 누릅니다.
5. 프로젝트 준비가 끝날 때까지 기다립니다. 프로젝트 홈과 왼쪽 SQL Editor·Table Editor·Authentication 메뉴가 보여야 합니다.

**정상 결과:** 새 Foodmap 프로젝트가 선택되어 있습니다. Database password는 DB 직접 접속용 비밀번호이며 아래에서 사용할 API Secret key와 다릅니다.


### 3-2. URL과 서버용 키 확인


1. 프로젝트 상단 **Connect**를 엽니다. 앱 프레임워크를 선택하는 영역에서 JavaScript 등 사용할 프레임워크를 선택하면 URL과 Publishable key가 표시됩니다. Project URL의 형식은 `https://프로젝트-ref.supabase.co`입니다.
2. 왼쪽 **Settings → API Keys**를 엽니다. Publishable key와 Secret key를 구분합니다. 키가 없다면 해당 구역의 새 키 생성 버튼으로 키를 만듭니다.
3. 서버에 넣을 **Secret key**를 복사합니다. 값은 `sb_secret_`로 시작합니다. 브라우저에는 Publishable key를 사용합니다.
4. 실제 인증 검사에서 사용할 Publishable key도 확인합니다. 두 값을 공개 저장소·스크린샷에 노출하지 않습니다.

| 값 | 저장할 곳 |
| --- | --- |
| Project URL | 서버 SUPABASE_URL, 클라이언트 VITE_SUPABASE_URL |
| Secret key | 서버 .env의 SUPABASE_SECRET_KEY |
| Publishable key | 클라이언트 공개 키, 서버의 선택적 실제 인증 검사 |
| Database password | DB 직접 접속용. 위 API 키 변수에 넣지 않음 |

URL 뒤에 /rest/v1을 붙이지 않습니다. [Supabase API 키 안내](https://supabase.com/docs/guides/getting-started/api-keys)


**두 종류의 역할을 구분합니다.** profiles.user_type의 user/admin은 이 앱에서 사용자가 할 수 있는 작업을 정합니다. anon·authenticated·service_role은 DB에 접근하는 역할입니다. 서버 Secret key의 service_role 접근과 요청한 사용자가 앱 관리자인지는 서로 다른 판단입니다. 서버 키로 DB에 접근하므로 Express가 매 요청의 토큰과 앱 역할을 검사해야 합니다.


### 3-3. 테이블·함수·권한 SQL 작성


profiles는 인증 계정의 앱 정보, submissions는 제보·검토 상태, restaurants는 공개 맛집입니다. 가입 시 Auth 계정의 UUID를 가진 profiles 행을 트리거가 자동 생성합니다. 사용자가 보낸 metadata의 admin 값을 역할로 채택하지 않습니다.

승인은 DB 함수가 맛집 INSERT와 제보 상태 UPDATE를 함께 수행합니다. 중간 오류는 함께 롤백합니다. 같은 제보의 재요청은 연결된 맛집을 반환하고 행 잠금·UNIQUE로 동시 중복 생성을 막습니다. 역할 변경도 검사와 변경을 같은 잠금에서 처리하여 두 관리자가 동시에 서로를 해제해 관리자가 없어지는 상황을 막습니다.

브라우저 DB 역할의 직접 업무 데이터 접근은 막고 서버용 service_role에 필요한 권한을 줍니다. Express가 요청마다 사용자·역할을 확인하는 구조입니다.

**파일:** `supabase/schema.sql` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="3" path="supabase/schema.sql" -->
```sql
-- 새 Supabase 프로젝트에서 앱 테이블·함수·권한을 준비합니다.
begin;
-- [이론: 계정과 사용자 ID] Auth 계정과 앱 프로필은 이름·이메일이 아닌 같은 UUID로 연결합니다.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '', name text not null, avatar text not null default '',
  provider text not null default 'email', user_type text not null default 'user' check (user_type in ('user','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint foodmap_profile_name check (length(btrim(name)) between 1 and 80)
);
create table if not exists public.submissions (
  id bigint generated by default as identity primary key,
  restaurant_name text not null check (length(btrim(restaurant_name)) between 1 and 300),
  category text not null check (length(btrim(category)) between 1 and 300),
  location text not null check (length(btrim(location)) between 1 and 300),
  price_range text not null default '', recommended_menu text[] not null default '{}',
  review text not null default '', submitter_id uuid not null references public.profiles(id),
  submitter_name text not null, submitter_email text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references public.profiles(id), reviewed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- 제보 승인으로 만든 맛집은 source_submission_id로 해당 제보와 연결합니다.
create table if not exists public.restaurants (
  id bigint generated by default as identity primary key,
  name text not null,
  category text not null,
  location text not null,
  price_range text not null default '정보 없음',
  rating numeric not null default 0,
  description text not null default '',
  recommended_menu text[] not null default '{}',
  likes integer not null default 0,
  image text not null default '',
  source_submission_id bigint unique references public.submissions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint foodmap_restaurant_values check (
    length(btrim(name)) between 1 and 300
    and length(btrim(category)) between 1 and 300
    and length(btrim(location)) between 1 and 300
    and rating between 0 and 5 and likes >= 0
  )
);
create index if not exists foodmap_submissions_status_created on public.submissions(status, created_at desc);
create index if not exists foodmap_submissions_submitter on public.submissions(submitter_id);
create index if not exists foodmap_submissions_reviewer on public.submissions(reviewed_by);

create or replace function public.foodmap_touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
drop trigger if exists foodmap_restaurants_updated on public.restaurants;
create trigger foodmap_restaurants_updated before update on public.restaurants for each row execute function public.foodmap_touch_updated_at();
drop trigger if exists foodmap_profiles_updated on public.profiles;
create trigger foodmap_profiles_updated before update on public.profiles for each row execute function public.foodmap_touch_updated_at();
drop trigger if exists foodmap_submissions_updated on public.submissions;
create trigger foodmap_submissions_updated before update on public.submissions for each row execute function public.foodmap_touch_updated_at();

-- [이론: 비밀번호 해시·솔트] 비밀번호의 저장·검증은 Supabase Auth가 담당합니다.
-- Auth가 관리하는 비밀번호 해시·솔트·토큰은 public 테이블로 복사하지 않습니다.
-- 역할은 클라이언트 metadata와 무관하게 반드시 user로 생성합니다.
create or replace function public.foodmap_handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,email,name,avatar,provider)
  values (new.id,coalesce(new.email,''),
    left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'),''),nullif(btrim(new.raw_user_meta_data->>'full_name'),''),'사용자'),80),
    coalesce(new.raw_user_meta_data->>'avatar_url',''),coalesce(new.raw_app_meta_data->>'provider','email'))
  on conflict(id) do nothing;
  return new;
end $$;
drop trigger if exists foodmap_auth_user_created on auth.users;
create trigger foodmap_auth_user_created after insert on auth.users for each row execute function public.foodmap_handle_new_user();
insert into public.profiles(id,email,name,avatar,provider)
select id,coalesce(email,''),left(coalesce(nullif(btrim(raw_user_meta_data->>'name'),''),nullif(btrim(raw_user_meta_data->>'full_name'),''),'사용자'),80),
  coalesce(raw_user_meta_data->>'avatar_url',''),coalesce(raw_app_meta_data->>'provider','email')
from auth.users on conflict(id) do nothing;

-- 역할 변경과 계정 비활성화는 같은 테이블 잠금으로 마지막 관리자 검사를 직렬화합니다.
create or replace function public.set_foodmap_user_type(p_user_id uuid,p_user_type text)
returns setof public.profiles language plpgsql security invoker set search_path='' as $$
declare target public.profiles;
begin
  lock table public.profiles in share row exclusive mode;
  if p_user_type not in ('user','admin') then raise exception 'INVALID_USER_TYPE' using errcode='23514'; end if;
  select * into target from public.profiles where id=p_user_id;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if not target.is_active then raise exception 'INACTIVE_USER'; end if;
  if target.user_type='admin' and p_user_type='user' and (select count(*) from public.profiles where user_type='admin' and is_active)<=1 then
    raise exception 'LAST_ADMIN';
  end if;
  return query update public.profiles set user_type=p_user_type where id=p_user_id returning *;
end $$;
create or replace function public.deactivate_foodmap_account(p_user_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare target public.profiles;
begin
  lock table public.profiles in share row exclusive mode;
  select * into target from public.profiles where id=p_user_id;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  if target.is_active and target.user_type='admin' and (select count(*) from public.profiles where user_type='admin' and is_active)<=1 then
    raise exception 'LAST_ADMIN';
  end if;
  update public.profiles set is_active=false where id=p_user_id;
end $$;

-- 행 잠금·유일성 제약·트랜잭션으로 중복 승인과 중간 실패를 처리합니다.
create or replace function public.approve_foodmap_submission(p_submission_id bigint,p_reviewer_id uuid)
returns setof public.restaurants language plpgsql security invoker set search_path='' as $$
declare target public.submissions;
begin
  if not exists (select 1 from public.profiles where id=p_reviewer_id and is_active and user_type='admin') then
    raise exception 'REVIEWER_NOT_ADMIN' using errcode='42501';
  end if;
  select * into target from public.submissions where id=p_submission_id for update;
  if not found then raise exception 'SUBMISSION_NOT_FOUND'; end if;
  if target.status='approved' then
    return query select * from public.restaurants where source_submission_id=p_submission_id;
    if not found then raise exception 'SUBMISSION_NOT_PENDING'; end if;
    return;
  end if;
  if target.status<>'pending' then raise exception 'SUBMISSION_NOT_PENDING'; end if;
  return query insert into public.restaurants(name,category,location,price_range,description,recommended_menu,source_submission_id)
    values(target.restaurant_name,target.category,target.location,coalesce(nullif(target.price_range,''),'정보 없음'),target.review,target.recommended_menu,target.id)
    returning *;
  update public.submissions set status='approved',reviewed_by=p_reviewer_id,reviewed_at=now() where id=p_submission_id;
end $$;

-- 브라우저는 Auth만 사용하고 업무 데이터는 Express의 서버용 키로 접근합니다.
alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
revoke all on table public.restaurants,public.profiles,public.submissions from anon,authenticated;
grant usage on schema public to service_role;
grant select,insert,update,delete on table public.restaurants,public.profiles,public.submissions to service_role;
grant usage,select,update on sequence public.restaurants_id_seq,public.submissions_id_seq to service_role;
revoke all on function public.foodmap_touch_updated_at(),public.foodmap_handle_new_user(),public.set_foodmap_user_type(uuid,text),public.deactivate_foodmap_account(uuid),public.approve_foodmap_submission(bigint,uuid) from public,anon,authenticated;
grant execute on function public.set_foodmap_user_type(uuid,text),public.deactivate_foodmap_account(uuid),public.approve_foodmap_submission(bigint,uuid) to service_role;
notify pgrst,'reload schema';
commit;
```


VS Code에서 파일 전체를 저장합니다. Supabase **SQL Editor → New query**를 열고 schema.sql 전체 텍스트를 붙여 넣어 **Run**을 누릅니다. 성공 메시지 후 Table Editor에서 profiles·submissions·restaurants를 확인합니다.

오류가 나면 메시지의 테이블·함수·열 이름을 확인합니다. 실패한 트랜잭션이 유지되면 `rollback;`을 실행한 뒤 파일 전체를 다시 실행합니다. 본문의 함수 BEGIN/END는 함수 본문이며 바깥 begin/commit은 전체 SQL 변경의 트랜잭션입니다. [Auth 사용자와 앱 프로필](https://supabase.com/docs/guides/auth/managing-user-data)


### 3-4. 기본 맛집 데이터 작성


빈 restaurants에만 맛집 3행을 넣습니다. seed 재실행이 작성한 맛집을 덮어쓰거나 관리 계정을 바꾸지 않도록 합니다.

**파일:** `supabase/seed.sql` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="3" path="supabase/seed.sql" -->
```sql
-- 새 프로젝트의 빈 restaurants에만 입력합니다. 기존 행을 덮어쓰지 않습니다.
begin;
lock table public.restaurants in exclusive mode;
do $$ begin
if not exists(select 1 from public.restaurants) then
insert into public.restaurants(id,name,category,location,price_range,rating,description,recommended_menu,likes,image) values
(1,'송림식당','한식','경기 수원시 영통구 월드컵로193번길 21 원천동','7,000-13,000원',4.99,'최고의 한식 맛집입니다.',array['순두부','김치찌개','소불고기','제육볶음']::text[],0,'https://mblogthumb-phinf.pstatic.net/MjAyMjA2MTJfODEg/MDAxNjU0OTYzNTM3MjE1.1BfmrmOsz_B6DBHAnhQSs6qfNIDnssofR-DrzMfigIIg.JHHDheG6ifJjtfKUqLss_mLXWFE9fNJ5BmepNUVXSOog.PNG.cary63/image.png?type=w966'),
(2,'별미떡볶이','분식','경기 수원시 영통구 아주로 42 아카데미빌딩','7,000-10,000원',4.92,'바삭한 튀김과 함께하는 행복한 한입',array['떡볶이','튀김','순대','어묵']::text[],0,'https://search.pstatic.net/common/?src=http%3A%2F%2Fblogfiles.naver.net%2FMjAyNTA4MTJfMjcg%2FMDAxNzU0OTQ5ODk1Mjg0.GR6i3mNpJJXyqQrozGEJ65InCDBGlEmxc0aCeVHncJgg.sduDPX67J8hhoGxq4vLohpS4dXk1w-706dQLPfVs1iwg.JPEG%2Foutput%25A3%25DF1564208956.jpg'),
(3,'SOGO','일식','경기 수원시 영통구 월드컵로193번길 7','10,000-16,000원',4.89,'일식 맛집, 구 허수아비,',array['냉모밀','김치돈까스나베','코돈부르']::text[],0,'https://search.pstatic.net/common/?src=https%3A%2F%2Fldb-phinf.pstatic.net%2F20190707_63%2F1562462598960nPDMy_JPEG%2FW7iKQEhTMzCF3flC1t0pzgzF.jpeg.jpg');
perform pg_catalog.setval(pg_catalog.pg_get_serial_sequence('public.restaurants','id'),(select max(id) from public.restaurants),true);
end if;
end $$;
commit;
```


SQL Editor의 새 쿼리에서 seed.sql 전체를 실행합니다. 다음 SELECT로 확인합니다.

```sql
select id,name,category,rating from public.restaurants order by id;
select id,email,name,user_type,is_active from public.profiles;
```

**정상 결과:** restaurants에는 송림식당·별미떡볶이·SOGO 3행이 있습니다. 가입 전 profiles가 0행인 것은 정상입니다.


### 3-5. 환경변수 예시 작성


공유할 변수 이름과 예시 값만 기록합니다. 실제 프로젝트 키는 다음 실제 .env 파일에 넣습니다.

**파일:** `.env.example` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="3" path=".env.example" -->
```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_replace_with_your_real_key
CLIENT_URL=http://localhost:5173,http://127.0.0.1:5173
# 실제 Auth 통합 검사용 공개 키 (선택)
SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_with_your_key
# 네이버 OIDC 공급자를 등록하는 초기 설정 명령에서만 사용합니다.
# 일반 Express 요청 처리에는 필요하지 않습니다. VITE_*에 넣지 않습니다.
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```


프로젝트 루트에 **.env**를 새로 만들고 본인 값으로 작성합니다. 아래 예시 문자열을 실제 키로 사용하지 않습니다.

```dotenv
PORT=3000
NODE_ENV=development
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SECRET_KEY=sb_secret_replace_with_your_real_key
CLIENT_URL=http://127.0.0.1:5173
SUPABASE_PUBLISHABLE_KEY=sb_publishable_replace_with_your_key
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
```

NAVER 두 값은 8절 발급 후 입력합니다. SUPABASE_PUBLISHABLE_KEY는 9절의 선택적 실제 인증 검사에만 사용합니다. 키 값은 전체 문자열을 복사하고 앞뒤 공백이나 따옴표를 추가하지 않습니다.

**작업 확인:** git status에 .env가 추적 대상으로 나오지 않아야 합니다. .env.example에는 실제 키가 없어야 합니다.


### 3-6. 이메일 인증과 앱 복귀 주소 설정


1. Supabase **Authentication → Sign In / Providers**에서 Email을 열고 이메일 로그인·신규 가입을 활성화합니다.
2. 개인 실습 프로젝트에서는 **Confirm email**을 끄고 저장하여 가입 즉시 로그인할 수 있게 합니다. 메일 인증을 사용할 경우에는 Custom SMTP 또는 허용된 수신 주소를 먼저 준비합니다. [이메일 로그인](https://supabase.com/docs/guides/auth/passwords), [SMTP 조건](https://supabase.com/docs/guides/auth/auth-smtp)
3. **Authentication → URL Configuration**에서 Site URL에 `http://127.0.0.1:5173`을 입력합니다.
4. Redirect URLs에 `http://127.0.0.1:5173/auth/callback`을 추가하고 저장합니다.

이 주소는 Supabase가 인증 후 React 앱으로 돌려보내는 주소입니다. Google·네이버 콘솔에 입력할 공급자 콜백은 8절에서 별도로 확인합니다.

## 4. 요청 인증과 공통 서버 구현

**목적:** 서버를 실행하고 요청한 사용자를 확인할 공통 처리를 만듭니다. 아직 업무 라우트는 연결하지 않고 /health와 /api/auth/me부터 확인합니다.


### 4-1. HTTP 오류 타입 작성


오류에 HTTP 상태 코드를 연결합니다. 인증 실패·권한 거절·입력 오류를 공통 오류 처리기가 구분하게 합니다.

**파일:** `src/utils/httpError.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/utils/httpError.ts" -->
```ts
export default class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
  }
}
```


### 4-2. 비동기 오류 전달 함수 작성


비동기 함수의 실패를 Express의 next에 전달합니다. 컨트롤러와 인증 미들웨어에서 같은 오류 처리를 재사용합니다.

**파일:** `src/utils/asyncHandler.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/utils/asyncHandler.ts" -->
```ts
import type { NextFunction, Request, RequestHandler, Response } from "express";

export default function asyncHandler<
  Params = Record<string, string>,
  ResponseBody = unknown,
  RequestBody = unknown,
  Query = Request["query"],
>(
  handler: (
    req: Request<Params, ResponseBody, RequestBody, Query>,
    res: Response<ResponseBody>,
    next: NextFunction,
  ) => Promise<void>,
): RequestHandler<Params, ResponseBody, RequestBody, Query> {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}
```


### 4-3. 실제 입력 검증 함수 작성


TypeScript 타입은 실제 HTTP JSON을 검사하지 않습니다. unknown 입력을 받아 본문·필수 문자열·메뉴·숫자 ID·UUID의 형식을 실행 중 확인합니다. 업무 서비스가 이 함수를 호출합니다.

**파일:** `src/utils/input.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/utils/input.ts" -->
```ts
import HttpError from "./httpError";

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new HttpError(400, "JSON 객체를 입력하세요.");
  return value as Record<string, unknown>;
}
export function textField(
  value: unknown,
  field: string,
  required = false,
  max = 2000,
): string {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `'${field}' is required`);
    return "";
  }
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  ) {
    throw new HttpError(400, `'${field}' 값이 올바르지 않습니다.`);
  }
  return value.trim();
}
export function menuField(value: unknown): string[] {
  if (value === undefined || value === null || value === "") return [];
  const menu: unknown =
    typeof value === "string" ? value.split(/[,\n]/) : value;
  if (
    !Array.isArray(menu) ||
    menu.length > 30 ||
    menu.some((item) => typeof item !== "string" || item.trim().length > 100)
  ) {
    throw new HttpError(400, "추천 메뉴는 문자열 배열이어야 합니다.");
  }
  return menu.map((item) => String(item).trim()).filter(Boolean);
}
export function numericId(value: string): number {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
    throw new HttpError(400, "ID는 양의 정수여야 합니다.");
  return Number(value);
}
export function uuid(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    throw new HttpError(400, "사용자 ID가 올바르지 않습니다.");
  return value;
}
```


### 4-4. DB 타입 작성


SQL의 snake_case 열과 DB 함수 인자·결과를 SDK에 알려 줍니다. 타입 선언은 SQL을 실행해 테이블을 만드는 동작과 다릅니다.

**파일:** `src/types/database.types.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/types/database.types.ts" -->
```ts
export type RestaurantRow = {
  id: number;
  name: string;
  category: string;
  location: string;
  price_range: string;
  rating: number;
  description: string;
  recommended_menu: string[];
  likes: number;
  image: string;
  source_submission_id: number | null;
  created_at: string;
  updated_at: string;
};
export type RestaurantInsert = Pick<
  RestaurantRow,
  "name" | "category" | "location"
> &
  Partial<Omit<RestaurantRow, "id" | "name" | "category" | "location">>;
export type ProfileRow = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  provider: string;
  user_type: "user" | "admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
export type SubmissionRow = {
  id: number;
  restaurant_name: string;
  category: string;
  location: string;
  price_range: string;
  recommended_menu: string[];
  review: string;
  submitter_id: string;
  submitter_name: string;
  submitter_email: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};
export type SubmissionInsert = Pick<
  SubmissionRow,
  | "restaurant_name"
  | "category"
  | "location"
  | "submitter_id"
  | "submitter_name"
  | "submitter_email"
> &
  Partial<
    Omit<
      SubmissionRow,
      | "id"
      | "restaurant_name"
      | "category"
      | "location"
      | "submitter_id"
      | "submitter_name"
      | "submitter_email"
    >
  >;
type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};
export interface Database {
  public: {
    Tables: {
      restaurants: Table<RestaurantRow, RestaurantInsert>;
      profiles: Table<ProfileRow, ProfileRow>;
      submissions: Table<SubmissionRow, SubmissionInsert>;
    };
    Views: Record<never, never>;
    Functions: {
      approve_foodmap_submission: {
        Args: { p_submission_id: number; p_reviewer_id: string };
        Returns: RestaurantRow[];
      };
      set_foodmap_user_type: {
        Args: { p_user_id: string; p_user_type: string };
        Returns: ProfileRow[];
      };
      deactivate_foodmap_account: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
```


### 4-5. 앱 사용자 응답 타입 작성


DB 프로필을 HTTP의 camelCase 응답으로 바꿉니다. declare global은 Express Request에 auth 필드를 알려 주는 타입 확장입니다. 실제 값은 인증 미들웨어가 대입합니다.

**파일:** `src/types/auth.types.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/types/auth.types.ts" -->
```ts
import type { ProfileRow } from "./database.types";

export function profileResponse(row: ProfileRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatar: row.avatar,
    provider: row.provider,
    userType: row.user_type,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export type AppUser = ReturnType<typeof profileResponse>;
declare global {
  namespace Express {
    interface Request {
      auth?: AppUser;
    }
  }
}
```


### 4-6. 서버용 Supabase 연결 작성


서버 Secret key로 SDK를 만들고 공유합니다. 이 SDK는 사용자 session을 보관·갱신하지 않습니다. 사용자의 브라우저 SDK와 담당이 다릅니다. DB 오류는 사용자에게 전달할 HTTP 오류로 변환합니다.

**파일:** `src/config/supabase.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/config/supabase.ts" -->
```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import HttpError from "../utils/httpError";

let client: SupabaseClient<Database> | undefined;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (
    !url ||
    !key ||
    url.includes("your-project-ref") ||
    key.includes("replace_with")
  ) {
    throw new Error("서버의 SUPABASE_URL과 SUPABASE_SECRET_KEY를 설정하세요.");
  }
  // [이론: 세션] 전역 서버 SDK가 사용자 로그인 세션을 보관·갱신하지 않도록 설정합니다.
  // 브라우저 SDK와 Supabase Auth에서 관리하는 로그인 세션은 별도로 존재합니다.
  client = createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return client;
}

export function throwDatabaseError(error: {
  code?: string;
  message: string;
}): never {
  if (error.message.includes("REVIEWER_NOT_ADMIN"))
    throw new HttpError(403, "활성 관리자만 승인할 수 있습니다.");
  if (error.message.includes("LAST_ADMIN"))
    throw new HttpError(
      409,
      "마지막 관리자의 권한을 해제하거나 계정을 비활성화할 수 없습니다.",
    );
  if (error.message.includes("USER_NOT_FOUND"))
    throw new HttpError(404, "사용자를 찾을 수 없습니다.");
  if (error.message.includes("SUBMISSION_NOT_FOUND"))
    throw new HttpError(404, "제보를 찾을 수 없습니다.");
  if (error.message.includes("SUBMISSION_NOT_PENDING"))
    throw new HttpError(409, "대기 중인 제보만 승인할 수 있습니다.");
  if (error.message.includes("INACTIVE_USER"))
    throw new HttpError(409, "비활성 계정의 권한을 변경할 수 없습니다.");
  if (error.code === "23505")
    throw new HttpError(409, "이미 등록되었거나 처리된 데이터입니다.");
  if (["23502", "23503", "23514", "22P02"].includes(error.code ?? ""))
    throw new HttpError(400, "입력값 또는 참조한 데이터가 올바르지 않습니다.");
  console.error("[Supabase]", error.code ?? "request", error.message);
  throw new HttpError(503, "Supabase 요청에 실패했습니다.");
}
```


### 4-7. 공통 오류 응답 작성


실패를 일정한 JSON 구조로 응답하여 클라이언트가 안내할 수 있게 합니다. 운영 환경에서 내부 스택을 그대로 반환하지 않습니다.

**파일:** `src/middleware/error.middleware.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/middleware/error.middleware.ts" -->
```ts
import type { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const error =
    err instanceof Error ? err : new Error("서버 오류가 발생했습니다.");
  const status =
    "statusCode" in error && typeof error.statusCode === "number"
      ? error.statusCode
      : 500;
  res
    .status(status)
    .json({
      success: false,
      message: error.message,
      error: { message: error.message },
    });
};
export default errorHandler;
```


### 4-8. 없는 경로 응답 작성


연결하지 않은 URL은 404로 처리합니다. 모든 라우트를 연결한 다음에 이 미들웨어를 둡니다.

**파일:** `src/middleware/notFound.middleware.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/middleware/notFound.middleware.ts" -->
```ts
import type { RequestHandler } from "express";

const notFound: RequestHandler = (req, res) => {
  res.status(404).json({ error: { message: "Resource not found" } });
};

export default notFound;
```


### 4-9. 토큰 검증과 관리자 검사 작성


Authorization의 Bearer 값을 읽고 Supabase Auth의 getUser로 유효성을 확인합니다. 검증된 계정 UUID로 profiles의 현재 역할·활성 상태를 읽습니다. 이름이나 요청 본문의 userId는 인증 근거로 사용하지 않습니다.

**순서:** Bearer 읽기 → Auth 검증 → profiles 조회 → req.auth 대입 → next() → 다음 처리. requireAdmin은 그 뒤 userType을 검사합니다. 401은 인증 자격 실패, 403은 프로필·활성 상태·권한 거절, 503은 인증 서비스 장애입니다.

**파일:** `src/middleware/auth.middleware.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/middleware/auth.middleware.ts" -->
```ts
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
```


### 4-10. 현재 사용자 응답 작성


인증 미들웨어가 채운 req.auth를 현재 사용자로 반환합니다. 서버가 확인한 프로필만 응답합니다.

**파일:** `src/controllers/users.controller.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/controllers/users.controller.ts" -->
```ts
import asyncHandler from "../utils/asyncHandler";

export const profile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.auth } });
});
```


### 4-11. 현재 사용자 경로 연결


브라우저 SDK가 가입·로그인을 처리하고, Express의 /me는 이후 요청의 토큰을 검증합니다. 로그인 화면은 별도 클라이언트 프로젝트에서 작성합니다.

**파일:** `src/routes/auth.routes.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/routes/auth.routes.ts" -->
```ts
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { profile } from "../controllers/users.controller";

export default function createAuthRouter() {
  const router = Router();
  router.get("/me", isAuthenticated, profile);
  return router;
}
```


### 4-12. 앱과 공통 미들웨어 연결


JSON 본문·CORS·health·인증 경로를 연결하고 마지막에 404와 오류 처리를 둡니다. CLIENT_URL은 브라우저 요청의 허용 출처이며 사용자 권한 검사를 대신하지 않습니다.

**파일:** `src/app.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="src/app.ts" -->
```ts
import express, { type Express } from "express";
import cors from "cors";
import createAuthRouter from "./routes/auth.routes";
import notFound from "./middleware/notFound.middleware";
import errorHandler from "./middleware/error.middleware";

export default function createApp(): Express {
  const app = express();
  const origins = (
    process.env.CLIENT_URL ?? "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRouter());
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
```


### 4-13. 서버 시작 파일 작성


먼저 dotenv/config로 .env를 읽고 app을 만든 뒤 PORT에서 요청을 받습니다. 검사에서는 앱만 가져와 별도 포트로 시험할 수 있습니다.

**파일:** `server.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="server.ts" -->
```ts
import "dotenv/config";
import createApp from "./src/app";

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

export default app;
```


### 4-14. DB 연결 점검 명령 작성


restaurants·profiles·submissions에 접근하여 서버 URL·키·스키마가 연결됐는지 확인합니다. 새로운 데이터를 추가하지 않습니다.

**파일:** `scripts/check-db.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="4" path="scripts/check-db.ts" -->
```ts
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
```


### 4-15. 검사하고 서버 실행하기


프로젝트 루트에서 다음을 실행합니다.

```bash
npm run typecheck
npm run build
```

**정상 결과:** TypeScript 오류가 없고 빌드가 완료되어 `dist/server.js`가 생성됩니다. 오류가 있으면 다음 절로 넘어가기 전에 파일 경로·전체 코드 저장 여부를 확인합니다.

서버를 실행합니다. 이미 실행 중인 본인 서버가 있다면 그 터미널에서 `Ctrl+C`로 종료한 뒤 다시 실행합니다.

```bash
npm run dev
```

**정상 결과:** `Server listening on port 3000`이 표시됩니다. 이 터미널은 실행한 채로 두고 다른 터미널에서 아래 요청을 확인합니다. 다음 절의 파일 수정 전에는 서버를 중지하고, 새 절의 검사 후 다시 실행합니다.

```bash
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/auth/me
```

**정상 결과:** /health는 200과 {"status":"ok"}, 토큰 없는 /me는 401입니다. /me의 401은 로그인 전의 정상 거절입니다.

서버와 별도 터미널에서 DB 연결을 확인합니다.

```bash
npm run db:check
```

세 테이블의 연결 확인 성공 메시지가 나와야 합니다. 실패하면 Supabase URL·서버 Secret key·SQL 전체 실행 여부를 확인합니다.

**이해 확인:** req.auth의 타입을 선언한 파일과 실제 값을 대입한 파일, next() 이후 실행될 처리의 관계를 찾아봅니다.

## 5. 맛집 조회와 관리자 쓰기 API

**목적:** 공개 조회와 관리자 생성·수정·삭제를 구현합니다. 버튼 표시와 별도로 서버가 요청의 사용자·권한을 검사합니다.


### 5-1. 맛집 입력·응답 타입 작성


HTTP의 camelCase 입력과 출력 타입을 정의합니다. 부분 수정은 보내지 않은 값을 보존하므로 생성 입력과 구분합니다.

**파일:** `src/types/restaurant.types.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="5" path="src/types/restaurant.types.ts" -->
```ts
export interface RestaurantData {
  id: number;
  name: string;
  category: string;
  location: string;
  priceRange: string;
  rating: number;
  description: string;
  recommendedMenu: string[];
  likes: number;
  image: string;
}

// 모델은 숫자로 전달되거나 문자열로 전달된 값을 모두 숫자로 정규화합니다.
export interface RestaurantInput {
  id: number | string;
  name: string;
  category: string;
  location: string;
  priceRange: string;
  rating: number | string;
  description: string;
  recommendedMenu?: string[];
  likes?: number | string;
  image?: string;
}

export interface CreateRestaurantInput {
  name: string;
  category: string;
  location: string;
  priceRange?: string;
  rating?: number | string;
  description?: string;
  recommendedMenu?: string[];
  image?: string;
}

// HTTP 요청에는 필드가 빠질 수 있으므로 서비스에서 필수 값을 확인합니다.
export type CreateRestaurantBody = Omit<
  Partial<CreateRestaurantInput>,
  "recommendedMenu"
> & {
  recommendedMenu?: unknown;
};
```


### 5-2. DB 행을 응답으로 변환


price_range·recommended_menu 같은 DB 열을 priceRange·recommendedMenu로 바꾸어 브라우저에 반환합니다.

**파일:** `src/models/restaurant.model.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="5" path="src/models/restaurant.model.ts" -->
```ts
import type { RestaurantRow } from "../types/database.types";
import type {
  RestaurantData,
  RestaurantInput,
} from "../types/restaurant.types";

export default class Restaurant implements RestaurantData {
  id: number;
  name: string;
  category: string;
  location: string;
  priceRange: string;
  rating: number;
  description: string;
  recommendedMenu: string[];
  likes: number;
  image: string;

  constructor({
    id,
    name,
    category,
    location,
    priceRange,
    rating,
    description,
    recommendedMenu = [],
    likes = 0,
    image = "",
  }: RestaurantInput) {
    this.id = Number(id);
    this.name = name;
    this.category = category;
    this.location = location;
    this.priceRange = priceRange;
    this.rating = Number(rating);
    this.description = description;
    this.recommendedMenu = [...recommendedMenu];
    this.likes = Number(likes);
    this.image = image;
  }

  static fromDatabase(row: RestaurantRow): Restaurant {
    return new Restaurant({
      id: row.id,
      name: row.name,
      category: row.category,
      location: row.location,
      priceRange: row.price_range,
      rating: row.rating,
      description: row.description,
      recommendedMenu: row.recommended_menu,
      likes: row.likes,
      image: row.image,
    });
  }

  updateLikes(likes: number | string): this {
    this.likes = Number(likes);
    return this;
  }
}
```


### 5-3. 맛집 조회·관리 서비스 작성


서비스가 DB 요청과 입력 검증을 담당합니다. 허용한 필드만 채택하며 body 전체를 insert/update에 넘기지 않습니다. `{ "name": "새 이름" }`만 수정하면 메뉴·설명은 유지합니다. 빈 문자열을 직접 보내는 것과 필드를 생략하는 것은 다릅니다.

**파일:** `src/services/restaurants.service.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="5" path="src/services/restaurants.service.ts" -->
```ts
import { getSupabase, throwDatabaseError } from "../config/supabase";
import Restaurant from "../models/restaurant.model";
import type { RestaurantInsert } from "../types/database.types";
import HttpError from "../utils/httpError";
import { menuField, numericId, objectBody, textField } from "../utils/input";

function restaurantInput(
  value: unknown,
  partial = false,
): Partial<RestaurantInsert> {
  const input = objectBody(value);
  const row: Partial<RestaurantInsert> = {};
  for (const field of ["name", "category", "location"] as const) {
    if (!partial || input[field] !== undefined)
      row[field] = textField(input[field], field, true, 300);
  }
  for (const [external, column] of [
    ["priceRange", "price_range"],
    ["description", "description"],
    ["image", "image"],
  ] as const) {
    if (input[external] !== undefined)
      row[column] = textField(input[external], external);
  }
  if (input.rating !== undefined) {
    if (
      !["string", "number"].includes(typeof input.rating) ||
      input.rating === ""
    )
      throw new HttpError(400, "평점은 0~5 사이의 숫자여야 합니다.");
    const rating = Number(input.rating);
    if (!Number.isFinite(rating) || rating < 0 || rating > 5)
      throw new HttpError(400, "평점은 0~5 사이의 숫자여야 합니다.");
    row.rating = rating;
  }
  if (input.recommendedMenu !== undefined)
    row.recommended_menu = menuField(input.recommendedMenu);
  if (partial && !Object.keys(row).length)
    throw new HttpError(400, "수정할 값을 입력하세요.");
  return row;
}
export async function getAllRestaurants() {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .select("*")
    .order("id");
  if (error) throwDatabaseError(error);
  return (data ?? []).map(Restaurant.fromDatabase);
}
export async function getRestaurantById(id: string) {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .select("*")
    .eq("id", numericId(id))
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Restaurant not found");
  return Restaurant.fromDatabase(data);
}
export async function getPopularRestaurants(limit: unknown = "5") {
  if (
    typeof limit !== "string" ||
    !/^\d+$/.test(limit) ||
    Number(limit) < 1 ||
    Number(limit) > 50
  )
    throw new HttpError(400, "limit은 1~50 사이의 정수여야 합니다.");
  const { data, error } = await getSupabase()
    .from("restaurants")
    .select("*")
    .order("rating", { ascending: false })
    .order("id")
    .limit(Number(limit));
  if (error) throwDatabaseError(error);
  return (data ?? []).map(Restaurant.fromDatabase);
}
export async function createRestaurant(value: unknown) {
  const row = restaurantInput(value) as RestaurantInsert;
  const { data, error } = await getSupabase()
    .from("restaurants")
    .insert(row)
    .select("*")
    .single();
  if (error) throwDatabaseError(error);
  return Restaurant.fromDatabase(data!);
}
export async function updateRestaurant(id: string, value: unknown) {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .update(restaurantInput(value, true))
    .eq("id", numericId(id))
    .select("*")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Restaurant not found");
  return Restaurant.fromDatabase(data);
}
export async function deleteRestaurant(id: string) {
  const { data, error } = await getSupabase()
    .from("restaurants")
    .delete()
    .eq("id", numericId(id))
    .select("id")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Restaurant not found");
}
```


### 5-4. 맛집 HTTP 응답 작성


서비스 결과를 JSON과 HTTP 상태로 응답합니다. 생성 201, 조회·수정 200, 삭제 204입니다. 204에는 JSON 본문이 없습니다.

**파일:** `src/controllers/restaurants.controller.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="5" path="src/controllers/restaurants.controller.ts" -->
```ts
import asyncHandler from "../utils/asyncHandler";
import * as service from "../services/restaurants.service";
export const list = asyncHandler(async (_req, res) => {
  res.json({ data: await service.getAllRestaurants() });
});
export const popular = asyncHandler(async (req, res) => {
  res.json({
    data: await service.getPopularRestaurants(req.query.limit ?? "5"),
  });
});
export const get = asyncHandler(async (req, res) => {
  res.json({ data: await service.getRestaurantById(req.params.id) });
});
export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ data: await service.createRestaurant(req.body) });
});
export const update = asyncHandler(async (req, res) => {
  res.json({ data: await service.updateRestaurant(req.params.id, req.body) });
});
export const remove = asyncHandler(async (req, res) => {
  await service.deleteRestaurant(req.params.id);
  res.status(204).send();
});
```


### 5-5. 맛집 경로와 권한 연결


GET은 공개이고 POST·PUT·DELETE는 isAuthenticated → requireAdmin → controller 순서입니다. /popular를 /:id보다 먼저 연결하여 popular를 ID로 해석하지 않게 합니다.

**파일:** `src/routes/restaurants.routes.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="5" path="src/routes/restaurants.routes.ts" -->
```ts
import { Router } from "express";
import { isAuthenticated, requireAdmin } from "../middleware/auth.middleware";
import * as controller from "../controllers/restaurants.controller";
const router = Router();
router.get("/", controller.list);
router.get("/popular", controller.popular);
router.get("/:id", controller.get);
// [이론: 사용자 식별] 현재 요청의 사용자와 권한을 확인합니다. 맛집 행에 생성자 UUID를 기록하는 기능은 아닙니다.
router.post("/", isAuthenticated, requireAdmin, controller.create);
router.put("/:id", isAuthenticated, requireAdmin, controller.update);
router.delete("/:id", isAuthenticated, requireAdmin, controller.remove);
export default router;
```


### 5-6. 앱에 맛집 경로 추가


업무 라우트는 404 처리보다 앞에 연결합니다.

**파일:** `src/app.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="5" path="src/app.ts" -->
```ts
import express, { type Express } from "express";
import cors from "cors";
import restaurantsRouter from "./routes/restaurants.routes";
import createAuthRouter from "./routes/auth.routes";
import notFound from "./middleware/notFound.middleware";
import errorHandler from "./middleware/error.middleware";

export default function createApp(): Express {
  const app = express();
  const origins = (
    process.env.CLIENT_URL ?? "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRouter());
  app.use("/api/restaurants", restaurantsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
```


### 5-7. 검사하고 서버 실행하기


프로젝트 루트에서 다음을 실행합니다.

```bash
npm run typecheck
npm run build
```

**정상 결과:** TypeScript 오류가 없고 빌드가 완료되어 `dist/server.js`가 생성됩니다. 오류가 있으면 다음 절로 넘어가기 전에 파일 경로·전체 코드 저장 여부를 확인합니다.

서버를 실행합니다. 이미 실행 중인 본인 서버가 있다면 그 터미널에서 `Ctrl+C`로 종료한 뒤 다시 실행합니다.

```bash
npm run dev
```

**정상 결과:** `Server listening on port 3000`이 표시됩니다. 이 터미널은 실행한 채로 두고 다른 터미널에서 아래 요청을 확인합니다. 다음 절의 파일 수정 전에는 서버를 중지하고, 새 절의 검사 후 다시 실행합니다.

```bash
curl -i http://localhost:3000/api/restaurants
curl -i http://localhost:3000/api/restaurants/popular
curl -i http://localhost:3000/api/restaurants/1
curl -i -X POST http://localhost:3000/api/restaurants
```

**정상 결과:** 세 GET은 200이며 목록의 data에 기본 맛집 3행, 상세에는 ID 1의 송림식당이 있습니다. 토큰 없는 POST는 401입니다. 아직 관리자를 지정하지 않았으므로 관리자 생성·수정·삭제의 성공은 6절에서 확인합니다.

**이해 확인:** GET 조회가 통과하는 경로와 POST가 인증 검사에서 끝나는 경로를 비교합니다.

## 6. 계정과 관리자 역할 관리

**목적:** 본인 프로필을 수정하고 관리자가 사용자 역할을 바꾸게 합니다. 활성 계정의 표시 정보와 권한 정보를 구분합니다.


### 6-1. 사용자 서비스 작성


본인 프로필은 이름·이미지만 수정합니다. 역할 변경·비활성화는 각각 보호된 DB 함수로 처리합니다. 마지막 관리자를 검사하고 변경하는 과정이 동시에 실행돼도 보호되도록 DB가 직렬화합니다.

**파일:** `src/services/users.service.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="6" path="src/services/users.service.ts" -->
```ts
import { getSupabase, throwDatabaseError } from "../config/supabase";
import { profileResponse } from "../types/auth.types";
import HttpError from "../utils/httpError";
import { objectBody, textField, uuid } from "../utils/input";

export async function getAllUsers() {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data ?? []).map(profileResponse);
}
export async function updateProfile(id: string, body: unknown) {
  const input = objectBody(body);
  const update: { name?: string; avatar?: string } = {};
  if (input.name !== undefined)
    update.name = textField(input.name, "name", true, 80);
  if (input.avatar !== undefined)
    update.avatar = textField(input.avatar, "avatar");
  if (!Object.keys(update).length)
    throw new HttpError(400, "수정할 이름 또는 아바타를 입력하세요.");
  const { data, error } = await getSupabase()
    .from("profiles")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throwDatabaseError(error);
  return profileResponse(data!);
}
export async function changeUserType(id: string, value: unknown) {
  const { userType } = objectBody(value);
  if (userType !== "user" && userType !== "admin")
    throw new HttpError(400, "userType은 user 또는 admin이어야 합니다.");
  const { data, error } = await getSupabase().rpc("set_foodmap_user_type", {
    p_user_id: uuid(id),
    p_user_type: userType,
  });
  if (error) throwDatabaseError(error);
  return profileResponse(data![0]);
}
export async function deactivateAccount(id: string) {
  const { error } = await getSupabase().rpc("deactivate_foodmap_account", {
    p_user_id: id,
  });
  if (error) throwDatabaseError(error);
}
```


### 6-2. 사용자 HTTP 응답 완성


현재 사용자 응답에 프로필 수정·목록·역할 변경·비활성화를 추가합니다. 비활성화의 성공은 200과 메시지입니다.

**파일:** `src/controllers/users.controller.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="6" path="src/controllers/users.controller.ts" -->
```ts
import asyncHandler from "../utils/asyncHandler";
import * as service from "../services/users.service";
export const profile = asyncHandler(async (req, res) => {
  res.json({ success: true, data: { user: req.auth } });
});
export const updateProfile = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: await service.updateProfile(req.auth!.id, req.body) },
  });
});
export const list = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: { users: await service.getAllUsers() } });
});
export const changeType = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: { user: await service.changeUserType(req.params.userId, req.body) },
  });
});
export const deactivate = asyncHandler(async (req, res) => {
  await service.deactivateAccount(req.auth!.id);
  res.json({ success: true, message: "계정을 비활성화했습니다." });
});
```


### 6-3. 사용자 경로와 권한 연결


모든 사용자 요청에 인증을 적용하고 목록·역할 변경은 관리자만 허용합니다. req.auth.id로 본인을 정하므로 요청 본문의 ID로 다른 계정의 프로필을 수정할 수 없습니다.

**파일:** `src/routes/users.routes.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="6" path="src/routes/users.routes.ts" -->
```ts
import { Router } from "express";
import { isAuthenticated, requireAdmin } from "../middleware/auth.middleware";
import * as controller from "../controllers/users.controller";
const router = Router();
router.use(isAuthenticated);
router.get("/profile", controller.profile);
router.put("/profile", controller.updateProfile);
router.delete("/account", controller.deactivate);
router.get("/all", requireAdmin, controller.list);
router.put("/:userId/type", requireAdmin, controller.changeType);
export default router;
```


### 6-4. 첫 관리자 설정 명령 작성


서버 키를 가진 개발자가 최초 관리자를 지정하는 명령입니다. 공개 HTTP 라우트에 연결하지 않습니다.

**파일:** `scripts/change-user-type.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="6" path="scripts/change-user-type.ts" -->
```ts
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
```


### 6-5. 앱에 사용자 경로 추가


사용자 라우트를 /api/users에 연결합니다.

**파일:** `src/app.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="6" path="src/app.ts" -->
```ts
import express, { type Express } from "express";
import cors from "cors";
import restaurantsRouter from "./routes/restaurants.routes";
import usersRouter from "./routes/users.routes";
import createAuthRouter from "./routes/auth.routes";
import notFound from "./middleware/notFound.middleware";
import errorHandler from "./middleware/error.middleware";

export default function createApp(): Express {
  const app = express();
  const origins = (
    process.env.CLIENT_URL ?? "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRouter());
  app.use("/api/users", usersRouter);
  app.use("/api/restaurants", restaurantsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
```


### 6-6. 검사하고 서버 실행하기


프로젝트 루트에서 다음을 실행합니다.

```bash
npm run typecheck
npm run build
```

**정상 결과:** TypeScript 오류가 없고 빌드가 완료되어 `dist/server.js`가 생성됩니다. 오류가 있으면 다음 절로 넘어가기 전에 파일 경로·전체 코드 저장 여부를 확인합니다.

서버를 실행합니다. 이미 실행 중인 본인 서버가 있다면 그 터미널에서 `Ctrl+C`로 종료한 뒤 다시 실행합니다.

```bash
npm run dev
```

**정상 결과:** `Server listening on port 3000`이 표시됩니다. 이 터미널은 실행한 채로 두고 다른 터미널에서 아래 요청을 확인합니다. 다음 절의 파일 수정 전에는 서버를 중지하고, 새 절의 검사 후 다시 실행합니다.

토큰 없는 요청이 거절되는지 확인합니다.

```bash
curl -i http://localhost:3000/api/users/all
curl -i -X PUT http://localhost:3000/api/users/profile
```

둘 다 401이어야 합니다.

### 이메일 계정 A·B와 첫 관리자 준비

1. [클라이언트 실습서](https://github.com/ajou-hyunseok-oh/pwd-week8-client/blob/main/README.md)의 **5. 회원가입과 로그인**까지 구현하여 본인이 관리하는 서로 다른 이메일 A·B로 가입합니다. 로그인 상태 복원까지 확인하려면 클라이언트 6절도 진행합니다.
2. Supabase **Authentication → Users**에서 A·B의 User UID를 확인합니다. **Table Editor → profiles**에서 같은 UUID의 행이 생겼고 user_type이 user, is_active가 true인지 확인합니다.
3. 서버 터미널에서 아래 이메일을 A의 실제 가입 이메일로 바꿔 실행합니다.

```bash
npm run change-user-type -- student-a@example.com admin
```

**정상 결과:** 사용자 역할을 admin으로 변경했다는 메시지가 표시됩니다. A만 admin, B는 user여야 합니다. 서버 키로 실행한 최초 설정과 사용자가 브라우저에서 호출하는 API 권한 검사는 다릅니다.

클라이언트의 내 정보·관리자 화면에서 아래를 확인합니다. 토큰 자체를 복사하거나 캡처하지 않습니다.

| 확인 | 결과 |
| --- | --- |
| 일반 B의 관리자 API | 403 |
| 관리자 A의 새 테스트 맛집 생성 | POST 201 |
| 같은 맛집 이름만 수정 | PUT 200, 메뉴·설명 보존 |
| 테스트 맛집 삭제 | DELETE 204 |
| A가 B를 admin으로 변경 | 변경 200, B 새로고침 후 관리자 화면 가능 |
| B를 user로 되돌림 | 이후 B의 관리자 API 403 |
| A 외 관리자가 없을 때 A 권한 해제 | 409 |

프로필 변경은 이름·이미지, 비밀번호 변경은 Supabase Auth, 비활성화는 profiles.is_active 변경입니다. 비활성화는 Auth 계정 삭제가 아닙니다. A·B를 다음 제보 실습에 사용하므로 별도 임시 계정 C로 비활성화를 시험합니다. 비활성화 뒤 C의 /me는 403이어야 합니다. 마지막 관리자 A 비활성화는 409입니다.

**이해 확인:** 프로필 본문에 userType을 넣어도 관리자 권한을 얻을 수 없는 이유, 화면 메뉴와 서버 권한 검사의 차이를 설명합니다.

## 7. 제보와 승인 트랜잭션

**목적:** 검증한 계정과 제보를 연결하고 관리자 승인으로 맛집을 등록합니다. 제보자 정보는 사용자가 입력한 이름이 아니라 req.auth에서 결정합니다.

브라우저가 맛집 생성 후 승인 상태 변경을 별도로 요청하면 앞의 요청만 성공할 수 있습니다. 이 경우 대기 제보가 남아 다음 승인 때 중복 맛집이 생길 수 있습니다. 승인 API는 DB 함수 한 번으로 두 변경을 함께 처리하고, 중간 실패는 함께 취소합니다. 같은 승인 재요청은 같은 맛집을 반환합니다.


### 7-1. 제보 서비스 작성


입력 허용 목록과 상태 조건을 확인합니다. 생성자는 검증한 actor로 기록하고, 승인은 approve_foodmap_submission RPC를 한 번 호출합니다. RPC는 DB에 정의한 함수를 서버에서 호출하는 방식입니다.

**파일:** `src/services/submissions.service.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="7" path="src/services/submissions.service.ts" -->
```ts
import { getSupabase, throwDatabaseError } from "../config/supabase";
import type { AppUser } from "../types/auth.types";
import type { SubmissionRow } from "../types/database.types";
import Restaurant from "../models/restaurant.model";
import HttpError from "../utils/httpError";
import { menuField, numericId, objectBody, textField } from "../utils/input";

function submissionResponse(row: SubmissionRow) {
  return {
    id: row.id,
    restaurantName: row.restaurant_name,
    category: row.category,
    location: row.location,
    priceRange: row.price_range,
    recommendedMenu: row.recommended_menu,
    review: row.review,
    submitterId: row.submitter_id,
    submitterName: row.submitter_name,
    submitterEmail: row.submitter_email,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export async function listSubmissions(status: unknown) {
  if (
    status !== undefined &&
    !["pending", "approved", "rejected"].includes(String(status))
  )
    throw new HttpError(400, "제보 상태가 올바르지 않습니다.");
  let query = getSupabase().from("submissions").select("*");
  if (typeof status === "string")
    query = query.eq("status", status as SubmissionRow["status"]);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throwDatabaseError(error);
  return (data ?? []).map(submissionResponse);
}
export async function getSubmissionById(id: string) {
  const { data, error } = await getSupabase()
    .from("submissions")
    .select("*")
    .eq("id", numericId(id))
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Submission not found");
  return submissionResponse(data);
}
export async function createSubmission(body: unknown, user: AppUser) {
  const input = objectBody(body);
  const { data, error } = await getSupabase()
    .from("submissions")
    .insert({
      restaurant_name: textField(
        input.restaurantName,
        "restaurantName",
        true,
        300,
      ),
      category: textField(input.category, "category", true, 300),
      location: textField(input.location, "location", true, 300),
      price_range: textField(input.priceRange, "priceRange"),
      recommended_menu: menuField(input.recommendedMenu),
      review: textField(input.review, "review"),
      // [이론: 사용자 ID] user는 컨트롤러가 req.auth에서 전달한 검증된 프로필입니다.
      // 요청 본문의 submitterId 대신 이 계정의 UUID를 저장해 제보와 사용자를 연결합니다.
      submitter_id: user.id,
      submitter_name: user.name,
      submitter_email: user.email,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throwDatabaseError(error);
  return submissionResponse(data!);
}
export async function rejectSubmission(
  id: string,
  body: unknown,
  reviewer: AppUser,
) {
  const input = objectBody(body);
  if (input.status !== "rejected")
    throw new HttpError(
      400,
      "거절은 status=rejected, 승인은 승인 전용 API를 사용하세요.",
    );
  const numeric = numericId(id);
  const { data, error } = await getSupabase()
    .from("submissions")
    .update({
      status: "rejected",
      reviewed_by: reviewer.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", numeric)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) {
    await getSubmissionById(id);
    throw new HttpError(409, "대기 중인 제보만 거절할 수 있습니다.");
  }
  return submissionResponse(data);
}
export async function approveSubmission(id: string, reviewer: AppUser) {
  const { data, error } = await getSupabase().rpc(
    "approve_foodmap_submission",
    { p_submission_id: numericId(id), p_reviewer_id: reviewer.id },
  );
  if (error) throwDatabaseError(error);
  return Restaurant.fromDatabase(data![0]);
}
export async function deleteSubmission(id: string) {
  const { data, error } = await getSupabase()
    .from("submissions")
    .delete()
    .eq("id", numericId(id))
    .select("id")
    .maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw new HttpError(404, "Submission not found");
}
```


### 7-2. 제보 HTTP 응답 작성


생성은 201, 조회·승인·거절은 200, 삭제는 204로 응답합니다.

**파일:** `src/controllers/submissions.controller.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="7" path="src/controllers/submissions.controller.ts" -->
```ts
import asyncHandler from "../utils/asyncHandler";
import * as service from "../services/submissions.service";
export const list = asyncHandler(async (req, res) => {
  res.json({ data: await service.listSubmissions(req.query.status) });
});
export const get = asyncHandler(async (req, res) => {
  res.json({ data: await service.getSubmissionById(req.params.id) });
});
export const create = asyncHandler(async (req, res) => {
  res
    .status(201)
    .json({ data: await service.createSubmission(req.body, req.auth!) });
});
export const reject = asyncHandler(async (req, res) => {
  res.json({
    data: await service.rejectSubmission(req.params.id, req.body, req.auth!),
  });
});
export const approve = asyncHandler(async (req, res) => {
  res.json({ data: await service.approveSubmission(req.params.id, req.auth!) });
});
export const remove = asyncHandler(async (req, res) => {
  await service.deleteSubmission(req.params.id);
  res.status(204).send();
});
```


### 7-3. 제보 경로와 권한 연결


생성은 로그인 사용자에게, 조회·검토·삭제는 관리자에게 허용합니다.

**파일:** `src/routes/submissions.routes.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="7" path="src/routes/submissions.routes.ts" -->
```ts
import { Router } from "express";
import { isAuthenticated, requireAdmin } from "../middleware/auth.middleware";
import * as controller from "../controllers/submissions.controller";
const router = Router();
router.use(isAuthenticated);
router.post("/", controller.create);
router.use(requireAdmin);
router.get("/", controller.list);
router.get("/:id", controller.get);
router.post("/:id/approve", controller.approve);
router.put("/:id", controller.reject);
router.delete("/:id", controller.remove);
export default router;
```


### 7-4. 앱에 제보 경로 추가


제보 라우트를 /api/submissions에 연결합니다.

**파일:** `src/app.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="7" path="src/app.ts" -->
```ts
import express, { type Express } from "express";
import cors from "cors";
import restaurantsRouter from "./routes/restaurants.routes";
import submissionsRouter from "./routes/submissions.routes";
import usersRouter from "./routes/users.routes";
import createAuthRouter from "./routes/auth.routes";
import notFound from "./middleware/notFound.middleware";
import errorHandler from "./middleware/error.middleware";

export default function createApp(): Express {
  const app = express();
  const origins = (
    process.env.CLIENT_URL ?? "http://localhost:5173,http://127.0.0.1:5173"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: origins,
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: false,
    }),
  );
  app.use(express.json({ limit: "100kb" }));
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRouter());
  app.use("/api/users", usersRouter);
  app.use("/api/restaurants", restaurantsRouter);
  app.use("/api/submissions", submissionsRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
```


### 7-5. 검사하고 서버 실행하기


프로젝트 루트에서 다음을 실행합니다.

```bash
npm run typecheck
npm run build
```

**정상 결과:** TypeScript 오류가 없고 빌드가 완료되어 `dist/server.js`가 생성됩니다. 오류가 있으면 다음 절로 넘어가기 전에 파일 경로·전체 코드 저장 여부를 확인합니다.

서버를 실행합니다. 이미 실행 중인 본인 서버가 있다면 그 터미널에서 `Ctrl+C`로 종료한 뒤 다시 실행합니다.

```bash
npm run dev
```

**정상 결과:** `Server listening on port 3000`이 표시됩니다. 이 터미널은 실행한 채로 두고 다른 터미널에서 아래 요청을 확인합니다. 다음 절의 파일 수정 전에는 서버를 중지하고, 새 절의 검사 후 다시 실행합니다.

```bash
curl -i -X POST http://localhost:3000/api/submissions
curl -i http://localhost:3000/api/submissions
```

토큰 없는 두 요청은 401입니다. 클라이언트의 **8. 맛집 제보와 승인**에서 다음을 확인합니다.

1. 일반 B가 맛집 내용만 입력해 제보합니다. POST는 201이며 본문에 제보자 UUID·이름·이메일을 넣지 않습니다.
2. 다른 브라우저의 관리자 A가 같은 제보와 서버가 기록한 제보자 정보를 확인합니다. 일반 B가 관리자 조회 API를 요청하면 403입니다.
3. 승인 시 POST /api/submissions/:id/approve 한 요청만 발생하고 맛집 한 건이 생깁니다. 동일 제보 재승인은 200과 같은 맛집 ID여야 합니다.
4. 다른 제보는 거절·삭제해 봅니다. 거절한 제보 승인이나 처리 상태 충돌은 409입니다.
5. 브라우저 새로고침·서버 재시작 후에도 맛집·제보가 남는지 확인합니다.

**이해 확인:** 트랜잭션은 두 변경의 성공·실패를 묶고, 잠금·UNIQUE는 동시·중복 요청을 제한합니다. 각 장치가 막는 문제를 구분합니다.

## 8. Google·네이버 인증 공급자 연결

**목적:** 공급자 설정에서 Client ID·Client Secret을 발급하고 Supabase Auth에 연결합니다. 먼저 아래 서버 파일을 모두 작성한 뒤 발급 절차를 진행합니다. 세 로그인 방식은 인증 후 같은 /api/auth/me와 앱 권한 API를 사용합니다.


### 8-1. 공급자 상태 조회 작성


브라우저에는 로그인 방식의 사용 가능 여부만 반환합니다. 서버 키·Client Secret·원문 설정은 보내지 않습니다. 60초 캐시와 진행 중 요청 공유는 반복 설정 조회를 줄이는 보조 처리이며 장애는 503으로 구분합니다.

**파일:** `src/services/auth-providers.service.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="8" path="src/services/auth-providers.service.ts" -->
```ts
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
```


### 8-2. 인증 경로에 공급자 상태 추가


/me의 토큰 검사와 공개 /providers 설정 조회를 구분합니다. 설정된 버튼과 실제 로그인 성공은 별도 확인합니다.

**파일:** `src/routes/auth.routes.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="8" path="src/routes/auth.routes.ts" -->
```ts
import { Router } from "express";
import { isAuthenticated } from "../middleware/auth.middleware";
import { profile } from "../controllers/users.controller";
import { createAuthProvidersReader } from "../services/auth-providers.service";
import asyncHandler from "../utils/asyncHandler";

export default function createAuthRouter() {
  const router = Router();
  const readProviders = createAuthProvidersReader();
  // 가입·로그인·갱신·로그아웃·비밀번호 변경은 브라우저 Supabase Auth SDK가 담당합니다.
  router.get(
    "/providers",
    asyncHandler(async (_req, res) => {
      res
        .set("Cache-Control", "no-store")
        .json({ data: await readProviders() });
    }),
  );
  router.get("/me", isAuthenticated, profile);
  return router;
}
```


### 8-3. 네이버 OIDC 초기 설정 명령 작성


서버 .env의 네이버 Client ID·Secret으로 custom:naver를 생성하거나 갱신합니다. 연결된 identity를 잃지 않도록 기존 공급자를 삭제해서 다시 만들지 않습니다.

**파일:** `scripts/setup-naver-oidc.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="8" path="scripts/setup-naver-oidc.ts" -->
```ts
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
```


### 8-4. 인증 설정 확인 명령 작성


이메일·Google·네이버 설정과 네이버 discovery를 확인하고 사용 가능 상태를 출력합니다. 비밀값은 출력하지 않습니다.

**파일:** `scripts/check-auth.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="8" path="scripts/check-auth.ts" -->
```ts
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
```


### OAuth 자격 증명과 복귀 주소 준비

Google·네이버 로그인에 필요한 값은 **Client ID와 Client Secret 한 쌍**입니다. 일반 API Key나 사용자의 계정 비밀번호를 발급하는 작업이 아닙니다. Google Cloud의 API Key 만들기 또는 서비스 계정 키 만들기를 선택하지 않습니다.

먼저 Supabase 대시보드에서 사용할 프로젝트를 선택합니다. **Authentication → Sign In / Providers → Google**을 열어 표시된 **Callback URL**을 복사합니다. Custom OAuth Provider 등록 화면에도 Callback URL이 표시됩니다. 이 URL은 외부 공급자의 인증 결과를 Supabase가 받는 주소입니다. 앱으로 돌아올 주소와 구분합니다.

| 설정할 곳 | 넣을 값 | 예시·주의 |
| --- | --- | --- |
| Google의 Authorized JavaScript origins | 클라이언트의 출처 | `http://127.0.0.1:5173` — 경로와 `/#/`를 붙이지 않음 |
| Google의 Authorized redirect URIs | Supabase의 공급자 Callback URL | `https://본인-project-ref.supabase.co/auth/v1/callback` |
| 네이버 PC 웹 서비스 URL | 클라이언트의 주소 | `http://127.0.0.1:5173` |
| 네이버 로그인 Callback URL | Supabase의 공급자 Callback URL | 위 Google redirect URI와 같은 프로젝트 주소 |
| Supabase의 Site URL | 클라이언트의 기본 주소 | `http://127.0.0.1:5173` |
| Supabase의 Redirect URLs | Supabase에서 인증 후 돌아올 앱 주소 | `http://127.0.0.1:5173/auth/callback` |

`본인-project-ref`를 문자 그대로 입력하지 않습니다. 대시보드에서 복사한 실제 값을 사용합니다. 공급자 콜백에는 Express의 3000번 주소나 React의 `/#/login`을 넣지 않습니다. [Supabase Google 연결 방식](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

### Google에서 Client ID·Client Secret 발급

#### 1. Google Cloud 프로젝트 만들기

1. [Google Cloud Console](https://console.cloud.google.com/)을 열고 Google 계정으로 로그인합니다.
2. 상단 프로젝트 선택을 열고 **새 프로젝트 / New project**를 선택합니다. 메뉴에서 찾기 어렵다면 **☰ → IAM 및 관리자 / IAM & Admin → 프로젝트 만들기 / Create a Project** 또는 [프로젝트 만들기](https://console.cloud.google.com/projectcreate)를 엽니다.
3. 프로젝트 이름에 `Ajou Foodmap`을 입력합니다. 자동 생성된 프로젝트 ID는 그대로 사용할 수 있습니다. 조직을 선택할 수 없는 개인 계정은 조직 없음으로 진행하고, 학교 조직 계정은 계정이 허용하는 위치를 사용합니다.
4. **만들기 / Create**를 누릅니다. 생성이 끝나면 상단 프로젝트 이름이 방금 만든 프로젝트인지 확인합니다. 이후 OAuth 설정을 만드는 동안 같은 프로젝트를 계속 선택합니다. [Google의 프로젝트 생성 절차](https://developers.google.com/workspace/guides/create-project)

**정상 결과:** 콘솔 상단에 본인의 Foodmap 프로젝트가 선택되어 있습니다.

#### 2. Google Auth Platform 초기 설정

1. 상단 검색창에 `Google Auth Platform`을 입력해 해당 제품을 열거나 [OAuth 개요](https://console.cloud.google.com/auth/overview)를 엽니다.
2. **시작하기 / Get started**가 보이면 누릅니다. 이미 설정된 프로젝트라면 왼쪽의 **Branding·Audience·Data Access·Clients** 메뉴가 보이므로 다음 항목을 각각 확인합니다.
3. **앱 정보 / App Information**에서 다음을 입력하고 **다음 / Next**를 누릅니다.

   | 항목 | 실습 입력값 |
   | --- | --- |
   | 앱 이름 / App name | `Ajou Foodmap` |
   | 사용자 지원 이메일 / User support email | 본인이 확인할 수 있는 Google 계정 이메일 선택 |

4. **대상 / Audience**에서 개인 실습은 **외부 / External**를 선택하고 Next를 누릅니다. Internal은 Google Workspace 조직 구성원용이므로 다른 계정의 실습 로그인을 제한할 수 있습니다.
5. **연락처 정보 / Contact Information**에 본인이 확인할 이메일을 입력하고 Next를 누릅니다.
6. **완료 / Finish**에서 Google API Services 사용자 데이터 정책을 읽고 동의합니다. **계속 / Continue → 만들기 / Create**로 마칩니다. [현재 초기 설정 순서](https://developers.google.com/workspace/guides/configure-oauth-consent)

**정상 결과:** Google Auth Platform의 Overview가 열리고 왼쪽에 Branding, Audience, Clients, Data Access가 표시됩니다.

#### 3. 실습 계정과 로그인 범위 설정

1. 왼쪽 **대상 / Audience**를 엽니다. 개인 로컬 실습에서는 게시 상태를 **테스트 / Testing**로 사용합니다.
2. **테스트 사용자 / Test users → 사용자 추가 / Add users**에서 로그인할 본인 Google 이메일을 입력하고 **저장 / Save**합니다. 여러 계정으로 시험하려면 각각 등록합니다.
3. 왼쪽 **데이터 액세스 / Data Access → 범위 추가 또는 삭제 / Add or Remove Scopes**를 엽니다.
4. 다음 세 범위를 확인합니다. 검색창에 `userinfo`를 입력해 email·profile을 선택합니다. 목록에 없는 값은 **수동으로 범위 추가 / Manually add scopes** 입력칸에 한 줄씩 넣고 **테이블에 추가 / Add to Table**를 누릅니다. 이미 선택된 범위는 중복 추가하지 않습니다.

   ```text
   openid
   https://www.googleapis.com/auth/userinfo.email
   https://www.googleapis.com/auth/userinfo.profile
   ```

5. 세 범위가 표에 포함됐는지 확인하고 **업데이트 / Update**를 누릅니다. Data Access 화면으로 돌아오면 **저장 / Save**합니다. Gmail·Drive 등 이 실습에 필요 없는 범위를 추가하지 않습니다. [범위 추가·Update 절차](https://support.google.com/cloud/answer/15549135?hl=en), [수동 입력·Add to Table 순서](https://developers.google.com/workspace/chat/authenticate-authorize-chat-user), [Supabase에 필요한 범위](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)

Google은 위의 기본 이름·이메일·프로필 범위만 요청하는 로그인에 테스트 사용자 제한과 7일 승인 만료의 예외를 둡니다. 따라서 미등록 계정도 로그인되었다는 결과만으로 테스트 설정 오류라고 판단하지 않습니다. 수업에서는 시험할 계정을 명시적으로 등록하여 관리합니다. 조직 계정의 외부 앱 접근 정책은 별도 영향을 줄 수 있습니다. [Google Audience의 기본 로그인 예외](https://support.google.com/cloud/answer/15549945?hl=en)

#### 4. 웹 애플리케이션용 OAuth 클라이언트 만들기

1. 왼쪽 **클라이언트 / Clients**를 열고 **클라이언트 만들기 / Create client**를 누릅니다.
2. 애플리케이션 유형에서 **웹 애플리케이션 / Web application**을 선택합니다. React 화면을 사용해도 공급자 응답을 받는 주체는 Supabase Auth이므로 이 유형을 사용합니다.
3. 이름에는 구별하기 쉬운 `Foodmap Web`을 입력합니다.
4. **승인된 JavaScript 원본 / Authorized JavaScript origins → URI 추가 / Add URI**에 다음을 입력합니다.

   ```text
   http://127.0.0.1:5173
   ```

5. **승인된 리디렉션 URI / Authorized redirect URIs → URI 추가 / Add URI**에 준비한 Supabase Callback URL을 붙여 넣습니다. 끝의 경로까지 정확히 같아야 합니다.
6. **만들기 / Create**를 누릅니다. [Google의 OAuth 클라이언트 생성·주소 규칙](https://support.google.com/cloud/answer/15549257?hl=en)

**정상 결과:** OAuth 클라이언트 생성 결과에 Client ID와 Client Secret이 표시됩니다. Client ID는 일반적으로 `...apps.googleusercontent.com`으로 끝납니다.

#### 5. 생성 결과를 저장하고 Supabase에 연결

1. **생성 완료 창을 닫기 전에** Client ID와 Client Secret 전체 값을 보관합니다. **Download JSON / JSON 다운로드**가 보이면 내려받습니다. 이 파일을 텍스트 편집기로 열면 `web.client_id`, `web.client_secret`을 확인할 수 있습니다. 다운로드 파일은 소스 폴더에 넣지 않습니다.
2. 현재 Google 정책에서는 Secret 전체를 **생성 순간에만** 보고 다운로드할 수 있습니다. 나중에 Clients 목록에서 전체 Secret을 다시 볼 수 있다고 생각하고 창을 먼저 닫지 않습니다. [Google의 Secret 표시 정책](https://support.google.com/cloud/answer/15549257?hl=en)
3. Google 생성 창을 열어 둔 상태에서 **새 탭**으로 Supabase 대시보드를 엽니다. 같은 프로젝트의 **Authentication → Sign In / Providers → Google**로 이동합니다.
4. Google 공급자 활성화를 켭니다. Google 생성 창의 **Client ID 복사** → Supabase의 **Client IDs**에 붙여넣기 → Google 창의 **Client Secret 복사** → Supabase의 **Client Secret**에 붙여넣기 → **Save** 순서로 진행합니다. 같은 클라이언트의 한 쌍을 입력하고 저장한 뒤 Google 생성 창을 닫습니다. Supabase Publishable key나 Secret key를 이 두 칸에 넣지 않습니다. [Supabase의 Google 공급자 연결](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
5. Google Clients 목록에서 해당 이름을 열어 JavaScript origin과 redirect URI가 저장된 값인지 다시 확인합니다.

**Secret을 저장하지 못한 경우:** Google Auth Platform → Clients → 해당 웹 클라이언트 → **Add Secret**으로 새 Secret을 생성합니다. 생성 즉시 저장하고 Supabase의 Google Secret을 새 값으로 바꿉니다. 새 값으로 로그인이 되는지 확인한 뒤 사용하지 않는 이전 Secret을 Disable합니다. 클라이언트 자체를 삭제하여 해결하지 않습니다. [Secret 교체 순서](https://support.google.com/cloud/answer/15549257?hl=en)

### 네이버에서 Client ID·Client Secret 발급

#### 1. 개발자 계정과 애플리케이션 등록

1. [NAVER Developers](https://developers.naver.com/)에 접속해 네이버 계정으로 로그인합니다.
2. 상단 **Application → 애플리케이션 등록**을 누릅니다. [등록 화면 바로가기](https://developers.naver.com/apps/#/register)
3. 첫 사용이면 이용약관 동의·계정 정보 등록을 진행합니다. 화면이 요구하는 연락처 정보와 휴대폰 본인 인증을 본인의 정보로 완료합니다.
4. **애플리케이션 등록(API 이용신청)** 화면에 다음 값을 입력합니다.

   | 항목 | 실습 입력값 |
   | --- | --- |
   | 애플리케이션 이름 | `아주맛집` 등 본인 서비스임을 알아볼 짧은 이름 |
   | 사용 API | 선택 목록에서 **네이버 로그인** 추가 |
   | 로그인 오픈 API 서비스 환경 | **환경 추가 → PC 웹** |
   | PC 웹 서비스 URL | `http://127.0.0.1:5173` |
   | 네이버 로그인 Callback URL | Supabase에서 복사한 실제 공급자 Callback URL |

5. **제공 정보 선택(이용자 식별자는 기본 정보로 제공)** 표에서 회원이름·연락처 이메일 주소·별명·프로필 사진·성별·생일·연령대·출생연도·휴대전화번호의 **필수·추가** 체크를 모두 해제합니다. 이 실습은 OIDC 식별자로 계정을 연결하고 이 추가 프로필 정보는 요청하지 않습니다. 앱에서 필요한 표시 이름은 로그인 후 프로필에서 입력합니다.
6. 입력값을 확인하고 **등록하기**를 누릅니다. PC 웹을 추가해야 URL 입력칸이 나타납니다. 비로그인 Open API의 WEB 설정이 아니라 **로그인 Open API의 PC 웹**인지 확인합니다. [네이버 등록 필드 안내](https://developers.naver.com/docs/common/openapiguide/appregister.md), [OIDC 식별·범위 규격](https://developers.naver.com/docs/login/devguide/devguide.md)

제공 정보 표가 아직 보이지 않으면 먼저 사용 API에서 네이버 로그인을 선택했는지 확인하고 아래로 스크롤합니다. 다음은 네이버 공식 안내의 제공 정보 선택 화면입니다. 체크할 열의 위치를 확인하되 실습에서는 위에서 설명한 항목을 해제합니다.

![네이버 공식 안내의 제공 정보 선택 화면](https://developers.naver.com/proxyapi/rawgit/naver/naver-openapi-guide/master/ko/images/appregister-3.png)

**정상 결과:** Application → 내 애플리케이션에 방금 만든 앱이 표시됩니다.

#### 2. Client ID와 Client Secret 확인

1. **Application → 내 애플리케이션 → 방금 만든 앱 이름 → 개요**를 엽니다.
2. **애플리케이션 정보**의 Client ID 전체 값을 복사합니다.
3. Client Secret 옆의 **보기**를 눌러 전체 값을 복사합니다. 보기 후 표시되는 **재발급**은 단순 표시 버튼이 아니라 Secret을 바꾸는 기능이므로 확인하려고 반복해서 누르지 않습니다.
4. 다시 찾아올 때도 같은 앱의 개요에서 확인합니다. 다른 앱의 ID와 Secret을 섞지 않습니다. [Client ID·Secret 확인 경로](https://help.naver.com/service/23029/contents/17023), [보기·재발급 안내](https://developers.naver.com/docs/common/openapiguide/appregister.md)

#### 3. 개발 중 로그인할 테스터 등록

1. 앱 상세의 **API 설정**에서 개발 상태가 **개발 중**인지 확인하고, PC 웹 서비스 URL·Callback URL을 다시 확인합니다.
2. **멤버관리** 탭을 엽니다. **테스터 ID 등록** 행의 빈 입력칸에 로그인 시험에 사용할 네이버 아이디를 적고 오른쪽 **+**를 누릅니다. 수업에서 사용할 별도 시험 계정도 같은 방법으로 추가합니다.
3. 등록 목록에 해당 아이디가 보이는지 확인합니다. 등록자·관리자 계정은 테스터 추가 없이 로그인할 수 있고, 다른 계정은 테스터로 등록해 시험합니다. 관리자 ID 등록과 테스터 ID 등록은 다른 행입니다.
4. 개인 실습을 위해 서비스 적용으로 전환하려고 하지 않습니다. 공개 서비스 전환에는 네이버 로그인 검수가 별도로 필요합니다. [개발 상태·테스터 관리](https://developers.naver.com/docs/common/openapiguide/appconf.md)

다음 공식 화면에서 아래쪽 **테스터 ID 등록** 행을 사용합니다. 위쪽 관리자 ID 등록은 앱 설정을 관리할 사람을 추가하는 항목입니다.

![네이버 공식 안내의 멤버관리와 테스터 추가 버튼](https://developers.naver.com/proxyapi/rawgit/naver/naver-openapi-guide/master/ko/images/appconf-5.png)

#### 4. 서버 환경변수에 저장하고 Supabase에 등록

서버 프로젝트 루트의 `.env`를 열고 다음 두 항목을 본인 앱의 실제 값으로 추가합니다. 기존 Supabase 변수는 유지합니다.

```dotenv
NAVER_CLIENT_ID=네이버_개요에서_복사한_Client_ID
NAVER_CLIENT_SECRET=같은_앱에서_복사한_Client_Secret
```

이 두 값은 클라이언트의 `VITE_` 환경변수에 넣지 않습니다. **서버 프로젝트 터미널**에서 다음을 실행합니다.

```bash
npm run auth:setup-naver
npm run auth:check
```

첫 명령이 네이버 자격 증명을 Supabase의 Custom OIDC 공급자에 등록하고, 두 번째 명령이 설정을 확인합니다. Supabase **Authentication → Providers → Custom OAuth Providers**에서 `custom:naver`를 찾아 다음 값을 대조합니다.

| 항목 | 값 |
| --- | --- |
| Identifier | `custom:naver` |
| 유형 | OIDC |
| Issuer | `https://nid.naver.com` |
| Scope | `openid` |
| Enabled | true |
| PKCE enabled | true |
| Email optional | true |

OIDC는 issuer의 공개 설정에서 인증 주소·서명 검증 주소를 알아옵니다. 네이버 이메일이 없는 계정도 Supabase UUID로 연결하기 위해 Email optional을 사용합니다. [Supabase Custom OIDC 설정](https://supabase.com/docs/guides/auth/custom-oauth-providers)

설정 명령이 성공하면 서버 프로젝트 루트에서 `npm run dev`로 Express를 시작합니다. 이미 실행 중이면 해당 터미널에서 Ctrl+C로 중지한 뒤 다시 실행합니다. 환경변수 변경은 재시작하여 읽습니다.

### 발급과 연결 결과 확인

먼저 아래 1번으로 서버 설정을 확인합니다. 실제 화면에서 시험하는 2~4번은 [클라이언트 실습서](https://github.com/ajou-hyunseok-oh/pwd-week8-client/blob/main/README.md)의 **9. Google·네이버 로그인**까지 구현한 뒤 진행합니다. 아직 그 화면을 만들지 않았다면 서버 설정 확인 후 클라이언트의 해당 절로 이동합니다.

1. 브라우저에서 `http://localhost:3000/api/auth/providers`를 엽니다. `data.google.enabled`와 `data.naver.enabled`가 true여야 합니다. 설정 변경 직후 이전 결과가 보이면 60초 뒤 확인하거나 서버를 재시작합니다.
2. 클라이언트 `http://127.0.0.1:5173/#/login`에서 Google 버튼 → 실제 시험 계정 → 동의 → 앱 복귀를 확인합니다. `/auth/callback`을 지나 `/#/dashboard`로 이동하고 `/api/auth/me`가 200이어야 합니다.
3. 네이버에서도 등록한 테스터 계정으로 같은 흐름을 확인합니다. 이름·이메일을 제공하지 않아도 로그인하고 앱의 프로필에서 표시 이름을 저장할 수 있어야 합니다.
4. 각 공급자에서 취소, 로그아웃, 재로그인, 새로고침을 각각 확인합니다. Secret을 받았거나 공급자 상태가 true라는 결과만으로 실제 로그인까지 완료했다고 판단하지 않습니다.

| 증상 | 확인할 위치 |
| --- | --- |
| Google `redirect_uri_mismatch` | Google Clients 상세의 redirect URI가 Supabase Callback URL과 경로까지 같은지 확인 |
| Google `origin_mismatch` | JavaScript origin에 127.0.0.1:5173의 프로토콜·호스트·포트만 등록했는지 확인 |
| `invalid_client` | 선택한 앱의 Client ID·Secret 한 쌍, Secret 활성 상태, Supabase 저장 여부 확인 |
| `org_internal` | Google Audience가 개인 실습에 맞는 External인지 확인 |
| 네이버 특정 계정만 로그인 실패 | 같은 앱의 멤버 관리에서 해당 테스터 ID 확인 |
| code 교환 실패 | 로그인 시작·복귀의 브라우저 프로필과 origin 일치, 코드 중복 교환 여부 확인 |
| 설정이 바뀌지 않음 | Save 완료·서버 재시작·60초 상태 캐시, Google 설정 반영 대기 확인 |

배포할 때는 Google origin·네이버 서비스 URL에 실제 Vercel origin을 등록하고, Supabase Site URL·Redirect URLs에도 배포 주소를 반영합니다. 공급자 콜백은 같은 Supabase 프로젝트 주소를 계속 사용합니다.


### 8-5. 검사하고 서버 실행하기


프로젝트 루트에서 다음을 실행합니다.

```bash
npm run typecheck
npm run build
```

**정상 결과:** TypeScript 오류가 없고 빌드가 완료되어 `dist/server.js`가 생성됩니다. 오류가 있으면 다음 절로 넘어가기 전에 파일 경로·전체 코드 저장 여부를 확인합니다.

서버를 실행합니다. 이미 실행 중인 본인 서버가 있다면 그 터미널에서 `Ctrl+C`로 종료한 뒤 다시 실행합니다.

```bash
npm run dev
```

**정상 결과:** `Server listening on port 3000`이 표시됩니다. 이 터미널은 실행한 채로 두고 다른 터미널에서 아래 요청을 확인합니다. 다음 절의 파일 수정 전에는 서버를 중지하고, 새 절의 검사 후 다시 실행합니다.

```bash
curl -i http://localhost:3000/api/auth/providers
curl -i http://localhost:3000/api/auth/me
```

공급자 설정을 마쳤다면 /providers는 200이고 data.email.enabled·google.enabled·naver.enabled가 true여야 합니다. 토큰 없는 /me는 계속 401입니다. 설정을 바꿨는데 이전 값이 보이면 60초 기다리거나 서버를 재시작합니다.

클라이언트의 **9. Google·네이버 로그인**까지 작성하고 각 테스트 계정으로 실제 동의 → 앱 복귀 → /me 200 → 새로고침 → 로그아웃 → 재로그인을 확인합니다. 각 공급자에서 취소한 경우의 실패 안내도 확인합니다. 네이버가 이메일·이름을 제공하지 않아도 기본 이름과 빈 이메일로 로그인한 뒤 프로필에서 표시 이름을 보완할 수 있어야 합니다.

**이해 확인:** 공급자 콜백과 앱 콜백 주소, 외부 인증 정보와 Express Bearer로 보내는 Supabase 액세스 토큰을 각각 구분합니다.

## 9. API·업무·SQL 검사

**목적:** 정상 동작뿐 아니라 인증 거절·권한 위조·중복 승인·롤백을 자동 확인합니다. 아래 tests는 대역 Auth 응답과 로컬 PGlite를 사용하므로 실제 Supabase 계정·행을 생성하지 않습니다.


### 9-1. API 접근 검사 작성


공개 조회, 인증·관리자 검사, 검증된 사용자 전달, CORS와 오류 응답을 검사합니다.

**파일:** `tests/api.test.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="9" path="tests/api.test.ts" -->
```ts
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
```


### 9-2. 서비스 입력과 상태 검사 작성


부분 수정의 생략 필드 보존, 위조한 프로필 역할·제보자 무시, 상태 충돌과 DB 오류 변환을 검사합니다.

**파일:** `tests/services.test.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="9" path="tests/services.test.ts" -->
```ts
jest.mock("../src/config/supabase", () => ({
  ...jest.requireActual("../src/config/supabase"),
  getSupabase: jest.fn(),
}));
import { getSupabase } from "../src/config/supabase";
import * as restaurants from "../src/services/restaurants.service";
import * as submissions from "../src/services/submissions.service";
import * as users from "../src/services/users.service";
import type { AppUser } from "../src/types/auth.types";

const query = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
};
const client = { from: jest.fn(() => query), rpc: jest.fn() };
const row = {
  id: 4,
  name: "식당",
  category: "한식",
  location: "캠퍼스",
  price_range: "정보 없음",
  rating: 0,
  description: "",
  recommended_menu: [],
  likes: 0,
  image: "",
};
const actor: AppUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "real@example.test",
  name: "실제 사용자",
  avatar: "",
  provider: "email",
  userType: "user",
  isActive: true,
  createdAt: "",
  updatedAt: "",
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(getSupabase)
    .mockReturnValue(client as unknown as ReturnType<typeof getSupabase>);
  query.single.mockResolvedValue({ data: row, error: null });
  query.maybeSingle.mockResolvedValue({ data: row, error: null });
});
test("맛집 생성은 DB identity를 사용하고 관리 필드·ID를 입력에서 복사하지 않는다", async () => {
  const result = await restaurants.createRestaurant({
    id: 99,
    likes: 200,
    source_submission_id: 8,
    name: "식당",
    category: "한식",
    location: "캠퍼스",
    recommendedMenu: "김밥, 라면",
  });
  expect(query.insert).toHaveBeenCalledWith({
    name: "식당",
    category: "한식",
    location: "캠퍼스",
    recommended_menu: ["김밥", "라면"],
  });
  expect(result).toMatchObject({ id: 4, priceRange: "정보 없음" });
});
test("부분 수정은 생략한 메뉴·설명·평점을 지우지 않는다", async () => {
  await restaurants.updateRestaurant("4", { name: "새 이름" });
  expect(query.update).toHaveBeenCalledWith({ name: "새 이름" });
});
test("제보자·상태는 요청 본문 대신 검증한 계정과 서버 기본값을 사용한다", async () => {
  query.single.mockResolvedValue({
    data: { ...row, restaurant_name: "식당", status: "pending" },
    error: null,
  });
  await submissions.createSubmission(
    {
      restaurantName: "식당",
      category: "한식",
      location: "캠퍼스",
      submitterId: "forged",
      submitterEmail: "forged@example.test",
      status: "approved",
    },
    actor,
  );
  expect(query.insert).toHaveBeenCalledWith(
    expect.objectContaining({
      submitter_id: actor.id,
      submitter_email: actor.email,
      submitter_name: actor.name,
      status: "pending",
    }),
  );
});
test("프로필 수정으로 역할·활성 상태를 변경할 수 없다", async () => {
  query.single.mockResolvedValue({
    data: { id: actor.id, name: "변경", user_type: "user", is_active: true },
    error: null,
  });
  await users.updateProfile(actor.id, {
    name: "변경",
    userType: "admin",
    user_type: "admin",
    is_active: false,
  });
  expect(query.update).toHaveBeenCalledWith({ name: "변경" });
});
test("상태 수정으로 승인을 우회할 수 없다", async () => {
  await expect(
    submissions.rejectSubmission("1", { status: "approved" }, actor),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(query.update).not.toHaveBeenCalled();
});
test("승인은 검증한 검토자 ID로 RPC 한 번을 호출한다", async () => {
  client.rpc.mockResolvedValue({ data: [row], error: null });
  await submissions.approveSubmission("1", actor);
  expect(client.rpc).toHaveBeenCalledWith("approve_foodmap_submission", {
    p_submission_id: 1,
    p_reviewer_id: actor.id,
  });
});
test.each([
  undefined,
  {},
  { name: " ", category: "한식", location: "캠퍼스" },
  { name: "식당", category: "한식", location: "캠퍼스", rating: 6 },
])("잘못된 맛집 입력을 거절한다: %p", async (input) => {
  await expect(restaurants.createRestaurant(input)).rejects.toMatchObject({
    statusCode: 400,
  });
});
test("존재하지 않는 수정은 404, 마지막 관리자 변경은 409를 반환한다", async () => {
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(
    restaurants.updateRestaurant("99", { name: "새 이름" }),
  ).rejects.toMatchObject({ statusCode: 404 });
  client.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "LAST_ADMIN", code: "P0001" },
  });
  await expect(
    users.changeUserType(actor.id, { userType: "user" }),
  ).rejects.toMatchObject({ statusCode: 409 });
  client.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "REVIEWER_NOT_ADMIN", code: "42501" },
  });
  await expect(submissions.approveSubmission("1", actor)).rejects.toMatchObject(
    { statusCode: 403 },
  );
});
```


### 9-3. 공급자 상태 검사 작성


사용 가능 여부·비밀값 노출 방지·캐시·장애 처리와 필수 네이버 설정을 검사합니다.

**파일:** `tests/auth-providers.test.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="9" path="tests/auth-providers.test.ts" -->
```ts
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
```


### 9-4. 실제 SQL 로컬 검사 작성


빈 로컬 DB에 schema·seed를 실행하고 가입 트리거·DB 권한·승인·중복 요청·롤백·마지막 관리자를 검사합니다. authBootstrap은 로컬 검사에서만 Supabase Auth 역할·테이블을 흉내 내며 원격 SQL Editor에 복사하지 않습니다.

**파일:** `tests/schema.postgres.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="9" path="tests/schema.postgres.ts" -->
```ts
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
```


### 9-5. 선택적 실제 인증 검사 준비


실제 Auth·HTTP 연결을 확인하는 선택 명령입니다. 실행할 경우 임시 계정 2개와 테스트 행을 원격 프로젝트에 만들고 기본 실행은 종료 전에 정리합니다. 코드를 준비하는 것과 실제 명령 실행은 구분합니다.

**파일:** `scripts/verify-live.ts` — 프로젝트 루트 기준입니다. 파일이 없으면 상위 폴더와 파일을 만듭니다. 앞에서 작성한 파일이면 아래 전체 내용으로 교체합니다.

<!-- lab:file step="9" path="scripts/verify-live.ts" -->
```ts
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
```


### 9-6. 검사하고 서버 실행하기


프로젝트 루트에서 다음을 실행합니다.

```bash
npm run typecheck
npm test
npm run build
```

**정상 결과:** TypeScript 오류가 없고 빌드가 완료되어 `dist/server.js`가 생성됩니다. Jest에 PASS, SQL 검사에 fail 0이 표시되어야 합니다. 오류가 있으면 다음 절로 넘어가기 전에 파일 경로·전체 코드 저장 여부를 확인합니다.

서버를 실행합니다. 이미 실행 중인 본인 서버가 있다면 그 터미널에서 `Ctrl+C`로 종료한 뒤 다시 실행합니다.

```bash
npm run dev
```

**정상 결과:** `Server listening on port 3000`이 표시됩니다. 이 터미널은 실행한 채로 두고 다른 터미널에서 아래 요청을 확인합니다. 다음 절의 파일 수정 전에는 서버를 중지하고, 새 절의 검사 후 다시 실행합니다.

**정상 결과:** Jest 58개와 SQL 검사 10개가 모두 통과합니다. SQL에는 빈 DB 생성, 시드 재실행 보존, 권한 위조 거절, 중복 승인, 중간 실패 롤백이 포함됩니다. 자동 검사 성공만으로 실제 공급자 로그인과 배포가 완료됐다고 기록하지 않습니다.

### 선택: 실제 Supabase 이메일 인증까지 검사

서버 .env의 SUPABASE_PUBLISHABLE_KEY가 같은 프로젝트의 실제 공개 키일 때 실행할 수 있습니다. 이 명령은 실제 원격 프로젝트에 임시 계정·행을 만듭니다.

```bash
npm run test:live
```

성공하면 passed: true와 검사 목록이 표시되며 이 실행에서 생성한 계정·행·임시 HTTP 서버를 정리합니다. Google·네이버의 대화형 로그인이나 실제 만료 시각 경과는 검사하지 않습니다. --keep-fixtures는 계정·행을 남기는 별도 기능이므로 기본 검사에서는 사용하지 않습니다.

로그아웃의 session 제거와 갱신 자격 철회는 이미 발급된 액세스 토큰의 즉시 무효화와 다릅니다. 발급된 토큰은 만료 전까지 유효할 수 있습니다. [Supabase 로그아웃](https://supabase.com/docs/guides/auth/signout)

## 10. GitHub·Render 배포와 최종 확인


### 10-1. GitHub 저장소 연결과 업로드


GitHub에서 본인 소유의 빈 pwd-week8-server 저장소를 만듭니다. 생성 화면에서 README·라이선스·gitignore는 추가하지 않습니다. 아래 YOUR_GITHUB_ID를 본인 아이디로 바꿉니다.

```bash
git init
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_ID/pwd-week8-server.git
git status
```

이미 이 프로젝트를 Git에 연결했다면 remote를 중복 추가하지 않고 git remote -v로 확인합니다. .env·node_modules·dist가 추적되지 않는지 확인한 뒤 소스·설정·SQL·테스트·package-lock.json·.env.example·README를 반영합니다.

```bash
git add .
git commit -m "Complete Foodmap server"
git push -u origin main
```


### 10-2. Render 서버 만들기


1. [Render 대시보드](https://dashboard.render.com/)에서 **New → Web Service**를 엽니다.
2. GitHub를 연결하고 본인의 pwd-week8-server 저장소를 선택합니다.
3. 다음 실행 정보를 입력합니다.

   | 항목 | 값 |
   | --- | --- |
   | Name | 본인이 구분할 Foodmap API 이름 |
   | Branch | 업로드한 main 또는 실제 배포 브랜치 |
   | Runtime | Node |
   | Root Directory | package.json이 저장소 루트에 있으면 비움 |
   | Build Command | `npm ci --include=dev && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/health` |

4. 사용할 인스턴스 요금제를 확인합니다. Environment Variables에 SUPABASE_URL·SUPABASE_SECRET_KEY·CLIENT_URL과 NODE_ENV=production을 등록합니다. PORT는 Render가 제공하는 값을 서버가 읽습니다. 로컬 .env가 자동 업로드되는 것은 아닙니다.
5. CLIENT_URL에는 실제 Vercel 앱 origin을 입력합니다. 여러 허용 주소는 쉼표로 구분합니다. 경로와 끝의 /는 넣지 않습니다.
6. 배포를 시작하고 로그에서 설치·빌드 성공과 Live 상태를 확인합니다. 공개 HTTPS 주소를 복사해 /health 200을 확인합니다.

[Render의 Node·Express 배포](https://render.com/docs/deploy-node-express-app)


### 10-3. 배포 클라이언트와 연결


1. Vercel 클라이언트의 VITE_API_BASE_URL을 본인 Render HTTPS 기본 주소로 설정하고 재배포합니다. /api를 붙이지 않습니다.
2. Render의 CLIENT_URL에 같은 Vercel origin을 등록하고 적용합니다.
3. Supabase Site URL을 배포 앱 origin, Redirect URLs를 배포 앱 origin/auth/callback으로 설정합니다. 로컬 실습 주소가 계속 필요하면 허용 목록에 별도로 남깁니다.
4. Google의 JavaScript origin·네이버의 서비스 URL도 배포 앱 주소를 추가·갱신합니다. 공급자 콜백은 같은 Supabase 프로젝트 주소입니다.
5. 시크릿 창에서 공개 맛집 조회, 이메일·Google·네이버 로그인, 일반 제보, 관리자 CRUD·역할·승인, 로그아웃·재로그인을 확인합니다. Network의 API 대상과 배포 커밋이 본인 수정본인지 확인합니다.

배포 환경변수는 서버 재실행·클라이언트 새 빌드부터 반영됩니다. 로컬 파일만 바꾸고 배포 서비스가 자동으로 바뀌었다고 판단하지 않습니다.


### 10-4. 실행한 로컬 서버 종료


검사를 위해 실행한 서버·클라이언트 터미널에서 각각 Ctrl+C로 종료합니다. 다른 사람이 실행한 서버는 종료하지 않습니다. Windows PowerShell에서는 다음 명령에 본인 검사 포트의 Listen 행이 없어야 합니다.

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000,5173 -ErrorAction SilentlyContinue
```

macOS·Linux에서는 `lsof -iTCP:3000 -sTCP:LISTEN`과 5173번 포트를 확인합니다.

## 문제 해결

| 증상 | 먼저 확인할 위치·조치 |
| --- | --- |
| package.json 없음 | 터미널이 프로젝트 루트인지 확인 |
| 패키지 모듈 없음 | package.json 저장 후 npm install·lock 일치 확인 |
| req.auth 타입 오류 | auth.types.ts의 declare global까지 저장했는지 확인 |
| 테이블·함수가 없음 | SQL Editor에서 schema.sql 전체 실행 여부 |
| db:check 실패 | 서버 URL·Secret key·테이블 권한·네트워크 |
| 가입 Database error | Auth 트리거·profiles 필수 값·권한 |
| /me 401 | Bearer 형식·로그인 세션·같은 Supabase 프로젝트 |
| /me 403 | 같은 UUID의 profiles 행·is_active |
| 관리자 403 | 현재 user_type과 역할 변경 후 화면 새로고침 |
| 수정 필드가 사라짐 | 부분 수정에 허용된 필드만 보내는지 확인 |
| 승인 함수 오류 | schema.sql·검토자 권한·pending 상태 |
| 중복 처리 409 | 최신 상태를 읽고 이미 처리됐는지 확인 |
| 공급자 상태 503 | 서버 URL·키·Auth 설정 API 연결 |
| Google redirect_uri_mismatch | Google redirect URI와 Supabase 공급자 콜백 일치 |
| 네이버 특정 계정 거절 | 개발 중 앱의 테스터 등록 |
| 인증 code 교환 실패 | 같은 브라우저·origin, 앱 복귀 URL, 한 번만 교환 |
| CORS 오류 | 서버 CLIENT_URL에 실제 앱 origin·Authorization 허용 |
| Render tsc 없음 | 설치 명령에 --include=dev 포함 |
| 배포 주소가 예전 코드 | 배포 브랜치·커밋·서비스 로그 확인 |

문제를 기록할 때 실행한 명령·URL, 예상 결과, 실제 오류 문구, 확인한 파일·설정을 함께 남깁니다.

## 제출

- 본인 서버·클라이언트 GitHub URL과 구현 커밋
- Render API URL과 Vercel 앱 URL
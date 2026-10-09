# 할 일 · 목표 관리 앱

1년 목표 → 주간 계획 → 일일 할 일을 하나의 구조로 연결하고, 칸반(todo / doing / done)에서 드래그 앤 드롭으로 상태를 바꾸면 주간·1년 목표 진행률이 자동 반영되는 개인용 앱입니다. 요구사항은 저장소 루트의 `PRD.md`, 구현 계획은 `PLAN.md`를 따릅니다.

- Next.js 16 (App Router) + TypeScript, 백엔드는 Next.js Route Handlers (`app/api/**`)
- MongoDB Atlas + Mongoose, 검증은 Zod, 클라이언트 상태는 SWR, 드래그 앤 드롭은 dnd-kit
- 진행률은 저장하지 않고 조회할 때 계산합니다 (주간: `done ÷ 전체 × 100`, 1년 목표: 연결된 모든 주간 계획의 할 일 합계 기준 가중 계산).

## 로컬 실행

```bash
npm install
cp .env.example .env.local     # MONGODB_URI, SESSION_SECRET 를 채운다
npm run dev                    # http://localhost:3000
```

`/register`에서 이메일+비밀번호로 가입하면 이후 모든 데이터(1년 목표, 주간 계획, 할 일)는 그 회원 소유로만 저장되고 다른 회원에게는 보이지 않습니다. `SESSION_SECRET`이 없으면 모든 페이지와 API가 503을 반환합니다(의도된 fail-closed 동작).

```bash
npm run seed -- <email>        # (선택) 먼저 가입한 계정에 데모 데이터 추가
```

### 환경변수

| 이름 | 설명 |
|---|---|
| `MONGODB_URI` | Atlas 연결 문자열. 서버 전용이므로 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다. |
| `SESSION_SECRET` | 세션 쿠키 서명 키 (모든 환경에서 필수). 긴 임의 문자열을 쓰세요. 없으면 앱이 503으로 막힙니다. |

### 스크립트

| 명령 | 내용 |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint / `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest 단위·API 통합 테스트 (메모리 MongoDB 레플리카셋, 실제 DB 불필요) |
| `npm run test:e2e` | Playwright e2e (`npx playwright install chromium` 최초 1회 필요, 메모리 DB로 서버를 직접 띄움) |
| `npm run build` | 프로덕션 빌드 |

> Windows에서 vitest(rolldown)가 `Cannot find native binding`으로 실패하면 `npm i --no-save @rolldown/binding-win32-x64-msvc@<rolldown 버전>` 으로 네이티브 바인딩을 설치하세요 (npm optional dependency 버그).

## MongoDB Atlas 설정

1. 클러스터를 만들고 **이 앱 전용 DB 사용자**를 생성합니다. 권한은 사용할 DB(`todo_app`)의 `readWrite`만 부여합니다.
2. **Network Access**: Vercel 함수는 고정 출구 IP가 없으므로 `0.0.0.0/0`을 허용해야 합니다(또는 Vercel Marketplace의 MongoDB Atlas 통합 사용). 대신 강한 비밀번호와 최소 권한 사용자로 보완합니다.
3. 연결 문자열을 `MONGODB_URI`로 설정합니다. 트랜잭션(삭제 시 연결 해제, 드래그 순서 재배치)을 쓰므로 레플리카셋인 Atlas 클러스터가 필요합니다.
4. 무료 M0는 연결 수 한도가 낮습니다. 앱은 연결을 캐시하고 `maxPoolSize: 5`로 제한합니다.

## Vercel 배포

1. GitHub 저장소를 Vercel 프로젝트로 연결하고 Root Directory를 `todo-app`으로 지정합니다.
2. Environment Variables를 **Production과 Preview에 따로** 등록합니다. Preview의 `MONGODB_URI`는 운영과 다른 DB 이름(또는 클러스터)을 가리키게 해서 운영 데이터 오염을 막습니다.
   - `MONGODB_URI`, `SESSION_SECRET`
3. 함수 리전은 `vercel.json`의 `regions`(기본 `icn1`)입니다. **Atlas 클러스터 리전과 가까운 곳으로 바꾸세요.**
4. 배포 후 확인: `GET /api/health`가 200, 로그인 없이 `/api/todos`를 호출하면 401, `/board`는 `/login`으로 이동해야 합니다.
5. 회원가입이 외부에 공개되므로(초대 코드 없음), 로그인·가입 시도 횟수 제한은 앱에 구현되어 있지 않습니다(로그인 실패 시 0.4초 지연만 있음). 외부에 공개한다면 Vercel Firewall의 Rate Limiting을 `/api/auth/login`과 `/api/auth/register`에 적용하세요.

> 이 저장소 작업 환경에서는 Atlas 자격증명이 없어서 실제 Atlas 연결과 Vercel 배포는 수행하지 못했습니다. 위 절차는 코드와 설정이 맞춰져 있다는 전제의 안내이며, 배포 시 4번 항목으로 직접 확인해야 합니다.

## 접근 통제

회원가입(이메일+비밀번호)입니다. 비밀번호는 PBKDF2(SHA-256, salt)로 해시해 저장합니다. 로그인/가입하면 HMAC으로 서명된 `(만료 시각, userId)`를 `httpOnly`, `sameSite=lax`, (운영에서) `secure` 쿠키에 담아 7일간 유지합니다. `proxy.ts`가 `/login`, `/register`, `/api/auth/login`, `/api/auth/register`, `/api/health`를 제외한 모든 경로를 막고, API Route Handler도 같은 검사를 한 번 더 합니다(이중 방어). 모든 데이터는 `userId`로 소유되어 다른 회원의 목표·주간 계획·할 일은 절대 보이지 않고, 남의 리소스 id를 직접 조작하면 404로 처리됩니다.

## API 요약

| 경로 | 설명 |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | 회원가입/로그인/로그아웃, 현재 로그인한 회원의 이메일 조회 |
| `GET/POST /api/todos`, `GET/PATCH/DELETE /api/todos/:id` | 할 일 CRUD(로그인한 회원 소유로만). 필터: `date`, `from`, `to`, `status`, `weeklyPlanId`, `yearGoalId`, `unlinked=true` |
| `PATCH /api/todos/:id/move` | `{status, position}` 드래그 이동 (두 컬럼의 순서를 트랜잭션으로 재배치) |
| `POST /api/todos/carry-over` | `{date}` 미완료를 다음 날로 이월 (상태 유지, 주간 기간 밖이면 연결 해제) |
| `/api/weekly-plans`, `/api/weekly-plans/:id`, `.../impact` | 주간 계획 CRUD와 삭제 영향 건수 |
| `/api/year-goals`, `/api/year-goals/:id`, `.../impact` | 1년 목표 CRUD와 삭제 영향 건수 |

오류 형식은 `{ "error": { "code": "...", "message": "..." } }` 입니다. 주요 코드: `VALIDATION_ERROR`(400), `PERIOD_MISMATCH`(400), `PERIOD_CONFLICT`(409, `count` 포함), `FUTURE_DATE_NOT_ALLOWED`(400, 오늘 이후 날짜로 할 일을 생성/수정 시도), `UNAUTHORIZED`(401), `EMAIL_TAKEN`(409), `INVALID_CREDENTIALS`(401), `NOT_FOUND`(404).

## 설계 메모

- 모든 1년 목표·주간 계획·할 일 문서는 `userId`를 필수로 가지며, 모든 조회·수정·삭제 쿼리가 로그인한 회원의 `userId`로 스코프됩니다(복합 인덱스도 `userId`를 접두사로 둡니다).
- 상위 항목 삭제는 하위 데이터를 지우지 않고 연결만 해제(SetNull)합니다. MongoDB에는 FK가 없어서 삭제 핸들러가 트랜잭션으로 처리합니다.
- 날짜가 있는 할 일은 연결된 주간 계획 기간(`startDate ≤ date ≤ endDate`) 안에 있어야 합니다. 날짜 없는 할 일은 연결할 수 있습니다.
- 날짜는 `YYYY-MM-DD` 문자열(로컬 날짜)로 저장해 타임존 어긋남을 막고, 주는 월요일에 시작합니다.

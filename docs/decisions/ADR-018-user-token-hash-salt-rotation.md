# ADR-018: USER_TOKEN_HASH_SALT Rotation 정책

**상태**: Accepted (v1)
**날짜**: 2026-04-22
**의사결정자**: 3+1 에이전트 합의 (consensus-006) + 사용자 승인 (Q1=b, Q2=a, Q3=a, Q4=a)
**관련 ADR**: ADR-008 (단일 VPS), ADR-011 (digest pin 패턴), ADR-016 (§7 PII, §6 WORM)
**관련 합의**: `docs/review/consensus-005-llm-judge-safety-architecture.md` §커밋2, `docs/review/consensus-006-adr-018-salt-rotation.md`

---

## 맥락 (Context)

PR #3 (MVP-B Session 4) 커밋 `cf03f39` 에서 `USER_TOKEN_HASH_SALT` 가 환경변수로 도입됨 (`env.validation.ts:52-58` min(16) required, fail-closed). `apps/api/src/modules/grading/user-token-hash.ts` 는 `HMAC-SHA256(salt, userId).digest('hex').slice(0, 16)` 순수 함수로 `answer_history.user_token_hash varchar(32) nullable` 컬럼을 채우는 유틸.

`answer_history` 는 Session 5 에서 **ADR-016 §6 WORM 트리거** (REVOKE UPDATE + raise_exception) 가 설치될 테이블. 현재 배선 상태:
- `user-token-hash.ts` 유틸 — 구현 완료
- `answer_history.user_token_hash` 컬럼 — 추가 완료 (Session 4 커밋 2)
- 실 INSERT 경로 — **미배선** (Session 5 예정)
- Langfuse trace metadata 에 주입하는 경로 — **미배선** (Session 5 예정 + 본 ADR D3 Hybrid 전환 반영)

본 ADR 은 Session 5 실 배선 **이전에** salt rotation 운영 정책을 선제 확정하여, 향후 rotation 이 감사 체인을 붕괴시키거나 WORM 트리거와 충돌하지 않도록 한다.

### 배경 문제 (3+1 합의 CRITICAL 4건)

1. **docker-compose.yml salt 주입 누락** (Agent A) — PR #4 로 별도 선행 수선 완료 (`fix/docker-compose-salt`).
2. **Langfuse trace 고아 데이터화** (Agent B) — rotation 시 과거 trace 가 현재 DB hash 와 매칭 불가 → D3 Hybrid 전환으로 **구조 해소** (본 ADR §4).
3. **재계산 migration ↔ WORM 트리거 충돌** (Agent B) — 운영자 유혹 차단 필요 (§8 금지 1).
4. **64-bit truncation 을 학생 식별자로 쓸 때 충돌 위험** (Agent B) — 식별자 사용 금지 명문화 (§8 금지 2).

---

## 결정 (Decision)

### §1. 암호학 / Truncation — **유지**

- 알고리즘: **HMAC-SHA256** (Node `node:crypto.createHmac`).
- 입력: `(salt, userId)` — userId 는 UUIDv4.
- 출력: `digest('hex').slice(0, 16)` — **16 hex chars = 64-bit**.
- 변경 금지 (§8 금지 3).

**근거**: 부트캠프 규모 수강생 수십 ~ 수천 기준 생일 충돌 2^32 ≈ 43억 범위 안전. Argon2/bcrypt (slow hash) 는 "offline brute force 방어" 용도이며 현 공격 모델(공격자가 Langfuse trace 획득 가정) 과 불일치. BLAKE3/KMAC 등 대안은 HMAC-SHA256 생태계 성숙도와 Node 표준 라이브러리 지원 우위를 넘지 못함.

### §2. Key Management — `.env` + `chmod 0400`

현재 조건 (ADR-008 단일 VPS + Docker Compose + 운영자 1인) 에서:
- `.env` 파일 + `chmod 0400` + 호스트 루트 소유 (`chown root:root`).
- Docker Compose `environment:` 로 컨테이너 주입 (기존 `JWT_SECRET` / `LANGFUSE_*` 와 동일 패턴).
- `.env` 는 `.gitignore` 에 포함 (확인 완료).

**향후 재검토 트리거** (본 v1 범위 외):
- (a) 팀 3명+ 도달 → age/sops encrypted-at-rest `.env` 검토.
- (b) 다중 VPS / K8s 전환 → HashiCorp Vault 또는 Docker Swarm secrets 재평가.

**재사용 금지** (§8 금지 5): `USER_TOKEN_HASH_SALT`, `LANGFUSE_SALT`, `JWT_SECRET`, `POSTGRES_PASSWORD`, `LANGFUSE_*` 모든 secret 은 서로 다른 값. 부팅 시 검증 (§7).

### §3. Rotation 주기

| 상황 | 주기 | 절차 공수 |
|------|------|----------|
| 정기 | **365일** | ~30분 (DevOps 운영자 단독) |
| 사고 의심 (salt 유출 의혹) | **24시간 이내** | ~15분 (긴급 재기동 포함) |
| 수강생 >100명 도달 **또는** 연 2회 이상 rotation 시 | R3 (epoch 컬럼) 도입 트리거 | Session 8+ 별도 ADR 개정 |

정기 주기 근거는 JWT_SECRET 동등 취급 관행 + 운영 공수 감당 가능성. 외부 표준 인용은 사용자 결정 Q2=a 에 따라 본 v1 에서 배제 (부록 A 참조).

### §4. Rotation 전략 (사용자 결정 Q1=b, D3 Hybrid 채택 반영)

**핵심 결정**: `user_token_hash` 는 **DB 한정** (감사·분석 전용). Langfuse trace metadata 에는 `session_id` 만 기록하여 rotation 영향권에서 Langfuse 를 **구조적으로 분리**.

**채택 항목**:
- **R1 (단일 salt + 수동 분기 rotation)** — DB `answer_history.user_token_hash` 쓰기 경로에 적용. 정기 365일 + 사고 24h.
- **D3 Hybrid (Langfuse = `session_id` 만)** — Langfuse 는 rotation 무관한 무작위 식별자만 저장. **ADR-016 §7 연쇄 수정** (본 PR 포함).
  - Langfuse trace metadata 에 어떤 형태의 userId 파생 정보(hash 포함) 도 저장 금지.
  - `session_id` 는 DB `grading_sessions.id` 또는 `answer_history.id` 재사용 (별도 신규 컬럼 불필요).
  - 분석 workflow: Langfuse trace 에서 `session_id` → 내부 DB 조회 → userId 매핑 (선택적, 감사 시만).

**유보 항목**:
- **R2 dual-salt overlap** — Session 5 appeal/조회 경로 실 구현 후 "같은 학생 식별자로 서로 다른 hash 를 동시 처리해야 하는 경로가 ≥1건 발생" 트리거 시에만 재평가. 트리거 미충족 시 영구 유보. env `USER_TOKEN_HASH_SALT_PREV` 추가는 ADR-018 별도 개정 사항.
- **R3 epoch 컬럼** (`answer_history.user_token_hash_epoch SMALLINT`) — §3 의 수강생 >100명 or 연 2회+ rotation 트리거 시 도입.

**기각 항목**:
- **R4 per-user HKDF** — overengineering (HMAC 단일 salt 가 이미 per-user 실효 키 파생).
- **R6 주기적 re-hash** — userId 평문 저장 필요 → ADR-016 §7 원칙 역행.
- **Argon2/bcrypt** — 공격 모델 불일치.

### §5. 감사 원장 — `user_token_hash_salt_epochs` 테이블

**목적**: DB 내부 "rotation 이전 구간 / 이후 구간" 구분. Langfuse 역추적 목적은 §4 D3 Hybrid 로 **소멸** — 본 원장은 DB 내부 감사 전용.

**스키마** (Session 5 migration 에서 생성):

```sql
CREATE TABLE user_token_hash_salt_epochs (
  epoch_id         SMALLSERIAL PRIMARY KEY,
  salt_fingerprint CHAR(8)     NOT NULL,  -- sha256(salt).slice(0, 8), salt 평문 금지
  activated_at     TIMESTAMPTZ NOT NULL,
  deactivated_at   TIMESTAMPTZ NULL,
  admin_id         UUID        NOT NULL,
  reason           TEXT        NOT NULL CHECK (reason IN ('scheduled', 'incident')),
  note             TEXT
);

CREATE UNIQUE INDEX ux_user_token_hash_salt_epochs_active
  ON user_token_hash_salt_epochs (activated_at)
  WHERE deactivated_at IS NULL;
```

**기록 규정**:
- salt **평문 저장 절대 금지** — `sha256(salt).slice(0, 8)` fingerprint 만 기록 (ADR-011 digest pin 패턴 동일).
- `admin_id` 는 rotation 을 수행한 운영자의 `users.id` 로 강제.
- 활성 salt 는 항상 1건 (unique partial index 로 강제).

**조회 패턴** (감사 시):
```sql
-- 2026-06-01 ~ 2026-06-15 구간 활성 salt 의 fingerprint 조회
SELECT epoch_id, salt_fingerprint
FROM user_token_hash_salt_epochs
WHERE activated_at <= '2026-06-15'
  AND (deactivated_at IS NULL OR deactivated_at >= '2026-06-01');
```

### §6. `ops_event_log.kind` — `salt_rotation` 추가

**엔티티 변경** (`apps/api/src/modules/ops/entities/ops-event-log.entity.ts:9-16`):

```typescript
export type OpsEventKind =
  | 'student_report_incorrect'
  | 'admin_reject'
  | 'mt3_breach'
  | 'mt4_breach'
  | 'mt6_breach'
  | 'mt7_breach'
  | 'mt8_breach'
  | 'salt_rotation'; // ← 추가
```

**Payload 스키마** (jsonb):

```typescript
{
  prev_fingerprint: string;   // sha256(prev_salt).slice(0, 8). 최초 rotation 시 null 허용
  new_fingerprint: string;    // sha256(new_salt).slice(0, 8)
  rotated_by: string;         // users.id (uuid)
  reason: 'scheduled' | 'incident';
  note?: string;
}
```

### §7. 부팅 검증 확장

`apps/api/src/config/env.validation.ts` 에 `.refine()` 4건 추가:

1. **placeholder 거부** — `production` 모드에서 `USER_TOKEN_HASH_SALT` 가 `changeme`, `test`, `dev`, `placeholder`, `CHANGEME` 등으로 시작하면 부팅 차단.
2. **이중 salt 일치 거부** (R2 트리거 후 적용) — `USER_TOKEN_HASH_SALT_PREV === USER_TOKEN_HASH_SALT` 거부.
3. **secret 재사용 거부** — `USER_TOKEN_HASH_SALT === LANGFUSE_SALT` 또는 `=== JWT_SECRET` 거부.
4. **엔트로피 하한** — 문자열 유일 문자 수 / 길이 ≥ 0.5 (단순 Shannon 근사). 반복 문자열 거부.

**실패 시 로그**: stderr 에 `USER_TOKEN_HASH_SALT_INVALID: <reason>` 태그 → systemd journald 수집 (자세한 알람 연계는 Phase C monitoring).

**non-prod 예외**: `NODE_ENV !== 'production'` 에서 `testonly-` prefix 허용. CI 에서는 `testonly-` prefix 가 붙어있지 않으면 실패 (CI regex 게이트 — Layer 4).

### §8. 금지 사항 (PR 템플릿 체크리스트 편입 — §9)

1. **재계산 migration 금지** — `answer_history.user_token_hash` 를 과거로 거슬러 올라가 새 salt 로 UPDATE 하는 migration/스크립트는 **영구 금지**. ADR-016 §6 WORM 트리거가 DB 레벨에서 동시 차단. 감사 목적은 §5 epoch 원장 조회로 대체.
2. **`user_token_hash` 를 학생 식별자로 사용 금지** — 권한 확인, 세션 귀속, 본인 인증, rate-limit 키, appeal 소유자 확인 등 어떤 경로에서도 `user_token_hash` 값으로 학생을 식별하지 않는다. 오직 DB 내부 감사·분석 집계 용도. 식별은 평문 `userId` 또는 `(userId + epoch)` 쌍 사용.
3. **truncation 폭 16 hex 변경 금지** — 확장 필요 시 별도 ADR + 전체 재계산 금지 (→ 새 컬럼 + 신규 데이터부터 적용).
4. **salt 평문의 로그/이벤트/커밋 등장 금지** — `.env` 외 어디에도 평문 salt 존재 금지. `ops_event_log` / `user_token_hash_salt_epochs` / stderr / 커밋 메시지 모두 fingerprint (sha256 8자) 만 허용.
5. **secret 재사용 금지** — §2 참조.
6. **Langfuse trace metadata 에 userId 파생 정보 저장 금지** (D3 Hybrid — Q1=b) — `user_token_hash`, `hashed_user_id`, `user_fingerprint` 등 어떤 이름으로도 Langfuse 에 저장 금지. `session_id` 만 허용.

### §9. PR 체크리스트 편입

`.github/pull_request_template.md` "MVP-B 채점 파이프라인 체크리스트" 3항에 다음 2항 추가:

- [ ] **salt rotation 관련 변경**: `user_token_hash` UPDATE 경로 신설 없음 + Langfuse metadata 에 userId 파생 정보 주입 없음 + salt 평문 로그 없음. (ADR-018 §8)
- [ ] **부팅 검증 refinement** 추가/변경 시: 기존 4건 (placeholder / 이중 salt / secret 재사용 / 엔트로피) 회귀 없음.

### §10. Session 5 vs Session 8+ 이관

**Session 5 포함** (본 ADR 확정 직후 첫 커밋 가능):
- `user_token_hash_salt_epochs` 테이블 + `answer_history.user_token_hash_epoch` 컬럼 migration (§5)
- `OpsEventKind` `salt_rotation` enum 추가 + CLI (`pnpm ops:rotate-salt` — fingerprint 기록 + 2-step `ADMIN_ACK_SALT_ROTATION` 게이트)
- 부팅 검증 4건 `.refine()` (§7)
- Layer 3 pre-commit gitleaks 패턴 확장 (`salt|hmac|token_hash`)
- Layer 4 CI "재계산 migration 회귀 방지" grep 테스트 (`UPDATE\s+answer_history\s+SET\s+user_token_hash` 차단)
- **production `migrations/` 디렉토리 신설** (WORM 트리거 설치와 동시 진행 필수)
- ADR-016 §7 본문에서 `user_token_hash` 기록 예시 제거 + `session_id` 로 교체 (D3 Hybrid — Q1=b, 본 PR 에서 동시 수정)

**Session 8+ 이관 (유보/조건부)**:
- R2 dual-salt overlap — §4 트리거 시에만
- R3 epoch 전환 — §3 트리거 시에만
- `grader_digest` 에 `saltep:{N}` 포함 — 기존 `GRADER_DIGEST_REGEX` 변경 비용 > 이득, Session 8+ 재검토
- Vault/age/sops 재평가 — §2 미래 트리거

### §11. 긴급 rotation 절차

1. 새 salt 생성: `openssl rand -base64 32` (엔트로피 256-bit).
2. `.env` 에 `USER_TOKEN_HASH_SALT` 신값 + (R2 트리거 후) `USER_TOKEN_HASH_SALT_PREV=<구값>` 동시 기입.
3. `ADMIN_ACK_SALT_ROTATION=&lt;from_fp&gt;:&lt;to_fp&gt;` 환경변수 설정 (2-step 게이트).
4. `docker compose up -d api --force-recreate` (~15초 다운타임).
5. 부팅 성공 확인 → CLI `pnpm ops:rotate-salt --reason=incident` 실행 → `ops_event_log.salt_rotation` + `user_token_hash_salt_epochs` 원장 기록.
6. `ADMIN_ACK_SALT_ROTATION` 환경변수 즉시 제거.

정기 rotation 은 동일 절차 `--reason=scheduled`.

---

## 선택지 (Options Considered)

### 선택지 A — R1 단일 salt + D3 Hybrid + 유보 조항 (채택)

- 장점: 단일 VPS / 운영자 1인 조건에 가장 적합. Langfuse 분리로 rotation 문제 구조적 반감. YAGNI 준수.
- 단점: R2/R3 가 필요해지는 시점에 별도 ADR 개정 필요.

### 선택지 B — R2 dual-salt 즉시 도입

- 장점: 향후 rotation 운영 매끄러움.
- 단점: verify 경로 현재 없음 (A/B 3자 합의 — YAGNI), overlap 기간 유출 위험 2배 (B V3).
- 기각 근거: 사용자 Q3=a 수용.

### 선택지 C — R3 epoch 컬럼 즉시 도입

- 장점: 감사 재현성 최고.
- 단점: `answer_history` 마이그레이션 선제 추가, 현재 수강생 규모에서 과투자.
- 기각 근거: §3 트리거 조건 미충족 시 유보.

### 선택지 D — Langfuse 에 `user_token_hash` 유지 (D3 기각)

- 장점: Langfuse UI 에서 학생 단위 trace 필터 편의.
- 단점: rotation 시 Langfuse 고아 trace (CRITICAL-B2), GDPR/개인정보보호법 감사 부담, PII 공격 표면 확대.
- 기각 근거: 사용자 Q1=b — Langfuse 학생 단위 필터 workflow 불필요로 확정.

---

## 근거 (Rationale)

**채택: 선택지 A (R1 + D3 Hybrid + 유보 조항)**

1. **단일 VPS 조건 ROI** — ADR-008 조건에서 Vault/AWS SM 등 외부 secret 관리 도입은 운영 오버헤드 > 보안 이득. `.env` + `chmod 0400` 이 현실적.
2. **D3 Hybrid 의 구조적 이점** — Langfuse SaaS 측 PII 공격 표면을 `session_id` 만 남겨 소멸시킴. rotation 설계의 절반 이상 복잡도 제거. Langfuse 학생 단위 필터가 실 workflow 에 필수 아니라는 사용자 확인 (Q1=b) 이 전제.
3. **YAGNI (R2/R3 유보)** — 현재 `user_token_hash` 의 실제 쓰기 경로가 0 건. 선제 도입하면 Session 5/8 에서 요구사항 변경 시 재작업 비용.
4. **CRITICAL 4건 전부 해소** — docker-compose 선행 갭(PR #4), 학생 식별자 금지(§8), Langfuse 고아(§4 D3), WORM 충돌(§8) 모두 본 ADR 또는 관련 PR 로 차단.

---

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 기본안 채택 + CRITICAL-1 선행 | `docker-compose.yml` salt 미주입 실측, R2 YAGNI, 재계산 경로 WORM 위반 |
| Agent B (품질) | CRITICAL 3건 격상 요청 | 64-bit 식별자 사용 시 충돌, Langfuse 고아, WORM 충돌 |
| Agent C (대안) | R1+R2 조합 + D3 근본 질문 | R2 1.4× / R3 1.6× ROI, D3 Hybrid 1.5× — Langfuse workflow 확정 필요 |
| **Reviewer** | **A+B+C 통합 + 사용자 Q1=b 로 D3 채택** | CRITICAL 4건 전부 격상, R2 유보 (A 손), D3 Hybrid (C 근본 질문 사용자 확정) |

---

## 결과 (Consequences)

### 긍정적
- Langfuse PII 공격 표면 감소 (D3 Hybrid).
- rotation 이 감사 체인을 붕괴시키지 않는 구조 확보 (§5 epoch 원장 + D3).
- 단일 VPS 조건에서 운영 공수 최소화 (R2/R3 유보).
- WORM 트리거와의 충돌을 선제 차단 (§8 금지 1).
- `user_token_hash` 의 잘못된 사용(학생 식별자) 차단 (§8 금지 2).

### 부정적
- Langfuse UI 에서 학생 단위 trace 필터가 workflow 에 필수가 되는 경우 재설계 비용 (현재 사용자 Q1=b 로 불필요 확정).
- rotation 경계를 넘는 "같은 학생 장기 추적" 이 DB 내부에서도 `user_token_hash` 값 동치로는 불가 — `(userId, epoch)` 쌍 사용 규약 필요.
- Session 5 에 마이그레이션 항목 1건 증가 (`user_token_hash_salt_epochs` + `user_token_hash_epoch` 컬럼).

### 주의사항
- **ADR-016 §7 연쇄 수정 필수** — 본 PR 에 포함 (D3 Hybrid 반영).
- **CLAUDE.md §8 참조 표에 ADR-018 등록** — 본 PR 에 포함.
- **CRITICAL-1 선행 수선** (PR #4) 머지 후 본 PR 진행.
- Session 5 착수 시 본 §10 체크리스트를 **kickoff 템플릿에 복사** 하여 누락 방지.
- 외부 표준 인용은 사용자 Q2=a 에 따라 배제 — 부록 A 에 검증 필요 항목만 기록.

---

## 부록 A — 외부 참고 문헌 (사용자 Q2=a, 미검증 라벨 유지)

본 v1 은 외부 표준 인용을 본문에서 배제한다. 3+1 합의 중 Agent A/B/C 가 참조 가능성으로 언급했으나 Reviewer 직접 검증 범위 외인 항목:

| 출처 | 관련 §/권고 | 상태 |
|------|------------|------|
| OWASP ASVS v4 | §6.4.1 key rotation feasibility-based | 미검증 |
| NIST SP 800-57 Part 1 Rev.5 | §5.3.6 cryptoperiod 3~24개월 | 미검증 |
| NIST SP 800-108 | HKDF 기반 키 파생 | 미검증 |
| ISO 27001 | A.10.1.2 키 관리 통제 | 미검증 |
| GDPR | Art. 30 처리 활동 기록 | 미검증 (법률 자문 필요) |
| 개인정보보호법 | §29 안전성 확보 조치 | 미검증 (법률 자문 필요) |

**검증 필요 시** 별도 부록 개정으로 추가 (`WebFetch` 사전 검증 + 파일 해시 보존 후 인용).

---

## 부록 B — 재평가 트리거 요약 표

| 조항 | 재평가 트리거 | 재검토 시점 |
|------|-------------|-----------|
| R2 dual-salt | "같은 학생 식별자로 서로 다른 hash 동시 처리 경로 ≥1건 발생" | Session 5 appeal 경로 구현 후 |
| R3 epoch 컬럼 | "수강생 >100명 도달 OR 연 2회+ rotation" | Session 8+ |
| Vault/age/sops | "팀 3명+ OR 다중 VPS/K8s 전환" | 조건 충족 시 |
| `grader_digest` `saltep:{N}` 포함 | "감사 쿼리에서 saltep 필터 필요 발생" | Session 8+ |
| truncation 폭 확장 | "수강생 >1만 명 도달" | 별도 ADR 필수 |

---

## 관련 문서

- ADR-008 (Docker Compose 단일 VPS 배포)
- ADR-011 (M3 digest pin — 유사 fingerprint 기록 패턴)
- ADR-016 §6 (answer_history WORM 트리거), §7 (PII — 본 ADR 채택으로 D3 Hybrid 수정)
- `docs/review/consensus-005-llm-judge-safety-architecture.md` §커밋2
- `docs/review/consensus-006-adr-018-salt-rotation.md` (본 ADR 의 전제 합의)
- PR #3 (Session 4) — `cf03f39` 원인 커밋
- PR #4 (`fix/docker-compose-salt`) — CRITICAL-1 선행 수선
- `apps/api/src/modules/grading/user-token-hash.ts` — 구현
- `apps/api/src/config/env.validation.ts:52-58` — env 검증
- `apps/api/src/modules/users/entities/answer-history.entity.ts:86-87` — 컬럼
- `apps/api/src/modules/ops/entities/ops-event-log.entity.ts:9-16` — `OpsEventKind` (Session 5 에서 `salt_rotation` 추가)

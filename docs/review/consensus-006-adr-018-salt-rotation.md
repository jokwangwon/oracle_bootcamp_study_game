# Consensus 006 — ADR-018 USER_TOKEN_HASH_SALT Rotation 정책

**날짜**: 2026-04-22
**의사결정자**: 3+1 에이전트 합의 (Agent A/B/C + Reviewer) + 사용자 승인 대기
**주제**: MVP-B Session 5 착수 전 ADR-018 분리 세션 (사용자 Q2=b 결정)
**관련 ADR**: ADR-008 (단일 VPS), ADR-011 (digest pin 패턴), ADR-016 (§7 PII, §6 WORM)
**관련 합의**: consensus-005 §최상단경보2 (answer_history UPDATE 금지), §커밋2 (HMAC-SHA256 + per-env salt)
**본 세션 범위**: **합의 산출물만** — 코드 변경 없음. ADR-018 본문·env 추가·마이그레이션은 본 합의 수용 후 별도 PR.

---

## 배경

PR #3 (MVP-B Session 4) 이 `c203ffd` 로 main 머지 직후. 커밋 `cf03f39` 에서
`USER_TOKEN_HASH_SALT` 가 `env.validation.ts:55-57` 에 required 로 추가되었고
`user-token-hash.ts` 유틸(HMAC-SHA256 → 16 hex) 과 `answer_history.user_token_hash`
컬럼(varchar(32) nullable) 이 신설되었으나, 실제 **Langfuse trace 주입 / DB 쓰기
경로는 미배선**. Session 5 에서 배선되기 전에 rotation 정책(ADR-018) 을 선제 확정하는
분리 세션이다.

Reviewer 본인 실측 확인:
- `apps/api/src/modules/grading/user-token-hash.ts:23-38` — HMAC-SHA256 + `.slice(0, 16)` 정확. 순수 함수, 캐시 없음.
- `apps/api/src/config/env.validation.ts:52-58` — `USER_TOKEN_HASH_SALT` required, min 16자.
- `docker-compose.yml:229-252` — api 서비스 environment 블록에 `USER_TOKEN_HASH_SALT` **부재 확인** (A CRITICAL-A0 진실).
- `apps/api/src/modules/ops/entities/ops-event-log.entity.ts:9-16` — `OpsEventKind` 에 `salt_rotation` 부재 확인.
- `apps/api/src/modules/users/entities/answer-history.entity.ts:86-87` — `user_token_hash varchar(32) nullable` 컬럼 실재.
- `.env.example:94, 104, 138` — `LANGFUSE_SALT` 와 `USER_TOKEN_HASH_SALT` 가 **별개 변수**로 공존 (재사용 금지 가드 필요 — B GAP-3 유효).
- `apps/api/src/config/typeorm.config.ts:8` production 에서 `synchronize:false`. Glob `apps/api/src/**/migrations/**` **0건** — 즉 production 배포 시 스키마 부재 (A [WARNING] 정확).
- `docs/decisions/ADR-016-llm-judge-safety.md:86-95` (§7) + `:75-82` (§6 WORM) 실재.
- `docs/review/consensus-005-llm-judge-safety-architecture.md:32-34` (§최상단경보2 "answer_history UPDATE 경로 신설 금지") 실재.

---

## 🔴 최상단 경보 (CRITICAL)

**Session 4 교훈 "1인 지적 CRITICAL 격상" 룰 적용 — 보안/감사 체인 무결성은 다수결 대상 아님.**

### CRITICAL-1 (A 단독, Reviewer 실측 재확인) — `docker-compose.yml` salt 미주입 선행 갭

- **근거**: `docker-compose.yml:229-252` api 서비스 environment 블록에 `USER_TOKEN_HASH_SALT` 키 부재. Grep 0건. `env.validation.ts:55-57` 이 required Zod min(16) 이므로 `docker compose up api` 실행 즉시 `USER_TOKEN_HASH_SALT: Required` 부팅 실패.
- **파급**: main 브랜치가 현재 상태 그대로 **모든 환경에서 재기동 불가**. Session 5 의 어떤 작업도 선행 불가능.
- **조치**: ADR-018 과 **독립된 별도 PR (A 공수 0.1인일)**. `environment:` 블록에 `USER_TOKEN_HASH_SALT: ${USER_TOKEN_HASH_SALT}` 1줄 추가. 본 ADR-018 합의 수용과 **분리**하여 즉시 처리 (사용자 확인 1번).

### CRITICAL-2 (B 단독 B2, Reviewer 격상) — Langfuse trace 가 rotation 후 고아 데이터화 / 감사 체인 붕괴

- **근거**: ADR-016 §7 (Reviewer 실측 86-95줄) Langfuse append-only, 과거 trace 수정 불가. `S1→S2` rotation 시 과거 trace 의 `HMAC(S1, userId)` 가 현재 DB 의 `HMAC(S2, userId)` 와 **영원히 매칭 불가**.
- **파급**: "2026-01 ~ 03 trace 에서 학생 X 의 답안 통계" 조회가 수학적 불가능. GDPR Art.30 / 개인정보보호법 §29 감사 로그 의무 위반 위험 (외부 조문 — 추정, 미검증, 사용자 WebFetch 확인 필요).
- **조치**: **`user_token_hash_salt_epochs` 별도 테이블 신설**. 스키마: `epoch_id SMALLINT PK, salt_fingerprint CHAR(8) NOT NULL, activated_at TIMESTAMPTZ, deactivated_at TIMESTAMPTZ NULL, admin_id UUID, note TEXT`. **salt 평문 저장 금지, `sha256(salt).slice(0,8)` fingerprint 만 기록**. 감사 시 "epoch N 기간 trace 는 salt N 으로 HMAC 재계산해 대조" 절차로 역추적 복원. ADR-018 §5 로 편입.

### CRITICAL-3 (B 단독 B3, 3자 간접 합의) — 재계산 migration 의 WORM 트리거 충돌

- **근거**: Session 5 설치 예정 WORM 트리거(ADR-016 §6 + consensus-005 §최상단경보2) 는 `answer_history` UPDATE 를 DB 레벨에서 차단. 운영자가 "감사 복구 의도로 과거 user_token_hash 를 새 salt 로 UPDATE" 시도하면 트리거에 막혀 **"감사 체인 복구 실패 + 재시도 루프"** 발생.
- **파급**: 운영자 유혹 = 실패 경험 반복 → 긴급 상황에서 임시로 WORM 트리거 DROP 하는 최악 시나리오 유도.
- **조치**: ADR-018 §8 (금지 사항) 에 "**과거 `answer_history.user_token_hash` UPDATE 를 통한 재계산 마이그레이션 영구 금지**" 명문화. CRITICAL-2 의 epoch 원장 조회로 대체. PR 템플릿 체크리스트 + Layer 4 CI "migrations/ 디렉토리에 `UPDATE answer_history SET user_token_hash` 패턴 회귀 방지" grep 테스트 추가.

---

## 교차 비교 요약 (19 항목)

| # | 항목 | A | B | C | 채택 |
|---|------|---|---|---|------|
| 1 | 재계산 migration 금지 | 동의 (§6 WORM 위반) | CRITICAL-B3 | R6 기각 근거 동일 | **3자 합의 채택** |
| 2 | `user_token_hash` 를 학생 식별자로 사용 금지 (64-bit 충돌) | 미언급 | CRITICAL-B1 | R3 간접 언급 | **B 격상 채택** — ADR-018 §8 |
| 3 | `ops_event_log` `salt_rotation` kind 추가 | 공수 0.5인일 제시 | V5 지적 | 미언급 | **A+B 합의 채택** |
| 4 | 정기 rotation 주기 365일 + 사고 24h | OWASP ASVS §6.4.1 (추정) | NIST SP 800-57 §5.3.6 3~24개월 (추정) | NIST SP 800-57 Part 1 Rev.5 2년 권고 (추정) | **3자 합의: 365일 + 사고 24h** (외부 인용 전부 미검증 — 사용자 WebFetch 2) |
| 5 | truncation 폭 16 hex (64-bit) 유지 | 순수 함수 구현 적합 | CRITICAL-B1 "변경 금지" 명문화 | 부트캠프 규모 안전 명시 | **채택** — ADR-018 §1 + §8 변경 금지 |
| 6 | Key Mgmt: `.env` + `chmod 0400` | ADR-008 단일 VPS 기준 ROI 최고 | V1 동의 + Docker secrets 언급 | B1 기준안(1.0×), Vault 0.2× | **3자 합의 채택** |
| 7 | Vault/AWS SM 유보 | 규모 확장 시 재검토 | 미언급 | B2 0.2× (팀 3명+), B3 0.4× | **A+C 합의: ADR-018 에 "향후 조건" 만 기록** |
| 8 | 엔트로피 하한 128-bit | 미언급 | GAP-2 | 256-bit salt R5 | **B+C 합의: 최소 128-bit (hex 32자) + 부팅 Shannon 검증** |
| 9 | Dual-salt overlap (R2) 즉시 도입 vs 유보 | 유보 (YAGNI, Session 5 이후) | V3 상한 24h 조건부 | R2 1.4× 즉시 + R3 1.6× 트리거 | **부분 불일치 → Reviewer 판정: 유보 조항 + 트리거 조건 명시** (사용자 확인 3) |
| 10 | `user_token_hash_salt_epochs` 원장 | 미언급 | CRITICAL-B2 | R3 (1.6×) epoch 컬럼 | **B+C 합의 + Reviewer 격상 채택** (CRITICAL-2) |
| 11 | pre-commit gitleaks 패턴에 `salt` | 미언급 | GAP-1 | 미언급 | **B 단독 채택** — Layer 3 hook |
| 12 | `LANGFUSE_SALT` vs `USER_TOKEN_HASH_SALT` 재사용 금지 | 미언급 | GAP-3 부팅 검사 | 미언급 | **B 단독 채택** — Reviewer 실측 `.env.example:104, 138` 별개 변수 확인 |
| 13 | `ADMIN_ACK_SALT_ROTATION` 2-step 게이트 | 긴급 rotation 절차만 언급 | GAP-4 | 미언급 | **B 단독 채택** — 사람 리뷰 Layer |
| 14 | 부팅 검증 placeholder/prev==new 거부 | `.refine` 0.3인일 | GAP-2 (Shannon) 병합 | R5 256-bit 병합 | **A+B+C 통합 채택** |
| 15 | `grader_digest` 에 `saltep:{N}` 포함 | 미언급 | V7 (기존 REGEX 영향 경고) | 미언급 | **B 단독 — 유보 채택** (Session 8+ 재검토, GRADER_DIGEST_REGEX 변경 비용 > 이득) |
| 16 | non-prod salt `testonly-` prefix | 미언급 | GAP-6 | 미언급 | **B 단독 채택** — CI regex 게이트 |
| 17 | D3 Hybrid (Langfuse session_id + DB hash) | 미언급 | 미언급 | 1.5× ROI, 근본 질문 제기 | **C 단독 — Reviewer 결정 유보** (사용자 확인 1 → Langfuse workflow 확정 필요) |
| 18 | docker-compose salt 주입 누락 | CRITICAL (A 단독) | 미언급 | 미언급 | **A 단독 + Reviewer 실측 격상** (CRITICAL-1) |
| 19 | production `migrations/` 디렉토리 부재 | [WARNING] Session 5 선결 | 미언급 | 미언급 | **A 단독 + Reviewer 실측 채택** — ADR-018 §10 Session 5 이관 |

합의율: 19 중 3자 합의 4건 / 2자 합의 6건 / 1자 격상 9건.

---

## ADR-018 채택 정책 (합의 결과)

### §1. 암호학 / Truncation — **유지**

- HMAC-SHA256, truncation 16 hex (64-bit) 유지.
- 근거: 부트캠프 규모 (현재 수십 ~ 향후 수천) 에서 생일 충돌 2^32 ≈ 43억 안전 (A/B/C 3자 계산 일치).
- 변경 금지 (CRITICAL-B1 반영) — §8 금지 사항과 연동.
- Argon2/bcrypt/HKDF 기각 근거 (C A2~A6) ADR-018 appendix 에 표 형태로 기록.

### §2. Key Management — `.env` + `chmod 0400` (단일 VPS 조건)

- ADR-008 단일 VPS + Docker Compose 조건에서 `.env` 파일 + `chmod 0400` + 호스트 루트 소유 유지.
- Docker secrets (`secrets:` 블록) **선택사항** — 단일 VPS 에서는 운영 오버헤드 > 보안 이득.
- "규모 확장 시 재검토" 미래 조항: (1) 팀 3명+ (C B2 조건), (2) 다중 VPS/K8s 전환 — HashiCorp Vault 또는 age/sops (C B5) 재평가.
- `LANGFUSE_SALT` 와 `USER_TOKEN_HASH_SALT` 재사용 금지 부팅 검사 (B GAP-3, Reviewer `.env.example` 실측 확인).

### §3. Rotation 주기

| 상황 | 주기 | 근거 |
|------|------|------|
| 정기 | **365일** | A/B/C 3자 간접 합의 (OWASP/NIST 외부 근거 미검증) |
| 사고 의심 | **24h 이내** | 3자 합의 |
| 수강생 >100명 or 연 2회 rotation 초과 | R3 (epoch id) 전환 트리거 | C 단독 제시, 채택 |

외부 표준(OWASP ASVS §6.4.1, NIST SP 800-57 §5.3.6, ISO 27001 A.10.1.2) 전부 **미검증 — 사용자 WebFetch 확인 필요 (사용자 확인 2)**.

### §4. Rotation 전략

- **즉시 도입**: R1 (단일 salt + 수동 분기) + **epoch 컬럼 선제 설계** (CRITICAL-B2 대응).
  - `answer_history` 는 이미 `user_token_hash` 컬럼 존재. **`user_token_hash_epoch SMALLINT NULL` 컬럼은 Session 5 배선과 함께 추가** (ADR-018 §10 이관).
- **유보**: R2 dual-salt overlap — Session 5 appeal/조회 경로 실 구현 후 필요성 평가. env `USER_TOKEN_HASH_SALT_PREV` 1줄 + helper 1개 (A 공수 1인일).
- **기각**: R4 per-user HKDF (과투자), R6 주기 re-hash (ADR-016 §7 userId 평문 저장 필요 — 역행).
- **조건부 재검토**: C D3 Hybrid (Langfuse session_id + DB hash) — Reviewer 가 **사용자 확인 1** 에서 Langfuse 학생 단위 필터 workflow 필수성을 확정해야 결정.

### §5. 감사 — `user_token_hash_salt_epochs` 원장 (CRITICAL-2)

```sql
CREATE TABLE user_token_hash_salt_epochs (
  epoch_id SMALLSERIAL PRIMARY KEY,
  salt_fingerprint CHAR(8) NOT NULL,  -- sha256(salt).slice(0,8), 평문 금지
  activated_at TIMESTAMPTZ NOT NULL,
  deactivated_at TIMESTAMPTZ NULL,
  admin_id UUID NOT NULL,
  note TEXT
);
```

- salt 평문 저장 절대 금지 (ADR-011 digest pin 패턴 동일).
- 감사 시 "epoch N 기간 trace 는 epoch N 의 salt 로 HMAC 재계산해 대조" 절차 ADR-018 appendix 에 절차서로 기록.
- Session 5 에서 `answer_history` 에 `user_token_hash_epoch` 컬럼 추가 (CRITICAL-B2 대응).

### §6. `ops_event_log` `salt_rotation` kind 추가

- `OpsEventKind` 에 `'salt_rotation'` enum 값 추가.
- payload 스키마: `{ prev_fingerprint: string, new_fingerprint: string, rotated_by: uuid, reason: 'scheduled'|'incident' }`.
- ADR-011 digest pin 이벤트와 동일 패턴.

### §7. 부팅 검증 확장

- `env.validation.ts` 에 `.refine()` 추가:
  1. placeholder 거부 (`changeme`, `testonly-` prod 모드, 빈 문자열 — 이미 min(16))
  2. `USER_TOKEN_HASH_SALT_PREV === USER_TOKEN_HASH_SALT` 거부 (dual-salt 활성화 시)
  3. `USER_TOKEN_HASH_SALT === LANGFUSE_SALT` 거부 (B GAP-3)
  4. Shannon entropy 검사 (최소 128-bit 등가 — 문자열 엔트로피 하한) (B GAP-2 + C R5 통합)
- 부팅 실패 시 stderr/journald 에 `USER_TOKEN_HASH_SALT_MISSING` 태그 기록 (B V4).
- non-prod 환경에서만 `testonly-` prefix 허용, CI regex 게이트 (B GAP-6).

### §8. 금지 사항 (전부 §9 PR 템플릿 체크리스트로 전이)

1. **재계산 migration 금지** (CRITICAL-3) — `answer_history.user_token_hash` UPDATE 절대 금지. Session 5 WORM 트리거로도 차단.
2. **`user_token_hash` 를 학생 식별자로 사용 금지** (CRITICAL-B1) — `grading_appeals` 소유자 확인 / rate-limit 키 등에 평문 userId 또는 `(hash + current_epoch)` 합성 사용. hash 단독 식별자 금지.
3. **truncation 폭 16 hex 변경 금지**.
4. **salt 평문의 로그/이벤트/커밋 등장 금지** — `user_token_hash_salt_epochs` 도 fingerprint 만.
5. **`LANGFUSE_SALT` 와 `USER_TOKEN_HASH_SALT` 재사용 금지**.

### §9. ADR-016 / CLAUDE.md 연쇄 수정

- ADR-016 §7 본문 끝에 `"rotation 정책 → ADR-018"` back-link 추가 (B GAP-7).
- ADR-016 §6 본문에 "WORM 트리거는 ADR-018 §8 재계산 금지 조항의 DB 레벨 시행체" 주석 추가.
- CLAUDE.md §8 참조 표에 ADR-018 등록.

### §10. Session 5 vs Session 8+ 이관 분할

**Session 5 포함 (본 ADR-018 확정 직후)**:
- `user_token_hash_salt_epochs` 테이블 + `answer_history.user_token_hash_epoch` 컬럼 migration (CRITICAL-2)
- `OpsEventKind` `salt_rotation` 추가 + CLI 도구 (`pnpm ops:rotate-salt` — fingerprint 기록 + 2-step `ADMIN_ACK_SALT_ROTATION` 게이트, B GAP-4)
- 부팅 검증 4종 `.refine()` (§7)
- Layer 3 pre-commit `salt` 패턴 + gitleaks (B GAP-1)
- Layer 4 CI "재계산 migration 회귀 방지" grep 테스트 (CRITICAL-3)
- **production `migrations/` 디렉토리 신설** (A [WARNING]) — WORM 트리거 설치와 동시 진행 필수
- **선결**: CRITICAL-1 docker-compose salt 주입 별도 PR (0.1인일)

**Session 8+ 이관 (유보/조건부)**:
- R2 dual-salt overlap (appeal 경로 구현 후 필요성 평가)
- R3 epoch 전환 (수강생 >100명 or 연 2회 rotation 초과 트리거)
- `grader_digest` 에 `saltep:{N}` 포함 (B V7 — 기존 REGEX 변경 비용 > 이득)
- Vault/age/sops 재평가 (팀 3명+ or 다중 VPS 전환)

---

## 🔴 사용자 확인 필요 (4건)

### 1. D3 Hybrid 채택 여부 — 근본 질문 (C 제기)

> **"Langfuse trace 에서 학생 단위 필터가 실제 운영 workflow 인가?"**

- **필수**: R1/R2/R3 경로 유지 (현재 설계, §4 그대로).
- **불필요**: D3 Hybrid 전환 — Langfuse 에는 `session_id` 만 (DB 의 `grading_session.id` 그대로 재사용), `user_token_hash` 는 DB 만 저장. **rotation 문제가 구조적으로 반감** (Langfuse 고아 trace 문제 소멸, CRITICAL-2 의 `user_token_hash_salt_epochs` 원장 필요성은 감사 목적으로만 축소).

**Reviewer 판단 보조**: 현재 `prompt-manager.ts` / Session 4 masker wrapper 코드에서 Langfuse `metadata.user_token_hash` 주입 경로가 **아직 없음** — 구조 전환 비용 제로. 사용자 workflow 확정이 유일한 결정 변수.

### 2. 외부 표준 인용 허용 범위

- A/B/C 가 인용한 OWASP ASVS §6.4.1 / NIST SP 800-57 §5.3.6 / Part 1 Rev.5 / SP 800-108 / ISO 27001 A.10.1.2 / GDPR Art.30 / 개인정보보호법 §29 / Sweeney 2002 / De Montjoye 2013 — **Reviewer 전부 검증 불가 (외부 URL 범위 외)**.
- ADR-018 본문에 인용 시 `WebFetch` 로 사전 검증 후 인용하거나, "(추정, 미검증)" 라벨을 명시적으로 유지하거나 — 사용자 방침 결정 필요.

### 3. Dual-salt R2 즉시 도입 vs 유보

- A: YAGNI 유보 (verify 경로 현재 없음 — 실측 정확). Session 5 이후.
- C: R2 1.4× ROI 즉시 (env 1줄 + helper 1개, 마이그레이션 0).
- **Reviewer 잠정 판정: A 손 — §4 유보**. 근거: (1) appeal/조회 경로 실 구현 전 verify 경로 부재, (2) overlap 기간 유출 위험 2배 (B V3) 는 실체. (3) C 의 ROI 계산은 YAGNI 비용 포함 안 함.
- 단 사용자가 **"Session 5 초반 1인일 내에 R2 환경 변수 1줄만 선제 도입"** 선호 시 수용 가능.

### 4. CRITICAL-1 docker-compose 선행 갭 — 별도 PR 우선순위

- 본 ADR-018 합의 수용 **이전** 에 즉시 (0.1인일) vs ADR-018 PR 에 포함 vs Session 5 첫 커밋에 포함 — 3가지 옵션. Reviewer 추천: **즉시 별도 PR** (main 재기동 불가 상태 방치 위험).

---

## 채택하지 않은 의견 (참고용)

- **Agent C R4 (per-user HKDF derived salt)**: "ROI 0.6×, overengineering" — C 스스로 기각. 채택 안 함.
- **Agent C A3 (BLAKE3)**: 속도 이득 미미 (userId 문자열 16 hex 1회 연산). HMAC-SHA256 생태계 성숙도 우위. 채택 안 함.
- **Agent B V6 `grading_appeals` rate-limit 키 collision**: 채택 대상이지만 §8 금지 2번 (식별자 사용 금지) 에 포함되므로 별도 항목 불필요. 흡수.
- **Agent A "Vault 운영 오버헤드 > 보안 이득"**: 단일 VPS 조건 한정 정당, ADR-018 §2 미래 조항에 조건부 기록.

---

## 위험도 평가

| 등급 | 항목 | 출처 Agent | 대응 계층 |
|------|------|-----------|---------|
| CRITICAL | docker-compose salt 미주입 — 부팅 실패 | A + Reviewer 실측 | 즉시 별도 PR (Layer 4 CI) |
| CRITICAL | Langfuse trace 고아 데이터화 — 감사 체인 붕괴 | B CRITICAL-B2 + Reviewer 격상 | ADR-018 §5 + Session 5 migration |
| CRITICAL | 재계산 migration ↔ WORM 트리거 충돌 | B CRITICAL-B3 + A WORM 위반 경고 | ADR-018 §8 + Layer 4 CI grep |
| CRITICAL | 64-bit truncation 을 학생 식별자로 사용 시 권한 누수 | B CRITICAL-B1 | ADR-018 §8 금지 명문 |
| WARNING | production `migrations/` 디렉토리 부재 | A + Reviewer 실측 | Session 5 WORM 트리거와 동시 |
| WARNING | overlap 기간 유출 위험 2배 | B V3 | R2 유보 + 상한 24h 조건 |
| WARNING | `LANGFUSE_SALT` 재사용 | B GAP-3 + Reviewer `.env.example` 실측 | §7 부팅 검증 |
| WARNING | 외부 표준 인용 미검증 | A/B/C 3자 전부 | 사용자 확인 2 |
| INFO | Langfuse trace 주입 경로 현재 0건 | A | ADR-018 향후 대비 성격 |

---

## 권장 행동 (우선순위순)

1. **[즉시/별도 PR]** `docker-compose.yml:229-252` api environment 블록에 `USER_TOKEN_HASH_SALT: ${USER_TOKEN_HASH_SALT}` 추가 (CRITICAL-1). — 사람 리뷰 + 하네스 CI (main 기동 smoke 테스트).
2. **[사용자 결정 블록]** 사용자 확인 1~4 응답 수렴. 특히 **D3 Hybrid (확인 1) 의 방향이 ADR-018 §4 전체 구조를 바꿈** — 선결 필수.
3. **[ADR-018 본문 작성]** 본 합의 수용 후 `docs/decisions/ADR-018-user-token-hash-salt-rotation.md` 신설. 본 consensus-006 §1~§10 그대로 편입. 외부 표준 인용은 사용자 확인 2 방침에 따름.
4. **[Session 5 착수]** Session 5 첫 커밋에 §10 Session 5 포함 항목 일괄 — WORM 트리거 + epochs 원장 + salt_rotation kind + 부팅 검증 + pre-commit + CI grep + migrations 디렉토리.
5. **[Session 8+ 이관 기록]** CONTEXT.md 에 R2/R3/Vault 재평가 트리거 조건 기재.

---

## 인용 실재 확인

### Reviewer 직접 실측 (8건)

| 파일 | 라인 | 확인 내용 |
|------|------|----------|
| `apps/api/src/modules/grading/user-token-hash.ts` | 23-38 | HMAC-SHA256 + `.slice(0,16)` — A/B/C 3자 인용 전부 정확 |
| `apps/api/src/config/env.validation.ts` | 52-58 | `USER_TOKEN_HASH_SALT` required z.string().min(16) |
| `docker-compose.yml` | 229-252 | api environment 블록에 salt 부재 — **A CRITICAL 확인** |
| `apps/api/src/modules/ops/entities/ops-event-log.entity.ts` | 9-16 | `OpsEventKind` 에 `salt_rotation` 부재 확인 (A+B 지적 정확) |
| `apps/api/src/modules/users/entities/answer-history.entity.ts` | 86-87 | `user_token_hash varchar(32) nullable` 실재 |
| `.env.example` | 94, 104, 138 | `LANGFUSE_SALT` / `USER_TOKEN_HASH_SALT` 별개 변수 (B GAP-3 기반 확인) |
| `apps/api/src/config/typeorm.config.ts` | 8 | production `synchronize:false` + `migrations/` Glob 0건 (A [WARNING] 확인) |
| `docs/decisions/ADR-016-llm-judge-safety.md` | 86-95 (§7), 75-82 (§6) | §7 `user_token_hash` / §6 WORM 명문 실재 |
| `docs/review/consensus-005-llm-judge-safety-architecture.md` | 32-34 | "answer_history UPDATE 경로 신설 금지" 명문 실재 |

### Agent 자기 인증 — Reviewer 검증 범위 외 (미검증 라벨 유지)

| 인용 | 출처 Agent | 상태 |
|------|-----------|------|
| OWASP ASVS v4 §6.4.1 | A, B | 미검증 — 사용자 WebFetch 필요 |
| NIST SP 800-57 Part 1 Rev.5 §5.3.6 | B, C | 미검증 |
| NIST SP 800-108 | C | 미검증 |
| ISO 27001 A.10.1.2 / A.8.2 / A.8.10 | B, C | 미검증 |
| GDPR Art.30 / 개인정보보호법 §29 | B | 미검증 |
| Sweeney 2002 / De Montjoye 2013 k-anonymity | B | 미검증 |
| Ollama/Langfuse 메모리 덤프 공격 | B | 미검증 |
| OpenAI `user` / Anthropic `metadata.user_id` 관행 | C | 미검증 |
| Coursera/Khan/Duolingo 운영 사례 | C | 미검증 |
| HashiCorp Vault / Docker Swarm 운영 비용 비교 | A | 미검증 |

Reviewer 는 **한 건도 WebFetch/WebSearch 수행하지 않았다** (본 세션 범위 외 + Agent C 도 동일 고지).

---

## 메타 평가

### 인용 실재 확인 규칙 준수도

| Agent | 코드 인용 정확도 | 외부 인용 처리 |
|-------|----------------|--------------|
| A | **9/9 실측 일치** (Reviewer 재검증) | "(추정, 미검증)" 라벨 명시 — 양호 |
| B | **10/10 실측 일치** (Reviewer 재검증) | 일부 조문/연구 인용에 라벨 누락 ("위반 위험" 단언) — 개선 여지 |
| C | **인용 실측 없음** (대안 비교 중심) | 산업 레퍼런스 섹션 끝에 "WebSearch/WebFetch 미수행" 자기 고지 — 양호 |

### 합의율

- 3자 합의: 4 / 19 (21%)
- 2자 합의: 6 / 19 (32%)
- 1자 격상 (Reviewer 다수결 무시): 9 / 19 (47%) — 보안 주제 특성상 높음
- 유효 이견 반영: R2 유보(A 손) / CRITICAL-1 격상(A 단독) / CRITICAL-B1/B2/B3 격상(B 단독) / D3 Hybrid 사용자 확인 유보(C 단독 근본 질문) — **총 6건이 최종 판정에 반영**

### 1개 Agent 만 짚은 CRITICAL

- **4건** (A CRITICAL-1 docker-compose, B CRITICAL-B1 truncation 식별자, B CRITICAL-B2 Langfuse 고아, B CRITICAL-B3 WORM 충돌).
- 모두 **Reviewer 가 격상 채택** — Session 4 교훈 "보안 CRITICAL 은 다수결 대상 아님" 룰 적용.

### reviewer.md 개선 후보 (Session 4 교훈 반영 확인)

- ✅ Session 4 교훈 "1인 지적 CRITICAL 격상" 룰 — 본 세션에서 정확히 4건 적용.
- ✅ "인용 실재 확인" 규칙 (Reviewer 실측 재검증 최소 3개 이상) — 9건 초과 달성.
- ✅ "외부 URL 은 Reviewer 범위 외" 규칙 — 사용자 확인 2로 투명 격리.
- 🔶 추가 제안: 향후 reviewer 지시서에 **"production migrations/ 디렉토리 부재 같은 구조적 갭은 본 주제 범위 외이더라도 CRITICAL 으로 격상 가능"** 명문 — 본 세션에선 [WARNING] 유지했으나 Session 5 착수 시 CRITICAL 격상 가능성 있음.
- 🔶 추가 제안: Agent 출력에 **"외부 인용 미검증 라벨 의무"** 체크리스트 (B 가 일부 누락 — "위반 위험" 단언 등).

---

## 끝 — 사용자 승인 대기

본 합의 수용 후 작업 순서:
1. CRITICAL-1 별도 PR (사용자 확인 4 에 따라 우선순위 결정)
2. 사용자 확인 1~4 응답 수렴
3. ADR-018 본문 작성 (`docs/decisions/ADR-018-user-token-hash-salt-rotation.md`)
4. CLAUDE.md §8 참조 표 + ADR-016 back-link 동시 수정
5. CONTEXT.md / INDEX.md 동기화
6. Session 5 kickoff

---

## 사용자 결정 반영 (2026-04-22)

본 합의 보고서 수렴 즉시 사용자가 4건 모두 회신. 아래 결정 반영:

| # | 질문 | 사용자 선택 | ADR-018 본문 영향 |
|---|------|------------|------------------|
| **Q1** | Langfuse 학생 단위 필터 workflow 필수성 | **b. 불필요 → D3 Hybrid 채택** | **§4 Rotation 전략 구조 전환**. Langfuse metadata 에는 `session_id` (DB `grading_sessions` 재사용) 만. `user_token_hash` 는 DB 한정. rotation 문제 **구조적 반감** — Langfuse 고아 trace 불가능 (session_id 는 rotation 무관). `user_token_hash_salt_epochs` 원장은 DB 감사 목적으로만 축소 유지. **ADR-016 §7 연쇄 수정 필수.** |
| **Q2** | 외부 표준 인용 범위 | **a. WebFetch 로 사전 검증 후만 인용** | ADR-018 본문은 **외부 표준 인용 자체 최소화**. 필요 시 부록에 WebFetch 검증본만 수록. 본 v1 은 코드 + 합의 근거만으로 정당화 (OWASP/NIST/ISO/GDPR/개인정보보호법 인용 제거). |
| **Q3** | Dual-salt R2 즉시 도입 vs 유보 | **a. 유보 (Reviewer 판정 수용)** | §4 R2 유보 조항 유지. Session 5 appeal 경로 실 구현 후 필요성 재평가. env `USER_TOKEN_HASH_SALT_PREV` 추가는 트리거 시점에. |
| **Q4** | CRITICAL-1 docker-compose 선행 갭 | **a. 즉시 별도 PR** | ADR-018 합의 수용 **이전** 에 별도 PR 처리 (2026-04-22 완료 — PR #4). ADR-018 본 PR 은 이 수선 후 진행. |

### D3 Hybrid 채택 (Q1=b) 의 구체 영향

**ADR-016 §7 수정 범위**:
- "Langfuse Trace 속성" 예시(90-99줄) 에서 `user_token_hash` 필드 **제거**, 대신 `session_id` 기록.
- §7 본문 문장 "userId는 해시된 `user_token_hash`로 변환하여 trace metadata에 삽입" → "userId 는 Langfuse trace metadata 에 어떤 형태로도 삽입 금지. Langfuse 에는 `session_id` (내부 DB `grading_sessions.id` 또는 `answer_history.id`) 만 기록" 로 교체.
- `user_token_hash` 의 목적은 **DB 내부 감사·분석 전용** 으로 한정 명시.

**ADR-018 §4 "Rotation 전략" 의 문제 공간 축소**:
- Langfuse 측 rotation 영향 항목 **전부 소멸** (CRITICAL-B2 범위 축소).
- `user_token_hash_salt_epochs` 원장 필요성 **완화** — DB 내부 감사 쿼리 ("rotation 이전 구간 / 이후 구간" 분할) 용도로만 유지. Langfuse 역추적 목적 제거.
- CRITICAL-B2 위험도 **CRITICAL → WARNING** 으로 하향 (Langfuse SaaS 경계 밖으로 PII 유출 경로 자체 제거되므로).

**사용자 결정의 추가 이득**:
- Langfuse PII 공격 표면 감소 — session_id 는 공격자에게 학생 식별 정보 제공 불가.
- GDPR/개인정보보호법 감사 의무 부담 완화 — Langfuse SaaS 측 PII 처리 기록 의무 자체 소멸.
- Session 4 선행 PR `MaskingLangfuseCallbackHandler` 의 필요 범위 축소 (여전히 rationale 마스킹 목적으로 유지).

**구현 부담 추정 변화 (Session 5 반영)**:
- `user_token_hash_salt_epochs` 원장 → Session 5 에서 **간단 감사 테이블로 축소** (fingerprint 필수, audit 목적 단순화).
- `MaskingLangfuseCallbackHandler` 에 `user_token_hash` 마스킹 로직 제거 가능 (Session 5 시 일괄 정리).
- ADR-016 §7 back-link + 본문 수정 → ADR-018 PR 에 함께 포함.

### Q2=a 방침의 ADR-018 본문 처리

- 본 ADR-018 v1 은 **외부 표준 인용 zero** 로 작성.
- "rotation 주기 365일" 등 수치의 근거는 "업계 통상 관행 + 운영 공수 감당 가능성 + incident response 옵션 유지" 로 **코드/운영 현실 기반 근거만** 사용.
- 부록 A "외부 참고 (미검증)" 섹션 신설 — 향후 사용자 WebFetch 검증 후 별도 부록 개정 가능. 본 v1 승인 기준은 외부 표준 의존 zero.

### Q3=a 유보 조항 최종 문구

- ADR-018 §4 R2 조항: "R2 dual-salt overlap 은 Session 5 appeal/조회 경로 실 구현 후 **"같은 학생 식별자로 서로 다른 hash 를 동시 처리해야 하는 경로가 ≥1건 발생"** 을 트리거로 재평가. 트리거 미충족 시 영구 유보. env `USER_TOKEN_HASH_SALT_PREV` 추가는 ADR-018 별도 개정 사항."
- 본 v1 에는 env 스키마 변경 없음.

### Q4=a 결과 (사후 보고)

- PR #4 (`fix/docker-compose-salt` 브랜치) — 2026-04-22 생성, `docker-compose.yml:229-252` api environment 블록에 `USER_TOKEN_HASH_SALT: ${USER_TOKEN_HASH_SALT}` 1줄 추가. Pre-commit typecheck/test 통과.
- 본 ADR-018 PR 은 PR #4 머지 후 진행.

---

### 사용자 결정 이후 수정된 §4 / §5 요약

**§4 Rotation 전략 (Q1=b 반영)**:
- R1 (단일 salt + 수동 분기) — DB 쪽만 유지.
- Langfuse 경로: `session_id` 기록 (rotation 무관).
- R2 dual-salt — 유보 (Q3=a).
- R3 epoch 컬럼 — 수강생 >100명 or 연 2회 rotation 초과 트리거 시 도입.
- R4/R6 기각 유지.
- **D3 Hybrid 채택 명문화** — "Langfuse 에는 학생 식별 정보(해시 포함) 저장 금지" 조항.

**§5 감사 원장 (Q1=b 반영)**:
- `user_token_hash_salt_epochs` 테이블 유지 (DB 감사 목적). 스키마 동일.
- Langfuse 역추적 목적 조항 제거.
- Session 5 배선 범위 축소 — DB 내부 "같은 학생 장기 추적" 만 대상.

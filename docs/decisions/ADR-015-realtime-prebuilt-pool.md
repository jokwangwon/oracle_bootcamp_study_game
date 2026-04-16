# ADR-015: 실시간 대전 재정의 — 사전 생성 문제 풀 기반 랜덤 매칭

**상태**: Accepted
**날짜**: 2026-04-16
**의사결정자**: 3+1 에이전트 합의 + 사용자 최종 결정
**관련 합의**: `docs/review/consensus-004-problem-format-redesign.md`
**관련 ADR**: ADR-008 (기술 스택), ADR-011 (M3 운영 모델), ADR-013 (채점)

---

## 맥락 (Context)

SDD v2.8 §1.3은 "게임 모드: 솔로 / 랭킹 경쟁 / 실시간 멀티플레이어"를 명시. §2.1 아키텍처는 **Modular Monolith + Socket.IO WebSocket Gateway**. 실시간 대전(§6.2)은 MVP 3단계 배치.

3+1 합의(consensus-004) 핵심 쟁점:

- **Agent B**: "챌린지 완결형" 결정이 SDD §1.4 "자주 접속" 전제와 정면 충돌 → 반복 동기 레이어 필수
- **Agent C**: Socket.IO 실시간 대전 우선순위 하향 + 비동기 주간 리그로 대체 권고
- **Agent A**: 실시간 중 AI 문제 실시간 생성 시 p95 지연 불확실성(ADR-011 C7 게이트 연계)

Reviewer 1차 권고: 실시간 대전 강등.
**사용자 최종 결정**:

> "실시간은 유지하지만 문제 유형을 정하여 실시간 AI 문제 출력이 아닌 이미 생성된 문제들 중 랜덤으로 진행합니다."

→ Socket.IO 실시간 경로 유지. 실시간 AI 생성만 배제.

## 결정 (Decision)

**Socket.IO 실시간 대전을 유지하되, 실시간 AI 문제 생성을 금지하고 사전 생성·관리자 승인된 문제 풀에서 랜덤 매칭한다.**

### 매칭 아키텍처

```
[Client A] ──┐
             ├─→ [Socket.IO Gateway]
[Client B] ──┘          │
                        ▼
            [MatchService.startBattle()]
                        │
                        ├─→ 주차/주제/answerFormat 필터
                        │
                        ▼
            [Question Pool Query]
              WHERE status = 'approved'
                AND week <= user.current_week
                AND answer_format IN (allowed_formats)
              ORDER BY RANDOM()
              LIMIT N
                        │
                        ▼
            [Redis Battle State]
              (라운드별 문제 ID + 제출 현황)
                        │
                        ▼
            [WebSocket broadcast to both clients]
```

### 핵심 제약

1. **실시간 중 AI 호출 0건** — 문제 생성은 사전에 BullMQ 워커가 수행. 실시간 세션은 DB 조회만.
2. **`status='approved'` 강제** — `pending_review` 문제는 실시간 매칭 대상에서 제외. 관리자 승인된 문제만 사용.
3. **모드/형식 제한** — 실시간은 짧은 판정이 필요하므로 초기 지원:
   - `multiple-choice` (단일 선택 지원 시 ≤ 3초 판정)
   - `single-token` (빈칸 1개)
   - `output-select` (테이블 선택)
   - **`free-form` 실시간 금지** — 채점 지연 우려. 솔로/캡스톤 전용.
4. **주차 동기화** — 두 플레이어의 `current_week` 교집합 내에서만 매칭.
5. **라운드 수 / 타임아웃** — 5문제 / 문제당 60초 / 배틀당 최대 10분.

### 사전 생성 파이프라인 (BullMQ + AI Pipeline 재활용)

- 기존 `AiQuestionGenerator` + BullMQ processor 재활용
- 신규 cron job `realtime-pool-refill` — 매일 주차별 `approved` 문제 수 하한 확인
  - 기준: 각 주차 × answerFormat 조합당 최소 50문제 유지
  - 하한 미만 시 생성 배치를 큐에 추가
- 생성 → `pending_review` → 관리자 승인 → `approved` 상태 전환 후 실시간 풀 진입

### 주간 릴리스 리듬 (접속 동기)

- 매주 관리자가 "신규 approved 문제 배치"를 공개 → 실시간 풀 갱신
- 학생 UI에 "이번 주 새 문제 N개 추가됨" 배너
- `user_progress`에 `weekly_new_questions_seen` 기록 → "오늘의 챌린지" 유도

## 선택지 (Options Considered)

### 선택지 A: 실시간 유지 + 사전 생성 풀 기반 (채택, 사용자 결정)
- 장점: Socket.IO 운영 부담 유지하되 p95 지연 불확실성 제거. ADR-011 C7 게이트 영향 없음.
- 단점: 실시간 풀 관리 비용(사전 생성 + 관리자 승인 + 하한 유지).

### 선택지 B: 실시간 + 실시간 AI 생성 (원안)
- 장점: 콘텐츠 무한 공급.
- 단점: M3 p95 44.9s는 실시간 라운드에 부적합. 실시간 중 AI 호출 시 timeout/retry 복잡성.

### 선택지 C: 실시간 강등 + 비동기 주간 리그 (Agent C 원안)
- 장점: Socket.IO 제거로 운영 부담 감소.
- 단점: **사용자 거부**. SDD §1.3 "실시간 멀티플레이어" 특성 후퇴. Socket.IO 인프라 매몰비용 폐기.

### 선택지 D: 실시간 유지 + 문제 풀 + 관리자 승인 없이
- 장점: 풀 제약 완화.
- 단점: 품질 미검증 문제가 실시간에 노출 → 사용자 신뢰 훼손 리스크.

## 근거 (Rationale)

**채택: 선택지 A**

- **사용자 최종 결정 직접 반영**.
- **ADR-011 C7 게이트(p95 ≤ 60s) 우회** — 실시간 중 AI 호출 없으므로 Ollama 지연 무관.
- **SDD §1.3 "실시간 멀티플레이어" 특성 보존** — Socket.IO 인프라 매몰비용 활용.
- **품질 보장** — `approved` 강제로 사용자 실시간 경험 품질 담보.
- **기존 관리자 review 흐름(`pending_review`) 재활용** — 신규 구조 최소화.
- **주간 릴리스 리듬으로 "자주 접속" 동기 확보** — Agent B 지적 §1.4 모순 해소.
- **`free-form` 실시간 제외** — ADR-013 3단 채점 파이프라인 지연(Layer 3 평균 +2~5초)이 실시간 부적합. 솔로/캡스톤 전용.

## 3+1 에이전트 합의 결과

| 에이전트 | 의견 | 핵심 근거 |
|---------|------|----------|
| Agent A (구현) | 실시간 중 AI 호출 배제 필요 | ADR-011 C7 p95 44.9s는 실시간 라운드 부적합. 사전 풀 구축이 해법 |
| Agent B (품질) | 주간 릴리스로 §1.4 모순 해소 | "챌린지 완결형" + "자주 접속" 2중 구조. approved 강제로 품질 담보 |
| Agent C (대안) | 비동기 리그전 대체 제안했으나 사용자 결정 수용 | Socket.IO 매몰비용 활용 관점에서 선택지 A도 합리적 |
| **Reviewer** | **선택지 A 채택 (사용자 최종 결정)** | 사용자 결정 + 3자 제약 동시 해소 |

## 결과 (Consequences)

### 긍정적
- ADR-011 M3 p95 불확실성이 실시간에 전파되지 않음
- SDD §1.3 실시간 특성 보존 + Socket.IO 인프라 활용
- `approved` 강제로 실시간 품질 담보
- 주간 릴리스로 "자주 접속" 동기 확보 → SDD §1.4 모순 해소

### 부정적
- 사전 생성 풀 하한 관리 비용 (cron + 관리자 승인 큐)
- `free-form` 실시간 미지원 → UX 일부 제한
- 주차 동기화 매칭이 20명 규모에서 매칭 실패 가능 (대기열 timeout 정책 필요)

### 주의사항
- **`realtime-pool-refill` cron** — 주차별 × answerFormat 조합당 50문제 하한 유지 알람.
- **관리자 review UI 우선순위 상승** — 실시간 풀 유지를 위해 승인 지연 ≤ 24시간 목표.
- **매칭 대기열 timeout 정책** — 30초 이내 매칭 실패 시 AI 봇 매칭(선택지 E 옵션) 또는 솔로 모드 전환.
- **`free-form` 제외 정책 명시** — SDD §6.2에 실시간 지원 `answerFormat` 화이트리스트 기술.
- **`pending_review` → `approved` 자동 전환 금지** — 인간 검토 유지(품질 가드).
- **실시간 랭킹 기록** — Redis ZADD로 실시간 배틀 결과 반영 (SDD §10.1 재사용).
- **MatchService 신설 필요** — `apps/api/src/modules/game/services/match.service.ts` 분리. 기존 `game-session.service.ts`는 솔로 전용.

---

**관련 문서**:
- `docs/review/consensus-004-problem-format-redesign.md`
- `docs/architecture/oracle-dba-learning-game-design.md` §1.3/§6.2 (v2.9 개정 예정)
- ADR-008 (Socket.IO 스택), ADR-011 (M3 지연), ADR-013 (채점)

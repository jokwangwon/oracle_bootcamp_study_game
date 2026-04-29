# PR-12 — 외부 노트북 검증 체크리스트

> **PR-12 web 토론 페이지 (Phase 4~7 코드 PR) 머지 전 외부 노트북 (Tailscale) 검증 가이드. 본 PR 단독 axe DevTools / 키보드 풀 플로우 / 모바일 시각.**

| 메타 | 값 |
|------|-----|
| 합의 ID | consensus-012 |
| 의존 PR | PR-10a/10b/10c 머지 ✓ + Phase 1~3 (PR #59) 머지 ✓ |
| TDD plan §8.3 | 본 문서로 구체화 |

---

## 1. 사전 환경 확인

- [ ] API 컨테이너 가동 (`sudo docker compose ps api` → `Up`).
- [ ] `.env` `ORIGIN_GUARD_MODE=report` (또는 `disabled` for testing).
- [ ] 외부 노트북에서 Tailscale 접속 → `http://100.102.41.122:3002` 응답 확인.
- [ ] 라이트/다크 토글 양쪽 화면 정상 (Header 우상단 토글).

---

## 2. 라이트/다크 axe DevTools (외부 노트북 Chrome 확장)

axe DevTools 1.x 이상 설치 후 5개 화면 각 라이트·다크 양쪽 (총 10회 스캔):

- [ ] `/` (Home) — 라이트 0 violation / 다크 0 violation
- [ ] `/play/solo` — finished phase 진입 후 "토론 보기" 링크 표시 확인
- [ ] `/play/solo/[questionId]/discussion` — 토론 목록 (sort 탭 / composer)
- [ ] `/play/solo/[questionId]/discussion/[threadId]` — 상세 (post tree / vote)
- [ ] `/play/solo/[questionId]/discussion/[threadId]` — RelatedQuestionBlur 노출
  (미풀이 user 로 다른 user 의 post 가 isLocked 인 경우)

---

## 3. 키보드 풀 플로우 (Tab + ←→ + Enter)

`/play/solo/[questionId]/discussion` 에서:

- [ ] Tab 1회 — "← 문제로 돌아가기" 링크 포커스
- [ ] Tab 2회 — sort tab "최신" 포커스 (role=tab + tabIndex=0)
- [ ] ←→ — sort tab 좌우 이동 (KeyboardEvent.ArrowLeft/Right 핸들러)
- [ ] Tab 3회 — "+ 새 토론" 버튼 포커스
- [ ] Enter — composer 토글
- [ ] Tab 후 Tab — composer 의 제목 input → 본문 textarea → 제출 버튼 순서
- [ ] Tab — 첫 ThreadCard 포커스 (Link)
- [ ] Enter — `/play/solo/[questionId]/discussion/[threadId]` 라우팅

`/play/solo/[questionId]/discussion/[threadId]` 에서:

- [ ] Tab — "← 토론 목록" 링크
- [ ] Tab — VoteButton 좋아요 → 점수 → 싫어요 (3개)
- [ ] Tab — DiscussionMarkdown 안의 a 태그 (있다면)
- [ ] Tab — 답글 / 채택 가능 버튼
- [ ] Tab — 답변 작성 textarea → 제출

---

## 4. Vote 흐름 (라이브 동작 검증)

- [ ] ▲ 클릭 — score 즉시 +1 (optimistic)
- [ ] 같은 ▲ 다시 클릭 — score 0 (토글, optimistic)
- [ ] 다른 사용자의 thread 에서 ▼ 클릭 — score -1
- [ ] 자기 thread 에서 ▲ 클릭 — disabled (버튼 비활성)
- [ ] 분당 5회 초과 — "분당 5회 한도" 토스트 + score rollback
- [ ] Network 탭 — `POST /api/discussion/threads/.../vote` 200 응답
- [ ] 새로고침 후 — 서버 finalScore 와 myVote 가 클라 표시와 일치

---

## 5. RelatedQuestionBlur (HIGH-3 이중 방어)

미풀이 사용자로 (다른 계정 또는 user_progress 미설정) 진입:

- [ ] post.isLocked=true + relatedQuestionId 존재 시 글라스 패널 표시
- [ ] body=`[[BLUR:related-question]]` 토큰이 화면에 노출되지 않음 (서버 마스킹)
- [ ] "🔒 관련 문제 풀이 후 공개됩니다" 한국어 안내
- [ ] "문제 풀러 가기 →" 클릭 → `/play/solo/[relatedQuestionId]` 라우팅
- [ ] 풀이 후 동일 thread 재방문 — 본문 정상 노출

---

## 6. 모바일 (375px) 시각

DevTools Device Mode → iPhone 12 Pro (390x844) 또는 iPhone SE (375x667):

- [ ] `/play/solo/[questionId]/discussion` ThreadList 1 column (이미 flex-col)
- [ ] sort tabs 가로 스크롤 없이 한 줄 표시
- [ ] composer textarea 가로 100% (max-w-full)
- [ ] ThreadDetail PostTree indent — `ml-2 pl-3` 모바일에서도 가독 (1-level만)
- [ ] VoteButton — 클릭 영역 24px 이상 (Material 표준)
- [ ] Hero 메타 칩 — 모바일에서 우하단 위치 유지 (absolute bottom-2 right-2)

---

## 7. CSP / 네트워크 검증

- [ ] Network 탭 — discussion API 모두 `200` (read 비인증 통과 확인)
- [ ] Network 탭 — write API 비로그인 시 `401` (Origin guard + Jwt)
- [ ] Console — react-markdown 출력에 inline `<script>` 0건 (sanitize-schema)
- [ ] Console — CSP 위반 0 (PR-3a helmet + ADR-020 §4.2.1 CSP)
- [ ] DOM 검사 — `data-testid="discussion-meta-chip"` Hero 우하단 노출 (mock 시
  `discussionCount=4`)

---

## 8. PR-10c Origin guard 통과 확인

- [ ] `.env ORIGIN_GUARD_MODE=report` 일 때 — 정상 200 + console 에 보고만
- [ ] `.env ORIGIN_GUARD_MODE=enforce` 로 변경 → API 재기동 → 동일 사용자 흐름
  Network 탭 모두 200 (`http://100.102.41.122:3002` Origin 정상 통과)
- [ ] 외부 임의 Origin (curl `-H "Origin: https://evil.com"`) — 403 응답

---

## 9. 회귀 검증 (이전 화면 영향 없음)

- [ ] `/` Home — 시안 D 톤 그대로
- [ ] `/play/solo` config phase — 시안 ε 그대로
- [ ] `/play/solo` playing phase — 변동 없음
- [ ] `/play/solo` finished phase — 기존 "다시 플레이" 버튼 + 신규 "토론 보기"
  CTA 모두 정상
- [ ] Header 토글 / 인증 상태 polling — 변동 없음
- [ ] `/login` `/register` — 변동 없음

---

## 10. 검증 결과 보고 형식

검증 완료 후 본 문서 §2~9 체크박스 캡처 + 노트북 환경 (브라우저 / 화면 크기) 명시한
한 줄 요약 PR comment 로 보고. 외부 검증 통과 = 머지 가능 게이트.

---

**외부 검증 끝.** 본 체크리스트는 PR-12 머지 전 1회 통과 필수. 이후 회귀가
의심될 때마다 다시 적용 가능.

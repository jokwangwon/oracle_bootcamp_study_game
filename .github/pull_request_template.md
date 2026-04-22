## Summary

<!-- 1-3 bullets — 무엇을/왜 변경했는가 -->

## Test plan

<!-- 체크박스 형식으로 검증 항목 나열 -->
- [ ] `npm run typecheck` 전 패키지 통과
- [ ] `npm test` 전 패키지 통과
- [ ] (UI 변경) 브라우저 수동 확인

## MVP-B 채점 파이프라인 체크리스트 (ADR-013/ADR-016 관련 변경 시)

작성형 답안 채점(Layer 1~3) 또는 `answer_history` 관련 변경에서는 다음 3 항목을
반드시 확인한다. **무관한 변경이면 각 항목에 `N/A` 로 표시**하고 이유 한 줄.

- [ ] **`answer_history` UPDATE 경로 신설하지 않음** — ADR-016 §6 WORM 선행 조건
  (REVOKE UPDATE + append-only 트리거 설치 예정). 새 UPDATE 쿼리/TypeORM 경로
  도입 시 Session 5 WORM 트리거와 충돌. INSERT-only 로만 변경.
- [ ] **Langfuse masker wrapper 경유 확인** — LLM 호출은 `LlmClient`
  (내부에서 `MaskingLangfuseCallbackHandler` 부착) 또는 `LlmClientFactory.createFor`
  경유. 직접 `CallbackHandler` 인스턴스화 금지. ADR-016 §7 + consensus-005 선행 PR.
- [ ] **`grader_digest` 규약 준수** — Layer 3 경로 변경 시
  `GRADER_DIGEST_REGEX` (`/^prompt:…:v\d+\|model:[a-f0-9]{8}\|parser:sov1\|temp:0\|seed:42\|topk:1(\|local-[a-f0-9]{8})?$/`)
  테스트 통과. `LLM_JUDGE_PROMPT_VERSION` 상수 변경은 ADR 부록 + 코드 리뷰 필수
  (자동 갱신 금지 — ADR-016 §주의사항 개정본).

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

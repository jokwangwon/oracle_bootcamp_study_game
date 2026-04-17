# OSS 모델 평가 — promptfoo 하네스

> SDD v2: [docs/architecture/oss-model-evaluation-design.md](../../../../../../docs/architecture/oss-model-evaluation-design.md)

본 디렉토리는 단계 5 산출물 — promptfoo 설정 + assertion 7개 + langfuse-wrapped provider + Gold Set A/B testCase 어댑터.

## 디렉토리 구조

```
eval/
├── promptfoo.config.yaml         # 평가 선언 (providers, prompts, tests, asserts)
├── README.md                     # 본 파일
├── output-schemas.ts             # 운영 AQG와 공유하는 단일 진실 schema
├── assertions/                   # 7개 메트릭 (MT1~MT5/MT8 + MT6 계산적 보조)
│   ├── types.ts                  # AssertionContext / AssertionResult 공통 타입
│   ├── extract-json.ts           # LangChain StructuredOutputParser 동일 추출
│   ├── json-parse.ts             # MT1
│   ├── zod-schema.ts             # MT2 (output-schemas.ts wrap)
│   ├── scope-whitelist.ts        # MT3 (extractOracleTokens 재사용)
│   ├── blank-consistency.ts      # MT4 (___ 개수 + 정답 일관성)
│   ├── latency.ts                # MT5 (60s 임계)
│   ├── sanitization.ts           # MT8 (XSS/SSRF/SQL injection blocklist)
│   └── korean-features.ts        # MT6 계산적 보조 (한글 비율/어절/조사)
├── providers/
│   └── langfuse-wrapped.ts       # promptfoo provider — LlmClient + Langfuse callback
├── prompts/
│   └── build-eval-prompt.ts      # 운영 prompt template + 평가 전용 중심 토큰 지시
├── datasets/
│   ├── gold-set-a.ts             # 30 entries (Recall, 단계 4)
│   ├── gold-set-b.ts             # 30 entries (Generalization, 단계 4)
│   └── promptfoo-testcases.ts    # Gold A + B → PromptfooTestCase[] 어댑터
├── modelfiles/
│   └── exaone4.Modelfile         # EXAONE 4.0 GGUF 임포트 (단계 2)
└── scripts/
    ├── compile-gold-set-b.ts     # candidates.md → gold-set-b.ts 컴파일
    ├── format-vs-parser-experiment.ts  # 단계 3 §14 #9 실증
    ├── synthesize-gold-set-b.ts  # batch 합성 (현재는 직접 작성으로 대체)
    └── validate-candidates.ts    # candidates.md 화이트리스트/형식 검증
```

## 사전 조건

1. **promptfoo CLI 설치** (단계 5 완료 후, 단계 8 R0 직전):
   ```bash
   # repo root에서
   npm install --save-dev --workspace=apps/api promptfoo
   ```

2. **docker-compose 평가 인프라 기동** (단계 1 완료):
   ```bash
   sudo docker compose up -d ollama langfuse
   ```

3. **5개 모델 모두 ollama list에 존재** (단계 2 sanity 5/5 PASS):
   ```bash
   sudo docker compose exec ollama ollama list
   # exaone4:32b, exaone3.5:32b, qwen3-coder:30b, qwen2.5-coder:32b, llama3.3:70b
   ```

4. **`.env` 환경변수**:
   - `LLM_API_KEY` — Anthropic R0 베이스라인용 (단계 8 시점 충전 필수)
   - `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` — self-host trace
   - `LANGFUSE_HOST=http://langfuse:3000` — compose 내부 호스트명

## 실행

```bash
cd apps/api/src/modules/ai/eval
npx promptfoo eval --config promptfoo.config.yaml
```

특정 모델만 실행 (예: M2 EXAONE 3.5만):
```bash
npx promptfoo eval --config promptfoo.config.yaml \
  --filter-providers 'M2 — EXAONE 3.5 32B'
```

## 단위 테스트 (vitest, promptfoo CLI 불필요)

본 디렉토리의 모든 모듈은 promptfoo 런타임 없이도 vitest로 검증 가능하다 — 평가
인프라가 동작하지 않아도 assertion/provider/prompt 빌더의 정확성을 보장.

```bash
cd apps/api
npm run test -- src/modules/ai/eval/
```

## 합격선 (SDD v2 §1.3)

| 메트릭 | 합격선 | 비고 |
|---|---|---|
| C1 (MT1 JSON) | ≥ 95% | promptfoo native |
| C2 (MT2 Zod) | ≥ 95% | output-schemas.ts |
| C3 (MT3 Scope) | ≥ 90% | extractOracleTokens |
| C4 (MT4 Blank) | ≥ 95% | blank-typing 한정 |
| C5 (MT6 한글) | 절대 ≥ 4.0, 상대 -0.3 이내 | Tier 2 + 계산적 보조 30% |
| C6 (MT7 SQL 사실) | 절대 ≥ 4.0, 상대 -0.3 이내 | Tier 2 |
| C7 (MT5 latency) | ≤ 60s | wall-clock |
| C8 (MT8 sanitize) | ≥ 99% | blocklist 7종 |

## 단계 5 다음 단계

| 단계 | 내용 | 산출물 |
|---|---|---|
| 6 | 결과 JSON schema (감사용 N-05) + report-generator | `reports/schema.v1.ts`, `reports/report-generator.ts` |
| 7 | eval.controller.ts (관리자 전용 트리거) | `POST /api/eval/run` |
| 8 | Phase 0 Claude 베이스라인 R0 (60 × 5 = 300 호출) | Anthropic 크레딧 충전 후 |
| 9 | R1~R4 평가 라운드 5개 모델 × 5 run | 합격/불합격 보고서 |
| 10 | ADR-010 + 운영 모델 교체 | main merge |

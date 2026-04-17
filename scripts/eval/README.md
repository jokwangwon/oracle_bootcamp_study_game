# OSS 모델 평가 — 운영 스크립트

> SDD: `docs/architecture/oss-model-evaluation-design.md` (v2)

이 폴더는 SDD v2 §12 단계 1~9의 인프라/실행 작업에 사용되는 스크립트를 모은다. 모든 스크립트는 **사용자가 직접 실행**해야 하며, 코드(`apps/api`)와는 분리되어 있다.

---

## 단계 1: docker-compose 인프라 + sanity check

### 1.1 사전 준비

```bash
# 1) 환경변수 파일 생성
cp .env.example .env

# 2) 다음 시크릿을 모두 강한 랜덤으로 교체 (필수, Langfuse v3 풀 인프라)
#    - LANGFUSE_DB_PASSWORD          (postgres)
#    - LANGFUSE_NEXTAUTH_SECRET      (NextAuth 세션)
#    - LANGFUSE_SALT                 (해시 솔트)
#    - LANGFUSE_ENCRYPTION_KEY       ★ 정확히 64자 hex (openssl rand -hex 32)
#    - LANGFUSE_CLICKHOUSE_PASSWORD  (clickhouse)
#    - LANGFUSE_REDIS_AUTH           (langfuse 전용 redis, 기존 BullMQ redis와 분리)
#    - LANGFUSE_MINIO_PASSWORD       (minio root)
#
#    생성 예:
#      openssl rand -base64 32   # 일반 시크릿
#      openssl rand -hex 32      # ENCRYPTION_KEY (정확히 64자 hex 필수)
```

### 1.2 평가 인프라 부팅 (Langfuse v3 풀 인프라 + Ollama)

본 게임 서비스(`api`/`web`)와 분리하여 평가 인프라만 띄워서 검증한다. Langfuse v3는 5개 컨테이너 풀 인프라가 필요하다 (consensus-002 옵션 B).

```bash
docker compose up -d \
  ollama \
  langfuse-db \
  langfuse-clickhouse \
  langfuse-redis \
  langfuse-minio \
  langfuse-worker \
  langfuse

# 컨테이너 상태 확인 (모두 healthy 또는 running 이어야 함)
docker compose ps
```

기대 결과:
- `oracle-game-ollama` healthy
- `oracle-game-langfuse-db` healthy
- `oracle-game-langfuse-clickhouse` healthy
- `oracle-game-langfuse-redis` healthy
- `oracle-game-langfuse-minio` healthy
- `oracle-game-langfuse-worker` running
- `oracle-game-langfuse` running

> langfuse-worker / langfuse는 위 4개 healthcheck가 모두 통과한 후에 부팅된다.
> 첫 부팅 시 Langfuse가 ClickHouse 마이그레이션을 자동 수행하므로 1~2분 소요될 수 있다.

#### 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `langfuse` Restarting (1) + 로그에 "CLICKHOUSE_URL is not configured" | v2 yml로 v3 이미지 사용 (구버전 SDD 적용) | docker-compose.yml이 v3 풀 인프라인지 확인 |
| `langfuse` 시작 시 "ENCRYPTION_KEY must be 64 hex characters" | LANGFUSE_ENCRYPTION_KEY가 64자 hex가 아님 | `openssl rand -hex 32`로 재생성 |
| `langfuse-clickhouse` Restarting | 권한 문제 | `./langfuse-clickhouse-data` 디렉토리 권한 확인 (user 101:101) |
| `langfuse-redis` Restarting | LANGFUSE_REDIS_AUTH 미설정 | .env에서 값 설정 후 `docker compose down && up -d` |

### 1.3 5모델 sanity check (C-01 강제 게이트)

```bash
./scripts/eval/sanity-check.sh
```

이 스크립트는 SDD v2 §11 R2 + C-01에 따라 다음을 검증한다:

| # | 모델 | 검증 항목 |
|---|---|---|
| M2 | EXAONE 3.5 32B | pull → load → 1문제 생성 |
| M3 | Qwen3-Coder-Next (80B MoE) | 동일 |
| M4 | Qwen2.5-Coder 32B | 동일 |
| M5 | Llama 3.3 70B | 동일 |

> **M1 EXAONE 4.0은 본 sanity에서 제외**됩니다. Ollama 정식 미지원이라 단계 2에서 GGUF 수동 import 후 별도 sanity를 수행합니다 (SDD §8 + §14 미해결 #2).

#### 결과 해석

- **모두 PASS** → 단계 2 진입 가능
- **1개 이상 FAIL** → 단계 1 차단. 실패 로그 확인 후 SDD §11 R2 위험 적용 검토 (vLLM 전환 등)

결과는 `apps/api/eval-results/sanity-{timestamp}/`에 저장됩니다 (gitignore):
- `env.txt` — 호스트 + nvidia-smi + Ollama 버전 메타 (M-04 재현성)
- `<model>.pull.log` — pull 로그
- `<model>.gen.log` — 생성 출력
- `summary.txt` — PASS/FAIL 요약

### 1.4 Langfuse self-host 첫 부팅

sanity check 통과 후 Langfuse UI 접속:

```
http://localhost:${LANGFUSE_PORT}    # 기본 3010
```

1. 로그인 화면에서 사용자 생성 (self-host는 첫 사용자가 자동 admin)
2. 새 프로젝트 생성 (예: "oracle-dba-eval")
3. Settings → API Keys → Public/Secret Key 발급
4. `.env`의 `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY`에 등록
5. `docker compose restart api` (api 재시작하여 새 키 적용)

---

## 후속 단계 (다음 PR에서 추가 예정)

```
[x] 단계 0  : extractOracleTokens 공용 유틸 export
[ ] 단계 1  : docker-compose ollama + langfuse + sanity check       ← 본 폴더
[ ] 단계 2  : 5개 모델 pull + EXAONE 4.0 GGUF 수동 import
[ ] 단계 3  : LlmClientFactory + ollama provider 분기
[ ] 단계 4  : Gold Set A(30) + Gold Set B(30) 데이터셋
[ ] 단계 5  : promptfoo 설정 + assertion 7개 + langfuse-wrapped provider
[ ] 단계 6  : 결과 JSON schema + report-generator
[ ] 단계 7  : eval.controller.ts (관리자 트리거)
[ ] 단계 8  : Phase 0 — Claude 베이스라인 측정
[ ] 단계 9  : R1~R4 평가 라운드 실행
[ ] 단계 10 : ADR-010 + 운영 모델 교체
```

---

## 주의 사항

- **데이터 주권** (rationale §1.2): Langfuse는 **self-host**입니다. Cloud(`cloud.langfuse.com`)로 prompt/output 본문이 나가지 않습니다 (SDD v2 Q4).
- **포트 보안** (ADR-005, SDD v2 C-05): Ollama(`11434`)와 Langfuse(`3010`)는 모두 **`127.0.0.1`로 localhost 바인드만**. 외부 접근 차단.
- **GB10 thermal throttling** (SDD v2 §14 미해결 #10): 장시간 평가 시 `nvidia-smi`로 5분 간격 온도 모니터링 권장. throttle 감지 시 §10.4 정책에 따라 휴지 후 재개.
- **EXAONE 라이센스** (`docs/rationale/exaone-license-extract.md`): 평가 단계는 EXAONE License Section 2.1(a) 안전 영역. 운영 진입 전 LG AI Research 문의 필수.

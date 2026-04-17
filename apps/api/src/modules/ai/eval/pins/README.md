# Ollama 모델 digest pin

**근거**: ADR-011 채택 조건 #2 — primary OSS(M3 Qwen3-Coder-Next)의 digest drift를 차단하기 위한 pin 자동화.

## 파일

- `approved-models.json` — 승인된 모델과 digest의 단일 진실 소스
- `types.ts` — `ModelPin`, `VerifyResult` 타입
- `verify.ts` — `verifyApprovedModel()` + `loadPins/savePins` + `defaultTagsFetcher()`
- `verify.test.ts` — 10 cases (prefix 매칭, fetch 실패, 불일치 등)

## CLI 사용법

### 신규 모델 pin
```bash
npx tsx apps/api/src/modules/ai/eval/scripts/pin-model.ts \
  --model qwen3-coder-next:latest \
  --round R-2026-04-14T11-32-26Z \
  --notes "ADR-011 primary"
```

### digest 덮어쓰기 (모델 재다운로드 시)
```bash
# --force 없이 실행하면 exit 3으로 보호
npx tsx .../pin-model.ts --model qwen3-coder-next:latest --force
```

### Exit 코드
- `0`: 성공 또는 변경 없음
- `1`: `--model` 누락 또는 예외
- `2`: 모델이 Ollama에 없음
- `3`: pin이 이미 존재 + `--force` 미지정 + digest 상이

## 하네스 통합 (run-eval-standalone.ts)

평가 실행 시 pin gate가 먼저 동작한다 (fail-closed):

- **pin 일치** → `✅ Pin verified: ...` 로그 후 평가 계속
- **pin 없음** → `❌ not-pinned` + pin-model CLI 안내 → exit 4
- **digest 불일치** → `❌ digest-mismatch` → exit 4
- **Ollama 미기동** → `❌ not-found-in-ollama` → exit 4

### R&D 우회
```bash
npx tsx .../run-eval-standalone.ts --model exaone4:32b --skip-pin-check
```
후보 모델 R&D 중에만 사용. 운영 배포 전 최종 회귀 게이트에서는 절대 사용 금지.

`run-all-models.sh`는 후보 벤치마크 용도이므로 기본 `--skip-pin-check`가 적용된다:
```bash
# pin 강제 (운영 회귀용)
EXTRA_ARGS="" bash apps/api/src/modules/ai/eval/scripts/run-all-models.sh
```

## 운영 워크플로우 (ADR-011 P1)

1. 운영 배포 전 `qwen3-coder-next:latest`가 approved-models.json에 pin되어 있음을 확인 (현재 시드됨)
2. BullMQ AI 문제 생성 워커도 부팅 시 동일 `verifyApprovedModel()`을 호출하도록 확장 예정 (§6.2 후속 PR)
3. Ollama 재다운로드 후에는 `pin-model --force`로 명시적 업데이트 + ADR 참조 기록

## 설계 근거 (간단)

- **`/api/tags`** 선택: `/api/show`는 digest를 반환하지 않지만 tags는 모든 모델의 digest를 한 번에 제공. sudo 불필요.
- **prefix 매칭 허용**: 동일 blob의 short/full hash 표기 차이는 drift가 아님. 테스트 커버 (verify.test.ts).
- **schema.v1 immutable 준수**: 기존 `ollamaImageDigest` 필드는 Docker 컨테이너 이미지가 아닌 **모델 digest**(`{modelName}@{sha}`)로 의미 전환. 새 필드 추가 없이 재현성 확보.

#!/usr/bin/env bash
# ===========================================================================
# OSS 모델 평가 — 단계 1 sanity check
# ===========================================================================
#
# SDD: docs/architecture/oss-model-evaluation-design.md (v2 §6.2 + §11 R2 + C-01)
#
# 목적: 5개 후보 모델이 NVIDIA GB10 (Grace Blackwell, aarch64, 119GB 통합 메모리)
#       환경에서 Ollama 컨테이너로 정상 동작하는지 검증한다.
#
# 강제 게이트 (consensus-002 C-01):
#   - 5개 모델 전부 load + 1문제 생성에 성공해야 단계 2 (모델 pull/import)로 진입
#   - 1개라도 실패하면 단계 1 차단. 실패 모델은 §11 R2 위험 적용 (vLLM 전환 검토)
#
# 사용법:
#   1. cp .env.example .env 후 LANGFUSE_DB_PASSWORD/NEXTAUTH_SECRET/SALT를 강한 랜덤으로 교체
#      (예: openssl rand -base64 32)
#   2. docker compose up -d ollama langfuse-db langfuse  # 평가 인프라만 우선
#   3. ./scripts/eval/sanity-check.sh
#   4. 결과 로그 확인. 모든 모델이 PASS면 단계 2 진입 가능
#
# 주의:
#   - EXAONE 4.0은 Ollama 정식 미지원 (Issue #11433). 본 sanity는 EXAONE 3.5만 검증.
#     EXAONE 4.0은 단계 2에서 GGUF 수동 import 후 별도 sanity 수행 (§8)
#   - 80B MoE 모델(Qwen3-Coder-Next)은 첫 다운로드만 30분 이상 소요 가능
#   - thermal throttling 의심 시 (§14 미해결 #10) nvidia-smi로 5분 간격 온도 확인
# ===========================================================================

set -uo pipefail

# 스크립트 위치 기준으로 프로젝트 root로 이동.
# sudo 환경에서 호출되거나 임의 위치에서 실행되어도 docker compose가 .env를
# 정확히 읽을 수 있도록 working directory를 보장한다.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# 색상 (TTY일 때만)
if [[ -t 1 ]]; then
  C_GREEN='\033[0;32m'
  C_RED='\033[0;31m'
  C_YELLOW='\033[0;33m'
  C_RESET='\033[0m'
else
  C_GREEN=''
  C_RED=''
  C_YELLOW=''
  C_RESET=''
fi

log_info()  { echo -e "${C_YELLOW}[INFO]${C_RESET} $*"; }
log_ok()    { echo -e "${C_GREEN}[ OK ]${C_RESET} $*"; }
log_fail()  { echo -e "${C_RED}[FAIL]${C_RESET} $*"; }

# SDD v2 §2 후보 5개 (M1 EXAONE 4.0은 단계 2에서 별도 처리)
# 각 항목: "Ollama 모델 태그|라벨"
SANITY_MODELS=(
  "exaone3.5:32b|M2 EXAONE 3.5 32B"
  "qwen3-coder-next|M3 Qwen3-Coder-Next (80B MoE)"
  "qwen2.5-coder:32b|M4 Qwen2.5-Coder 32B"
  "llama3.3:70b|M5 Llama 3.3 70B"
)

# 한국어 + SQL 질문 (출력 일관성 확인용)
SANITY_PROMPT='Oracle SQL의 SELECT 문에 대해 한 문장으로 설명하세요.'

OLLAMA_SERVICE="ollama"   # docker compose service 이름 (container name 아님)
RESULT_DIR="apps/api/eval-results/sanity-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULT_DIR"

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=()

# ─────────────────────────────────────────────
# 0. 사전 점검: Ollama 컨테이너 동작 확인
# ─────────────────────────────────────────────
log_info "Ollama 컨테이너 healthcheck 확인..."
if ! docker compose ps ollama --status running --quiet | grep -q .; then
  log_fail "ollama 컨테이너가 실행되지 않음. 'docker compose up -d ollama' 먼저 실행"
  exit 1
fi

if ! docker compose exec -T "$OLLAMA_SERVICE" ollama list >/dev/null 2>&1; then
  log_fail "ollama 명령 응답 실패. healthcheck 로그 확인"
  exit 1
fi
log_ok "Ollama 컨테이너 정상"

# GB10 / driver / aarch64 환경 메타 기록
log_info "환경 메타 수집..."
{
  echo "=== sanity check $(date -Iseconds) ==="
  echo
  echo "[host]"
  uname -a
  echo
  echo "[nvidia-smi]"
  nvidia-smi 2>&1 || echo "nvidia-smi 실패"
  echo
  echo "[ollama version]"
  docker compose exec -T "$OLLAMA_SERVICE" ollama --version 2>&1 || true
  echo
} > "$RESULT_DIR/env.txt"
log_ok "환경 메타 → $RESULT_DIR/env.txt"

# ─────────────────────────────────────────────
# 1. 모델별 sanity (pull → load → 1문제 생성)
# ─────────────────────────────────────────────
for entry in "${SANITY_MODELS[@]}"; do
  IFS='|' read -r model label <<< "$entry"

  echo
  echo "=========================================================="
  log_info "$label  ($model)"
  echo "=========================================================="

  log_info "[pull] $model ..."
  pull_log="$RESULT_DIR/${model//[\/:]/_}.pull.log"
  if docker compose exec -T "$OLLAMA_SERVICE" ollama pull "$model" 2>&1 | tee "$pull_log"; then
    log_ok "pull 성공"
  else
    log_fail "pull 실패 — $pull_log 참조"
    RESULTS+=("FAIL  $label  (pull)")
    FAIL_COUNT=$((FAIL_COUNT + 1))
    continue
  fi

  log_info "[generate] 1문제 생성 sanity ..."
  gen_log="$RESULT_DIR/${model//[\/:]/_}.gen.log"
  start=$(date +%s)
  if echo "$SANITY_PROMPT" | docker compose exec -T "$OLLAMA_SERVICE" \
       ollama run "$model" 2>&1 | tee "$gen_log" | head -100; then
    elapsed=$(( $(date +%s) - start ))
    if [[ -s "$gen_log" ]]; then
      log_ok "생성 성공 (${elapsed}s, 출력 → $gen_log)"
      RESULTS+=("PASS  $label  (${elapsed}s)")
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      log_fail "출력이 비어있음"
      RESULTS+=("FAIL  $label  (empty output)")
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    log_fail "generate 실패 — $gen_log 참조"
    RESULTS+=("FAIL  $label  (generate)")
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# ─────────────────────────────────────────────
# 2. 결과 요약
# ─────────────────────────────────────────────
echo
echo "=========================================================="
echo "sanity 결과 요약 ($RESULT_DIR/summary.txt)"
echo "=========================================================="
{
  echo "=== sanity summary $(date -Iseconds) ==="
  echo
  for r in "${RESULTS[@]}"; do
    echo "$r"
  done
  echo
  echo "PASS: $PASS_COUNT / FAIL: $FAIL_COUNT"
} | tee "$RESULT_DIR/summary.txt"

echo
if [[ $FAIL_COUNT -eq 0 ]]; then
  log_ok "모든 모델 sanity 통과. 단계 2 (M1 EXAONE 4.0 GGUF import) 진행 가능"
  echo
  echo "다음:"
  echo "  - SDD v2 §8 EXAONE 4.0 Modelfile 임포트"
  echo "  - SDD v2 §12 단계 3 (LlmClientFactory + ChatOllama 분기)"
  exit 0
else
  log_fail "$FAIL_COUNT개 모델 실패. SDD v2 §11 R2 위험 적용 검토 필요 (vLLM 전환 등)"
  echo
  echo "단계 1이 차단됩니다. 실패 로그 확인:"
  ls -1 "$RESULT_DIR"
  exit 1
fi

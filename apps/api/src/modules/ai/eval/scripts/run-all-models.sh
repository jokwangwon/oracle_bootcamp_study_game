#!/usr/bin/env bash
#
# OSS 모델 전체 평가 — 터미널 끊겨도 계속 실행
#
# 사용법:
#   nohup bash apps/api/src/modules/ai/eval/scripts/run-all-models.sh > eval-run.log 2>&1 &
#   tail -f eval-run.log   # 진행 상황 확인
#
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# nvm 로드
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
nvm use 20 > /dev/null 2>&1

SCRIPT="apps/api/src/modules/ai/eval/scripts/run-eval-standalone.ts"

# ── 실행할 모델 목록 ──────────────────────────────────────────────
# M4, M2는 이미 완료. 나머지 M1/M3/M5만 재개(2026-04-13).
MODELS=(
  "exaone4:32b|M1 — EXAONE 4.0 32B"
  "qwen3-coder-next:latest|M3 — Qwen3-Coder-Next 80B MoE"
  "llama3.3:70b|M5 — Llama 3.3 70B"
)

echo "════════════════════════════════════════════════════════"
echo "  OSS 모델 전체 평가 시작: $(date)"
echo "  모델 수: ${#MODELS[@]}"
echo "════════════════════════════════════════════════════════"

COMPLETED=0
FAILED=0

for entry in "${MODELS[@]}"; do
  IFS='|' read -r model label <<< "$entry"

  echo ""
  echo "────────────────────────────────────────────────────────"
  echo "  [$((COMPLETED + FAILED + 1))/${#MODELS[@]}] $label"
  echo "  시작: $(date)"
  echo "────────────────────────────────────────────────────────"

  if npx tsx "$SCRIPT" --model "$model" --label "$label"; then
    COMPLETED=$((COMPLETED + 1))
    echo "  ✓ $label 완료: $(date)"
  else
    FAILED=$((FAILED + 1))
    echo "  ✗ $label 실패: $(date)"
    # 실패해도 다음 모델 계속 진행
  fi
done

echo ""
echo "════════════════════════════════════════════════════════"
echo "  전체 평가 완료: $(date)"
echo "  성공: $COMPLETED / 실패: $FAILED / 총: ${#MODELS[@]}"
echo "════════════════════════════════════════════════════════"

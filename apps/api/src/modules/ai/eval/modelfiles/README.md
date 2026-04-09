# EXAONE 4.0 32B GGUF 수동 import 절차

> SDD: `docs/architecture/oss-model-evaluation-design.md` v2 §8 (단계 2)
> 검증: 2026-04-09 — chat_template / tokenizer_config 1차 검증 + Ollama 0.20.4 확인

---

## 0. 사전 조건

| 항목 | 값 |
|---|---|
| 호스트 | NVIDIA GB10 (Grace Blackwell, aarch64), 119 GiB 통합 메모리, 1.7 TiB 가용 디스크 |
| Ollama 컨테이너 버전 | 0.20.4 (`docker compose exec ollama ollama --version`로 확인) |
| 단계 1 sanity | 4모델(M2~M5) PASS 완료 (필수 게이트, consensus-002 C-01) |
| 디스크 여유 | ≥ 40 GB (Q8_0 GGUF 34 GB + Ollama blob 변환 여유) |

---

## 1. GGUF 다운로드 (호스트에서 수행)

### 1.1 huggingface-cli 설치 (없으면)

```bash
pip install -U "huggingface_hub[cli]"
huggingface-cli --version
```

### 1.2 Q8_0 단일 파일 다운로드

> **이 단계는 ~34 GB 다운로드**. 회선/디스크 점유에 주의. 결정적 명령이라 사용자가 직접 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"

huggingface-cli download \
  LGAI-EXAONE/EXAONE-4.0-32B-GGUF \
  EXAONE-4.0-32B-Q8_0.gguf \
  --local-dir apps/api/src/modules/ai/eval/modelfiles/
```

다운로드 완료 후:

```bash
ls -lh apps/api/src/modules/ai/eval/modelfiles/EXAONE-4.0-32B-Q8_0.gguf
# → -rw-r--r-- 1 user user ~34G ... EXAONE-4.0-32B-Q8_0.gguf
```

### 1.3 SHA256 기록 (M-04: 보고서 메타)

```bash
sha256sum apps/api/src/modules/ai/eval/modelfiles/EXAONE-4.0-32B-Q8_0.gguf \
  | tee apps/api/src/modules/ai/eval/modelfiles/EXAONE-4.0-32B-Q8_0.gguf.sha256
```

> HuggingFace 페이지의 LFS pointer SHA256과 비교 검증 (`git lfs ls-files` 또는 페이지 file metadata).
> SHA256은 평가 보고서 메타에 반드시 기록 (재현성 보증, SDD v2 §10.2 / M-04).

### 1.4 다른 양자화 옵션 (참고)

| 파일 | 크기 | 용도 |
|---|---|---|
| `EXAONE-4.0-32B-Q8_0.gguf` | 34 GB | **기본 권장** — 결정론 + 품질 균형 |
| `EXAONE-4.0-32B-Q6_K.gguf` | 26 GB | 메모리 부족 시 |
| `EXAONE-4.0-32B-BF16-00001~00002.gguf` | 64 GB | 최대 정확도 (split, 변환 시간↑) |

본 평가는 **Q8_0 단일 파일**로 진행. 추후 품질 차이 의심 시 BF16과 1:1 비교 sanity 가능.

---

## 2. Ollama import (`ollama create`)

GGUF가 호스트의 `apps/api/src/modules/ai/eval/modelfiles/`에 있으면 docker compose volume mount(`docker-compose.yml` services.ollama.volumes)를 통해 컨테이너 내부에서는 `/modelfiles/`로 접근 가능.

```bash
docker compose exec ollama \
  ollama create exaone4:32b -f /modelfiles/exaone4.Modelfile
```

성공 시 출력 예:
```
transferring model data
creating model layer
using existing layer sha256:...
writing manifest
success
```

확인:
```bash
docker compose exec ollama ollama list | grep exaone4
# exaone4:32b   <id>   ~34 GB   <time>
```

### 2.1 import 실패 시 디버깅

| 증상 | 원인 후보 | 조치 |
|---|---|---|
| `unknown architecture` 또는 `unsupported model` | Ollama 버전이 EXAONE 4.0 architecture 미지원 | `ollama --version` ≥ 0.11.5 확인. 미만이면 `image: ollama/ollama:latest` 재pull |
| `template parse error` | Modelfile TEMPLATE 문법 오류 | exaone4.Modelfile의 `{{ }}` 검사. 본 파일은 `.Messages` 형식 사용 |
| `ENOENT /modelfiles/EXAONE-4.0-32B-Q8_0.gguf` | volume mount 미작동 또는 파일명 불일치 | `docker compose exec ollama ls /modelfiles/` 로 확인 |
| GGUF 손상 | 다운로드 중단 | SHA256 재검증 후 재다운로드 |

**최종 폴백 (SDD v2 §8.3, R1)**: 위 모든 디버깅 실패 시 → **EXAONE 3.5 32B (`exaone3.5:32b`, M2)**로 한국어 SOTA 후보를 대체. M2는 단계 1 sanity에서 이미 PASS.

---

## 3. import 후 sanity (M1 단독)

전체 5모델 sanity는 `scripts/eval/sanity-check.sh`에 M1이 추가되어 있다. 단독 검증:

```bash
docker compose exec ollama \
  ollama run exaone4:32b "Oracle SQL의 SELECT 문에 대해 한 문장으로 설명하세요."
```

또는 전체 sanity 재실행:
```bash
./scripts/eval/sanity-check.sh
```

C7 게이트(60s 이내) 통과해야 단계 3(LlmClientFactory + ChatOllama 분기)으로 진입 가능.

---

## 4. 보고서 메타 (M-04 / M-05)

import 완료 시 다음 5가지를 평가 보고서에 기록:

```bash
# 1. GGUF SHA256
cat apps/api/src/modules/ai/eval/modelfiles/EXAONE-4.0-32B-Q8_0.gguf.sha256

# 2. Ollama image digest (M-05)
docker compose images ollama --format json | jq -r '.[].Digest // "(no digest pin)"'

# 3. Ollama 버전
docker compose exec ollama ollama --version

# 4. CUDA / driver
nvidia-smi --query-gpu=driver_version --format=csv,noheader

# 5. ollama list (모델 ID + 크기)
docker compose exec ollama ollama list | grep exaone4
```

---

## 5. .gitignore 필수

`.gguf` 파일은 절대 git에 커밋 금지. 프로젝트 루트 `.gitignore`에 다음 추가 (필요 시):

```
apps/api/src/modules/ai/eval/modelfiles/*.gguf
apps/api/src/modules/ai/eval/modelfiles/*.gguf.sha256
```

(Modelfile과 본 README는 git에 커밋한다.)

# Gold Set B 합성/검수/컴파일 감사 로그

> SDD: docs/architecture/oss-model-evaluation-design.md v2 §4.2 + Q2 결정 + 단계 4

## 1. 합성 단계 (작성자: Claude)

| 항목 | 값 |
|---|---|
| 작성자 | Claude opus-4-6 (1M context) |
| 합성 방식 | Anthropic API 호출 대신 본 Claude Code 세션에서 직접 작성 (크레딧 잔액 부족 우회, 동등 품질, 동일 모델) |
| 합성 batch | 6 (mode × difficulty: bt easy/medium/hard + tm easy/medium/hard) |
| 후보 분포 | bt 14/14/12 + tm 14/14/12 = 80 |
| 자체 검증 | validate-candidates.ts → 화이트리스트 + 시드 중복 통과 (5개 description 메타 단어 patch 후) |
| 산출물 | apps/api/src/modules/ai/eval/datasets/gold-set-b.candidates.md |

## 2. 검수 단계 (검수자: 사용자)

> 작성/검수 분리 원칙(SDD §4.2 + B-MED): 작성자=Claude, 검수자=사용자

| 결과 | 카테고리 | 카운트 |
|---|---|---|
| **사용자 채택** | 전체 | 77 / 80 |
| **사용자 거절** | 전체 | 3 / 80 |

### 거절된 후보 (사용자가 명시 거절)

- `bt-easy-01` (blank-typing/EASY)
- `bt-easy-04` (blank-typing/EASY)
- `bt-easy-06` (blank-typing/EASY)

## 3. 자동 선택 단계 (compile-gold-set-b.ts)

> SDD §4.2 분포 권장(easy 10 / medium 12 / hard 8 = 30) + 모드 균형(bt 15 + tm 15)에 맞춰
> 채택 항목 중 카테고리별 quota만큼 앞에서부터 결정론적으로 선택.

| 카테고리 | quota | 채택 | 선택 | quota 초과 (운영 시드 후보) |
|---|---|---|---|---|
| blank-typing/EASY | 5 | 11 | 5 | 6 |
| blank-typing/MEDIUM | 6 | 14 | 6 | 8 |
| blank-typing/HARD | 4 | 12 | 4 | 8 |
| term-match/EASY | 5 | 14 | 5 | 9 |
| term-match/MEDIUM | 6 | 14 | 6 | 8 |
| term-match/HARD | 4 | 12 | 4 | 8 |
| **합** | **30** | **77** | **30** | **47** |

### quota 초과 (선택되지 않은 채택 항목)

아래 항목들은 사용자가 채택했지만 30개 quota를 초과해 본 평가셋에는 포함되지 않았다.
이들은 별도 작업(예: 운영 시드 추가, 새 주차 분리)으로 활용 가능하다.

- `bt-easy-09` (blank-typing/EASY)
- `bt-easy-10` (blank-typing/EASY)
- `bt-easy-11` (blank-typing/EASY)
- `bt-easy-12` (blank-typing/EASY)
- `bt-easy-13` (blank-typing/EASY)
- `bt-easy-14` (blank-typing/EASY)
- `bt-medium-07` (blank-typing/MEDIUM)
- `bt-medium-08` (blank-typing/MEDIUM)
- `bt-medium-09` (blank-typing/MEDIUM)
- `bt-medium-10` (blank-typing/MEDIUM)
- `bt-medium-11` (blank-typing/MEDIUM)
- `bt-medium-12` (blank-typing/MEDIUM)
- `bt-medium-13` (blank-typing/MEDIUM)
- `bt-medium-14` (blank-typing/MEDIUM)
- `bt-hard-05` (blank-typing/HARD)
- `bt-hard-06` (blank-typing/HARD)
- `bt-hard-07` (blank-typing/HARD)
- `bt-hard-08` (blank-typing/HARD)
- `bt-hard-09` (blank-typing/HARD)
- `bt-hard-10` (blank-typing/HARD)
- `bt-hard-11` (blank-typing/HARD)
- `bt-hard-12` (blank-typing/HARD)
- `tm-easy-06` (term-match/EASY)
- `tm-easy-07` (term-match/EASY)
- `tm-easy-08` (term-match/EASY)
- `tm-easy-09` (term-match/EASY)
- `tm-easy-10` (term-match/EASY)
- `tm-easy-11` (term-match/EASY)
- `tm-easy-12` (term-match/EASY)
- `tm-easy-13` (term-match/EASY)
- `tm-easy-14` (term-match/EASY)
- `tm-medium-07` (term-match/MEDIUM)
- `tm-medium-08` (term-match/MEDIUM)
- `tm-medium-09` (term-match/MEDIUM)
- `tm-medium-10` (term-match/MEDIUM)
- `tm-medium-11` (term-match/MEDIUM)
- `tm-medium-12` (term-match/MEDIUM)
- `tm-medium-13` (term-match/MEDIUM)
- `tm-medium-14` (term-match/MEDIUM)
- `tm-hard-05` (term-match/HARD)
- `tm-hard-06` (term-match/HARD)
- `tm-hard-07` (term-match/HARD)
- `tm-hard-08` (term-match/HARD)
- `tm-hard-09` (term-match/HARD)
- `tm-hard-10` (term-match/HARD)
- `tm-hard-11` (term-match/HARD)
- `tm-hard-12` (term-match/HARD)

## 4. 컴파일 단계

| 항목 | 값 |
|---|---|
| 컴파일 시각 | 2026-04-09T07:55:57.675Z |
| 출력 | apps/api/src/modules/ai/eval/datasets/gold-set-b.ts |
| 검증 | 화이트리스트 + 시드 중복 + 분포 (vitest gold-set-b.test.ts) |

## 5. 후속 작업

- quota 초과 47개 + 거절 3개 = 50개를 운영 시드(week1-sql-basics)에 추가하거나 새 주차로 분리
- 트랜잭션/읽기 일관성 학습 영역은 새 주차(week2-transactions) 시드 + 화이트리스트로 분리 (단계 4 외부 작업)

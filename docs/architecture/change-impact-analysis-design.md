# 변경 영향 분석 설계 (Change Impact Analysis Design)

> **"단순한 기능 추가"에도 의존성, 통신 흐름, 장애 전파를 검증한 후 개발한다 — 계산적 자동 분류 + 범위별 차등 분석**

**최종 수정**: 2026-04-06
**상태**: 설계 확정 (3+1 합의 검증 완료)
**상위 문서**: `PROJECT_CONSTITUTION.md` 제6조(모듈 독립성)
**관련 ADR**: ADR-007 (변경 영향 분석)

---

## 1. 핵심 원칙 (3+1 합의 결과)

| 원칙 | 설명 | 근거 |
|------|------|------|
| **코드 전 검증** | 어떤 변경이든 코드 작성 전 영향 분석 | 사용자 요구 |
| **계산적 자동 분류** | 범위를 자기 신고가 아닌 도구로 자동 판정 | 3자 합의 — 계산적 > 추론적 |
| **범위별 차등 분석** | LOCAL=체크리스트, MODULE=2차원, SYSTEM=4차원 | Agent A/C — 4차원 과잉 시정 |
| **자동 의존 맵** | system-map을 코드에서 자동 생성, 수동은 메타데이터만 | 3자 합의 — 수동 YAML 부패 방지 |
| **고위험 자동 격상** | DB 스키마/API 브레이킹은 MODULE이라도 SYSTEM으로 격상 | Agent B — MODULE 사각지대 |

---

## 2. 변경 범위 자동 분류

### 2.1 계산적 자동 판별 (Hook/도구 기반)

에이전트의 추론이 아닌, **코드 변경 내용을 분석하여 자동 분류**한다.

```
git diff 분석 → 자동 범위 분류:

LOCAL 조건 (모두 충족 시):
  ✓ 변경 파일이 단일 모듈 내
  ✓ export/public 인터페이스 변경 없음
  ✓ DB 마이그레이션 파일 없음
  ✓ 새 import(다른 모듈)가 추가되지 않음

MODULE 조건 (하나라도 해당):
  → 다른 모듈의 import가 추가/변경
  → public API 시그니처 변경
  → DB 마이그레이션 파일 존재
  → 설정 파일(.env, config) 변경

SYSTEM 자동 격상 조건 (하나라도 해당):
  → docker-compose.yml 변경 (새 서비스)
  → 인증/인가 관련 파일 변경
  → 이벤트/메시지 스키마 변경
  → 외부 API 연동 추가
  → DB 스키마 브레이킹 변경 (컬럼 삭제/타입 변경)
  → public API 브레이킹 변경 (필드 삭제/타입 변경)
```

### 2.2 범위별 분석 수준

| 범위 | 분석 | 소요 | 합의 |
|------|------|------|------|
| **LOCAL** | 체크리스트 3개 | ~2분 | 불필요 |
| **MODULE** | 의존성 + 장애 전파 (2차원) | ~15분 | 불필요 |
| **SYSTEM** | 의존성 + 통신 + 데이터 + 장애 (4차원) | 3+1 합의 | **필수** |

---

## 3. 범위별 분석 상세

### 3.1 LOCAL — 체크리스트 (2분)

```
⬜ LOCAL 변경 체크리스트

□ 기존 테스트가 모두 통과하는가?
□ 새로운 테스트가 필요한가? → 필요하면 TDD
□ 자동 분류가 LOCAL로 맞는가? (export 변경 없음 확인)

→ 3개 확인 후 바로 구현
```

### 3.2 MODULE — 2차원 분석 (15분)

#### 차원 ①: 의존성 (Dependencies)

```
하류 의존: 이 코드가 사용하는 것
상류 의존: 이 코드를 사용하는 것

확인:
□ 의존 모듈의 인터페이스가 변경되는가?
□ 이 변경으로 상류 소비자가 깨지는가?
□ 새로운 의존이 순환을 만들지 않는가?
```

#### 차원 ②: 장애 전파 (Failure Propagation)

```
이 변경이 실패하면:
□ 핵심 기능(인증, 결제 등)이 차단되는가? → 비동기 분리 확인
□ 타임아웃이 설정되어 있는가? (구체적 수치)
□ 재시도 정책이 있는가? (횟수, 간격)
□ 이 서비스 다운 시 상위 서비스의 동작은? (그레이스풀 디그레이드)
```

#### 검증 계획 출력

```markdown
## MODULE 영향 분석 결과

### 의존성
| 방향 | 대상 | 인터페이스 | 영향 |
|------|------|-----------|------|
| 하류 | {모듈} | {API/DB} | {변경 없음/확인 필요} |
| 상류 | {모듈} | {API/DB} | {호환/비호환} |

### 장애 전파
| 시나리오 | 영향 | 대응 (구체적) |
|---------|------|-------------|
| {이 서비스 다운} | {영향 범위} | 타임아웃: Xs, 재시도: N회, 폴백: {동작} |

### 추가/수정 테스트
- [ ] {테스트 항목}
```

### 3.3 SYSTEM — 4차원 전면 분석 + 3+1 합의

MODULE의 2차원에 추가로:

#### 차원 ③: 통신 흐름 (Communication Flow)

```
□ 데이터가 어떤 경로로 흐르는가? (서비스 간 전체 경로)
□ 이벤트/메시지 포맷이 소비자와 일치하는가?
□ 동기/비동기 구분이 적절한가?
```

#### 차원 ④: 데이터 흐름 (Data Flow)

```
□ 어떤 데이터가 생성/수정/삭제되는가?
□ DB 마이그레이션이 롤백 가능한가?
□ 데이터 정합성이 보장되는가? (트랜잭션 경계)
```

---

## 4. 시스템 의존 맵: 자동 생성 + CI 검증

### 4.1 코드 기반 자동 생성

수동 YAML 관리 대신, **코드 분석 도구로 의존 그래프를 자동 생성**한다.

| 언어 | 도구 | 용도 |
|------|------|------|
| TypeScript/JS | **Dependency Cruiser** | 의존 그래프 추출 + 순환 감지 + 규칙 위반 |
| Python | **import-linter** | 레이어 간 import 규칙 강제 |
| Java/Kotlin | **ArchUnit** | 아키텍처 규칙을 테스트로 |
| 범용 | **Madge** | 순환 의존 시각화 |

```bash
# 의존 그래프 자동 생성 (예: TypeScript)
npx depcruise --output-type json src/ > system-map.json

# 순환 의존 체크 (CI에서 자동 실행)
npx depcruise --validate .dependency-cruiser.cjs src/

# Python
import-linter --config .importlinter
```

### 4.2 수동 보강 (코드에서 추론 불가능한 메타데이터)

```yaml
# system-meta.yaml — 자동 생성 불가능한 정보만 수동 기록

communications:
  - from: backend
    to: ai-backend
    protocol: gRPC          # 코드에서 추론 어려운 프로토콜 정보
    
  - from: backend
    to: payment-gateway
    protocol: REST
    external: true           # 외부 서비스 표시
```

### 4.3 CI 검증

```bash
# CI Pipeline에서 자동 실행
# 1. 순환 의존 없음
npx depcruise --validate src/ || exit 1

# 2. 레이어 규칙 위반 없음
import-linter || exit 1

# 3. system-meta.yaml 참조 무결성 (존재하지 않는 서비스 참조 없음)
scripts/validate-system-meta.sh || exit 1
```

---

## 5. 하네스 연동

### 5.1 에이전트 프롬프트 (Guide)

```
"변경 요청을 받으면 코드 작성 전 반드시:

 1. 변경 파일 목록을 확인하세요
 2. 다음 기준으로 범위를 자동 판별하세요:
    - 단일 모듈 내, export 불변, 새 import 없음 → LOCAL
    - 다른 모듈 import, API 변경, DB 마이그레이션 → MODULE
    - 새 서비스, 인증 변경, 이벤트 스키마, 브레이킹 변경 → SYSTEM
 3. LOCAL: 체크리스트 3개 확인 후 진행
    MODULE: 의존성 + 장애 전파 2차원 분석 후 진행
    SYSTEM: 3+1 합의 요청
 4. 영향 분석 없이 코드를 작성하지 마세요"
```

### 5.2 PreCommit Hook (센서)

```bash
# 자동 범위 감지 — 경고가 아닌 격상 강제

# 다른 모듈의 import 변경 감지 → MODULE 이상 강제
if git diff --cached --name-only | xargs grep -l "import.*from.*\.\./.*module" 2>/dev/null; then
    echo "[IMPACT] 다른 모듈 import 감지 — MODULE 영향 분석이 필요합니다"
fi

# DB 마이그레이션 파일 감지 → MODULE 이상 강제
if git diff --cached --name-only | grep -E "migration|schema" > /dev/null 2>&1; then
    echo "[IMPACT] DB 스키마 변경 감지 — MODULE 이상 영향 분석이 필요합니다"
fi

# docker-compose 변경 감지 → SYSTEM 강제
if git diff --cached --name-only | grep "docker-compose" > /dev/null 2>&1; then
    echo "[IMPACT] 인프라 변경 감지 — SYSTEM 영향 분석이 필요합니다"
fi
```

---

## 6. MVP 단계 (점진적 도입)

| Phase | 내용 | 도입 시점 |
|-------|------|----------|
| **MVP** | LOCAL 체크리스트 + 에이전트 프롬프트 가이드 + PreCommit 경고 | **즉시** |
| **v1.1** | 의존성 분석 도구(Dep Cruiser/import-linter) CI 연동 | 기술 스택 확정 후 |
| **v1.2** | MODULE 2차원 분석 보고서 템플릿 + 고위험 자동 격상 | 모듈 3개+ 시 |
| **v2.0** | SYSTEM 4차원 전면 분석 + 3+1 합의 + 자동 의존 맵 | 서비스 분리 시 |

---

## 7. 3+1 합의 검증 결과 요약

### 핵심 설계 변경

| 변경 항목 | 초안 | 최종 | 근거 |
|-----------|------|------|------|
| 범위 분류 | 자기 신고 (추론) | **계산적 자동 판별** (import, 스키마, config diff) | 3자 합의 — 계산적 > 추론적 |
| system-map | 수동 YAML | **코드 기반 자동 생성** + CI 검증 | 3자 합의 — 수동은 부패 |
| MODULE 분석 | 4차원 (10분) | **2차원 (의존성+장애), 15분** | Agent A/C — 과잉 시정 |
| SYSTEM 분석 | 4차원 + 합의 | **4차원 + 3+1 합의** (유지) | — |
| LOCAL Hook | 경고만 | **계산적 감지 + 격상 강제** | Agent B — 오분류 방지 |
| 고위험 격상 | 없음 | **DB 브레이킹, API 브레이킹 → SYSTEM** | Agent B |
| 장애 분석 | "서킷브레이커 유무" | **타임아웃/재시도/폴백 구체 수치** | Agent B |
| MVP | 전체 동시 도입 | **체크리스트부터 점진적** | Agent C |

---

**이 문서는 3+1 에이전트 합의를 거쳐 설계가 확정되었습니다.**

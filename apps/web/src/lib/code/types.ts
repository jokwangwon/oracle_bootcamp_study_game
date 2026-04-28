/**
 * 코드 패널 공유 타입.
 *
 * 시안 D `<HeroLivePanel>` 코드 영역과 시안 ε `<CodePreviewPanel>` (PR-9a' Hero) 가
 * 동일한 신택스 매핑·라인 구조를 사용한다. 두 페이지가 같은 디자인 시스템임을
 * 보장하기 위해 코드 라인 모델을 한 곳에 둔다.
 *
 * 출처:
 *  - `docs/rationale/main-page-redesign-concept-d.md` §6 (신택스 토큰 매핑)
 *  - `docs/rationale/solo-play-config-redesign-concept-epsilon.md` §10.2
 */

export type CodeSegmentKind = 'keyword' | 'fn' | 'highlight' | 'plain';

export type CodeSegment = {
  text: string;
  kind?: CodeSegmentKind;
};

export type CodeLine = CodeSegment[];

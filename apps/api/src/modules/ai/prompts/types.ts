/**
 * 프롬프트 정의 공통 타입.
 *
 * ADR-009: 프롬프트는 코드와 분리된 데이터로 취급한다. PromptManager가
 * Langfuse Prompt Management에서 동일 이름의 prompt를 fetch하면 그 값을
 * 사용하고, 없으면 여기에 정의된 fallback을 사용한다.
 */

export interface PromptTemplate {
  /**
   * Langfuse Prompt Management에 등록될 때 사용할 식별자.
   * fetch 시에도 이 이름으로 조회한다.
   */
  name: string;

  /**
   * 시스템 프롬프트 (역할/지시).
   * `{변수명}` 형식으로 변수 치환 자리를 표시한다 (LangChain ChatPromptTemplate 호환).
   */
  systemTemplate: string;

  /**
   * 사용자 메시지 템플릿.
   * 변수 치환 자리는 `{변수명}` 형식.
   */
  userTemplate: string;

  /**
   * 입력 변수 이름 목록 (검증용 — 두 템플릿에서 사용하는 모든 변수).
   */
  inputVariables: readonly string[];

  /**
   * 사람을 위한 짧은 설명. Langfuse UI에서 prompt 설명으로 사용 가능.
   */
  description: string;
}

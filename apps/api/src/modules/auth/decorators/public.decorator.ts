import { SetMetadata } from '@nestjs/common';

/**
 * PR-12 §7 — 비인증 read 허용 마커 (Q-R5-11=a).
 *
 * 핸들러 또는 클래스 레벨에 적용 → JwtAuthGuard 가 IS_PUBLIC_KEY 메타데이터를
 * 발견하면 토큰 검증 실패 시에도 통과 (req.user = null). 토큰이 있고 valid
 * 하면 그대로 attach (옵셔널 인증).
 *
 * 사용 예: discussion controller 의 read 4종 (listThreads / getThread /
 * listPosts) — 학습 동기 부여 위해 비로그인 게스트 미리보기 허용.
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * shadcn/ui 표준 cn helper.
 *
 * clsx 로 truthy 클래스 결합 → tailwind-merge 가 중복 utility (예: `p-2 p-4`) 충돌
 * 해결. PR-5 에서 도입할 shadcn 컴포넌트 + 향후 Tailwind 마이그레이션 (PR-8/9) 용.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

import Link from 'next/link';

import { Button } from '@/components/ui/button';

export const metadata = {
  title: '학습 범위 — Oracle DBA 학습 게임',
};

/**
 * 학습 범위 (admin) 관리 페이지 placeholder.
 *
 * 후속: 노션 import 결과 + 키워드 화이트리스트 편집 + 주차/주제 매핑.
 * 현재는 admin 권한 페이지 미구현 — "준비 중" 안내.
 */
export default function AdminScopePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">학습 범위</h1>
      <p className="text-sm text-muted-foreground">
        학습 범위 관리 (노션 import / 키워드 화이트리스트 편집) 는 아직 준비 중이에요.
        <br />
        관리자 권한이 있는 사용자만 접근 가능한 페이지로 운영될 예정입니다.
      </p>
      <Button asChild variant="outline">
        <Link href="/">홈으로</Link>
      </Button>
    </main>
  );
}

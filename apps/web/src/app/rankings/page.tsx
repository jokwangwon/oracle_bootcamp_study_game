import Link from 'next/link';

import { Button } from '@/components/ui/button';

export const metadata = {
  title: '랭킹 — Oracle DBA 학습 게임',
};

/**
 * 랭킹 페이지 placeholder.
 *
 * 후속: ranked 트랙 점수 집계 + 주차/모드 별 leaderboard. 별도 PR.
 * 현재는 "준비 중" 안내 + 홈 링크 (404 회귀 방어).
 */
export default function RankingsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">랭킹</h1>
      <p className="text-sm text-muted-foreground">
        랭킹 기능은 아직 준비 중이에요.
        <br />
        먼저 솔로 게임에서 점수를 쌓아 보세요.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/play/solo">솔로 게임 시작</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">홈으로</Link>
        </Button>
      </div>
    </main>
  );
}

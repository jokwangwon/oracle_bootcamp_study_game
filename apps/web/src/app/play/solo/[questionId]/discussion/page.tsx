import { notFound } from 'next/navigation';

import { DiscussionListClient } from './DiscussionListClient';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface Props {
  params: { questionId: string };
}

export const metadata = {
  title: '토론 — Oracle DBA 학습 게임',
  description: '문제별 토론과 답변을 모아 봅니다.',
};

/**
 * PR-12 §2.3 — Server Component shell.
 * params.questionId UUID 검증 + 잘못된 형식 시 404.
 * 인증 분기는 ADR-020 §5.3 (read 비인증 허용) 으로 미적용.
 */
export default function DiscussionListPage({ params }: Props) {
  if (!UUID_RE.test(params.questionId)) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <DiscussionListClient questionId={params.questionId} />
    </main>
  );
}

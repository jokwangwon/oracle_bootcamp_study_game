import { notFound } from 'next/navigation';

import { ThreadDetailClient } from './ThreadDetailClient';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface Props {
  params: { questionId: string; threadId: string };
}

export const metadata = {
  title: '토론 상세 — Oracle DBA 학습 게임',
};

/**
 * PR-12 §2.3 — Server Component shell.
 * params.questionId / params.threadId UUID 검증.
 */
export default function ThreadDetailPage({ params }: Props) {
  if (!UUID_RE.test(params.questionId) || !UUID_RE.test(params.threadId)) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <ThreadDetailClient
        questionId={params.questionId}
        threadId={params.threadId}
      />
    </main>
  );
}

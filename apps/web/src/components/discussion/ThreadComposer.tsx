'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { discussionApi } from '@/lib/discussion/api-client';
import type { ThreadDto } from '@/lib/discussion/types';

interface ThreadComposerProps {
  questionId: string;
  onCreated?: (thread: ThreadDto) => void;
}

const TITLE_MAX = 200;
const BODY_MAX = 20000;

/**
 * PR-12 §6.1.6 — 신규 토론 작성 폼.
 * 본문은 markdown raw — 서버 sanitizePostBody 가 1차 검증 + 표시 시 클라 단독 sanitize.
 */
export function ThreadComposer({ questionId, onCreated }: ThreadComposerProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length === 0) {
      setError('제목을 입력해 주세요');
      return;
    }
    if (body.trim().length === 0) {
      setError('본문을 입력해 주세요');
      return;
    }
    if (body.length > BODY_MAX) {
      setError(`본문은 ${BODY_MAX.toLocaleString()}자를 넘을 수 없어요`);
      return;
    }

    startTransition(async () => {
      try {
        const created = await discussionApi.createThread(questionId, {
          title: title.trim(),
          body,
        });
        setTitle('');
        setBody('');
        onCreated?.(created);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 401) {
          setError('로그인이 필요해요');
        } else if (status === 429) {
          setError('작성 분당 5회 한도를 초과했어요');
        } else {
          setError('토론 작성 중 오류가 발생했어요');
        }
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-lg border border-border/40 bg-card/30 p-4 backdrop-blur-md"
      data-testid="thread-composer"
    >
      <Input
        type="text"
        placeholder="질문 제목"
        maxLength={TITLE_MAX}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        aria-label="토론 제목"
      />
      <Textarea
        placeholder="질문 내용 (markdown 사용 가능)"
        maxLength={BODY_MAX}
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        aria-label="토론 본문"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {body.length} / {BODY_MAX.toLocaleString()}
        </span>
        <Button type="submit" disabled={isPending}>
          {isPending ? '작성 중…' : '토론 시작'}
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

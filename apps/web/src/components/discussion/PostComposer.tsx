'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { discussionApi } from '@/lib/discussion/api-client';
import type { PostDto } from '@/lib/discussion/types';

interface PostComposerProps {
  threadId: string;
  parentId?: string | null;
  /** 답글 모드에서 닫기 콜백. */
  onCancel?: () => void;
  onCreated?: (post: PostDto) => void;
  placeholder?: string;
}

const BODY_MAX = 20000;

/**
 * PR-12 §6.1.6 — 답글 / 답변 작성 폼. parentId 가 주어지면 1-level nested 답글.
 */
export function PostComposer({
  threadId,
  parentId = null,
  onCancel,
  onCreated,
  placeholder,
}: PostComposerProps) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (body.trim().length === 0) {
      setError('답변을 입력해 주세요');
      return;
    }
    if (body.length > BODY_MAX) {
      setError(`본문은 ${BODY_MAX.toLocaleString()}자를 넘을 수 없어요`);
      return;
    }

    startTransition(async () => {
      try {
        const created = await discussionApi.createPost(threadId, { body, parentId });
        setBody('');
        onCreated?.(created);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 401) {
          setError('로그인이 필요해요');
        } else if (status === 400) {
          setError('답변 형식이 올바르지 않아요 (1-level 답글만 허용)');
        } else if (status === 429) {
          setError('작성 분당 5회 한도를 초과했어요');
        } else {
          setError('답변 작성 중 오류가 발생했어요');
        }
      }
    });
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-2 rounded-md border border-border/40 bg-card/20 p-3"
      data-testid="post-composer"
      data-parent-id={parentId ?? ''}
    >
      <Textarea
        placeholder={placeholder ?? '답변 작성 (markdown)'}
        maxLength={BODY_MAX}
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        aria-label={parentId ? '답글 본문' : '답변 본문'}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {body.length} / {BODY_MAX.toLocaleString()}
        </span>
        <div className="flex gap-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isPending}
            >
              취소
            </Button>
          )}
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? '저장…' : parentId ? '답글 등록' : '답변 등록'}
          </Button>
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

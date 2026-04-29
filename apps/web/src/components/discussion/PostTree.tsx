import { PostNode } from './PostNode';
import type { PostDto } from '@/lib/discussion/types';

interface PostTreeProps {
  posts: PostDto[];
  threadId: string;
  threadAuthorId: string;
  currentUserId?: string | null;
  onPostCreated?: (post: PostDto) => void;
}

/**
 * PR-12 §6.1.5 — 1-level nested rendering.
 *
 * 1차: parentId === null
 * 2차: parentId === <parent.id> — 1-level nested 만 (백엔드도 1-level 만 허용).
 */
export function PostTree({
  posts,
  threadId,
  threadAuthorId,
  currentUserId = null,
  onPostCreated,
}: PostTreeProps) {
  const roots = posts.filter((p) => p.parentId === null);
  const childrenByParent = new Map<string, PostDto[]>();
  for (const p of posts) {
    if (p.parentId) {
      const list = childrenByParent.get(p.parentId) ?? [];
      list.push(p);
      childrenByParent.set(p.parentId, list);
    }
  }

  if (roots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="post-tree-empty">
        아직 답변이 없어요. 첫 답변을 남겨 주세요.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3" role="list" aria-label="답변 목록" data-testid="post-tree">
      {roots.map((root) => {
        const children = childrenByParent.get(root.id) ?? [];
        return (
          <li key={root.id}>
            <PostNode
              post={root}
              threadId={threadId}
              isThreadAuthor={currentUserId === threadAuthorId}
              currentUserId={currentUserId}
              onPostCreated={onPostCreated}
            >
              {children.map((child) => (
                <PostNode
                  key={child.id}
                  post={child}
                  threadId={threadId}
                  isThreadAuthor={false}
                  currentUserId={currentUserId}
                  onPostCreated={onPostCreated}
                />
              ))}
            </PostNode>
          </li>
        );
      })}
    </ul>
  );
}

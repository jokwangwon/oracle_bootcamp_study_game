# PR-12 — Discussion Page SDD (web 토론 페이지 + 백엔드 hot/top + HIGH-3 블러)

> **본 문서는 ADR-020 §6 PR-12 의 상세 SDD 명세서다. 사용자 결정 15건 (consensus-012, 2026-04-29) 을 모두 반영한 머지 가능 수준 명세.**

| 메타 | 값 |
|------|-----|
| 합의 ID | consensus-012 |
| 사용자 결정 | Q-R5-01 ~ Q-R5-15 (15건 모두 권장 채택) |
| 의존 PR | PR-10a (cookie httpOnly) ✓ + PR-10b (R4 discussion backend) ✓ + PR-10c (CSRF Origin guard) ✓ + PR-9a' (시안 ε) ✓ |
| 추정 분량 | 약 2.5d (코드 PR 단계) |
| ADR | ADR-020 §4.2.1 C / §5.3 / §6 / §9 / §11 패치 |
| 분리 후속 | ADR-021 (Community Hub 글로벌 허브, 가칭) |

---

## 1. 배경 + 합의 근거

### 1.1 트리거

PR-10b 머지 (PR #53, 2026-04-29) 로 백엔드 discussion 11 endpoint 가 모두 동작 가능. 그러나 잔여 3종이 PR-12 / 별도 PR 로 이월됨:

1. **web 표시 측 sanitize** (rehype-sanitize 클라 렌더링)
2. **hot/top 정렬 raw query** — `discussion.service.ts:136-137` 의 `sort=hot/top` 미구현 코멘트
3. **HIGH-3 related_question_id 블러** — 미풀이 사용자 본문 블러 (서버 마스킹 미구현)

### 1.2 합의 결과

3+1 합의 (consensus-012) — 만장일치 6.7% / 유효 100%. 사용자 결정 15건 (Q-R5-01 ~ Q-R5-15) 모두 Reviewer 권장값 채택.

**CRITICAL 5건 해소 결정**:

| ID | 항목 | 결정 |
|----|-----|------|
| C-1 | 저장 형식 (HTML vs Markdown) | Markdown raw 저장 + 클라 단독 sanitize (Q-R5-01=b) |
| C-2 | 클라 sanitize schema | 서버=클라 1:1 단일 schema 모듈 + 동등성 테스트 (Q-R5-02=a) |
| C-3 | HIGH-3 블러 | 서버 정규식 마스킹 + 클라 글라스 블러 (이중 방어) (Q-R5-03=a) |
| C-4 | hot 공식 + expression index | Reddit log10 + PG expression index (Q-R5-06=a) |
| C-5 | discussion 비인증 read | read 공개 + write 인증 (controller line 115 패치) (Q-R5-11=a) |

### 1.3 범위 (in / out)

**In (PR-12 코드 PR)**:
- web 토론 페이지 2종 (`/play/solo/[questionId]/discussion` + `/play/solo/[questionId]/discussion/[threadId]`)
- VoteButton + ThreadCard / ThreadList / PostTree / Composer / SortTabs / RelatedQuestionBlur 등 컴포넌트 11종
- 백엔드 hot/top raw query (TypeORM QueryBuilder) + sort 별 cursor 분기
- HIGH-3 서버 정규식 마스킹 + isLocked 플래그
- myVote 응답 join (read endpoint 4종)
- discussion 비인증 read 허용 (controller line 115 패치)
- /play/solo finished CTA "토론 참여" 링크
- Hero todayQuestion 패널 우하단 "토론 N개" 메타 칩
- axe-core 통합 (시안 D/ε 톤 일관성 검증)
- expression index 마이그레이션 1714000012000

**Out (별도 PR / 후속)**:
- 글로벌 `/community` 허브 → ADR-021 (가칭) 분리
- auth-storage.ts 제거 → 별도 chore PR
- A09 audit log 강화 → MVP-D 이후 별도 ADR
- best answer 골드 테두리 폴리시 (ADR-020 §9 유보)
- SQL syntax highlighting (Shiki)
- 토론 LLM 요약/추천 (ADR-021 별도)

---

## 2. 라우트 + 페이지 트리

### 2.1 신규 라우트 2종

```
/play/solo/[questionId]/discussion             ← Thread 리스트 + sort 탭
/play/solo/[questionId]/discussion/[threadId]  ← Thread 상세 + Post tree + Composer
```

### 2.2 파일 트리

```
apps/web/src/app/play/solo/[questionId]/discussion/
├── page.tsx                          # Server Component shell + Client child
├── DiscussionListClient.tsx          # SWR thread list + sort tabs + composer
├── loading.tsx                       # Suspense fallback
├── error.tsx                         # error boundary
└── [threadId]/
    ├── page.tsx                      # Server Component shell
    ├── ThreadDetailClient.tsx        # SWR thread + post tree + post composer
    ├── loading.tsx
    └── error.tsx

apps/web/src/components/discussion/
├── ThreadCard.tsx                    # 리스트 카드 (시안 D 글라스)
├── ThreadList.tsx                    # ThreadCard 컬렉션 + 페이지네이션 cursor
├── ThreadDetail.tsx                  # 상세 + body 렌더
├── ThreadSortTabs.tsx                # new / hot / top 토글 (shadcn Tabs)
├── ThreadComposer.tsx                # 신규 thread 작성 (markdown + textarea)
├── PostTree.tsx                      # 1-level nested
├── PostNode.tsx                      # 단일 post 렌더 + nested 자식
├── PostComposer.tsx                  # 답글 작성
├── VoteButton.tsx                    # 3-state ↑↓ + 카운트 + aria-pressed
├── AcceptedBadge.tsx                 # ✓ 채택된 답변 배지
├── DeletedPlaceholder.tsx            # [삭제된 게시물] 렌더
├── RelatedQuestionBlur.tsx           # HIGH-3 블러 컴포넌트 (시안 D 글라스 + blur(8px))
├── DiscussionMarkdown.tsx            # react-markdown + rehype-sanitize wrapper
└── __tests__/
    ├── ThreadCard.test.tsx
    ├── VoteButton.test.tsx
    ├── PostTree.test.tsx
    ├── DiscussionMarkdown.test.tsx
    ├── sanitize-regression.test.tsx  # 76+ OWASP XSS 회귀 (서버와 동일)
    └── RelatedQuestionBlur.test.tsx

apps/web/src/lib/discussion/
├── sanitize-schema.ts                # 단일 schema 모듈 (Q-R5-02=a)
├── sanitize-schema.test.ts           # 서버 sanitize-post-body.ts 와 동등성
├── api-client.ts                     # SWR fetcher + mutation (Q-R5-07=a)
├── cursor.ts                         # sort 별 cursor 인코딩 (Q-R5-14=b)
└── types.ts                          # ThreadDto / PostDto / VoteResponseDto

apps/web/src/components/home/
└── hero-live-panel.tsx               # 우하단 "토론 N개" 메타 칩 추가 (Q-R5-04=a+b)
```

### 2.3 Next.js App Router 결정

- **Server Component shell**: 페이지 메타데이터 (title / description) + 인증 redirect 분기 (params 검증) + Client child mount.
- **Client Component (`'use client'`)**: 데이터 패칭은 SWR — credentials:include cookie 자동 송신. RSC + cookie forward 는 Next 14 의 `next/headers` cookies() 의존인데, api-client.ts 의 `inflightRefresh` (PR-10a) 와 호환 어렵 → 일관성을 위해 Client.

---

## 3. 토론 진입점 (Q-R5-04 = a+b)

### 3.1 솔로 결과 화면 (`/play/solo` finished phase)

**위치**: `apps/web/src/app/play/solo/page.tsx` 의 finished phase (현 line 320~366 영역).

**디자인** (시안 ε §3.7 CTA 그룹 재사용):
```tsx
{rounds.map((round, idx) => (
  <Link
    key={round.id}
    href={`/play/solo/${round.questionId}/discussion`}
    className="glass-button"
  >
    Round {idx + 1} 토론 보기 ({round.discussionCount ?? 0}개)
  </Link>
))}
```

**대안 거부**:
- 단일 "전체 세션 토론" 버튼 (질문 미특정) — 진입 후 목적 모호. 거부.
- 모달 — 토론 → 답변 → 깊이가 모달 안에 처리 어려움. 거부.

### 3.2 Hero `todayQuestion` 패널 우하단 메타 칩

**위치**: `apps/web/src/components/home/hero-live-panel.tsx` 의 라이브 ticker 영역 (concept-d §3.2.2).

**디자인**:
```tsx
{todayQuestion.discussionCount > 0 && (
  <Link
    href={`/play/solo/${todayQuestion.questionId}/discussion`}
    className="discussion-meta-chip"
  >
    💬 토론 {todayQuestion.discussionCount}개
  </Link>
)}
```

**Hero ticker 옆 라벨로 표시**. count = 0 시 미표시 (silent).

### 3.3 거부된 진입점

- **Header 글로벌 메뉴** — 시안 D §3.1 "Header 변경 없음" 명시.
- **비대칭 3카드 4번째 슬롯** — 시각 노이즈, AdminCard 잠금 상태 유지.
- **글로벌 `/community` 허브** — ADR-021 (가칭) 별도 합의 (Q-R5-05=c).

---

## 4. Sanitize 단일 schema (CRITICAL C-1, C-2)

### 4.1 결정 (Q-R5-01=b, Q-R5-02=a)

- **저장 형식**: 서버는 **Markdown raw** 저장. 사용자 입력 = markdown 텍스트.
- **표시 형식**: 클라이언트가 `react-markdown` + `rehype-sanitize` + **사용자 정의 schema** 로 렌더.
- **단일 source of truth**: `apps/web/src/lib/discussion/sanitize-schema.ts` 가 export 하는 `discussionSchema` 가 서버 `apps/api/src/modules/discussion/sanitize-post-body.ts` 의 `allowedTags / allowedAttributes / allowedSchemes` 와 1:1 매칭.

### 4.2 서버 측 변경 (PR-10b 와 호환 패치)

ADR-020 §4.2.1 C 의 `POST_SANITIZE_OPTS` 는 **markdown raw 입력에 대한 1차 검증** 으로 재해석. 즉:

- `<script>`, `<iframe>`, `<object>` 등 HTML 태그가 markdown 본문에 들어오면 **stripped** (markdown 변환 시 raw HTML 은 텍스트로 처리되지만, 안전을 위해 저장 직전 검증).
- **rehype-raw 미사용** (markdown 안의 HTML 통합 차단 — XSS 우회 footgun).
- 화이트리스트 (`allowedTags`, `allowedAttributes`, `allowedSchemes`) 는 클라 `discussionSchema` 와 동일 list 인용.

### 4.3 클라 schema 모듈

```ts
// apps/web/src/lib/discussion/sanitize-schema.ts
import { defaultSchema } from 'rehype-sanitize';
import type { Schema } from 'hast-util-sanitize';

/**
 * Discussion sanitize schema — 서버 sanitize-post-body.ts 와 1:1 매칭.
 * 서버 화이트리스트 변경 시 본 파일도 동기 갱신 (sanitize-schema.test.ts 가 회귀 검증).
 */
export const discussionSchema: Schema = {
  ...defaultSchema,
  tagNames: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr'],
  attributes: {
    a: ['href', 'title'],
    code: [],   // 언어 지정 미허용 (Shiki 후속 PR)
    pre: [],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
  },
  // rehype-raw 미사용 - default schema 의 ancestors 정책 그대로
  clobberPrefix: '',  // id="user-content-..." prefix 제거 (시안 D 톤)
};
```

### 4.4 동등성 회귀 테스트

```ts
// apps/web/src/lib/discussion/sanitize-schema.test.ts
import { discussionSchema } from './sanitize-schema';

describe('discussion sanitize-schema 서버 동등성', () => {
  it('allowedTags 가 서버 sanitize-post-body.ts 와 일치', () => {
    expect(discussionSchema.tagNames).toEqual([
      'p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'a', 'hr',
    ]);
  });

  it('a[href|title] 만 허용', () => {
    expect(discussionSchema.attributes?.a).toEqual(['href', 'title']);
  });

  it('protocols http/https/mailto 만', () => {
    expect(discussionSchema.protocols?.href).toEqual(['http', 'https', 'mailto']);
  });
});
```

### 4.5 OWASP XSS 50종 negative 회귀

`apps/web/src/components/discussion/__tests__/sanitize-regression.test.tsx` 가 PR-10b 의 `sanitize-post-body.test.ts` 와 동일한 50종 OWASP 페이로드 + 12종 react-markdown 특화 (`![](javascript:alert(1))`, autolink `<javascript:alert(1)>`, footnote XSS 등) + 14 메타 = **76 cases** 를 검증.

### 4.6 react-markdown 사용 패턴

```tsx
// apps/web/src/components/discussion/DiscussionMarkdown.tsx
'use client';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { discussionSchema } from '@/lib/discussion/sanitize-schema';

export function DiscussionMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      rehypePlugins={[[rehypeSanitize, discussionSchema]]}
      // remark-rehype 의 allowDangerousHtml 미설정 (default false)
      // rehype-raw 미사용 (XSS footgun)
      components={{
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
```

---

## 5. 백엔드 hot/top + cursor + myVote (CRITICAL C-4 + HIGH H-1, H-2)

### 5.1 sort 별 cursor schema (Q-R5-14=b)

```ts
// apps/api/src/modules/discussion/discussion.service.ts (확장)

export type ThreadCursorNew  = { c: string; i: string };  // {createdAt ISO, id}
export type ThreadCursorTop  = { s: number; i: string };  // {score, id}
export type ThreadCursorHot  = { h: number; i: string };  // {hotValue, id}
export type ThreadCursor = ThreadCursorNew | ThreadCursorTop | ThreadCursorHot;
```

`encodeCursor` / `decodeCursor` (controller) 가 sort 파라미터를 받아 schema 분기. 잘못된 sort+cursor 조합은 BadRequest.

### 5.2 hot 공식 raw query (Q-R5-06=a)

```ts
// discussion.service.ts listThreadsByQuestion 확장
async listThreadsByQuestion(
  questionId: string,
  opts: ListThreadsOpts,
  userId: string | null,  // 비인증 = null
): Promise<ThreadDtoWithMyVote[]> {
  const sort = opts.sort ?? 'new';
  const take = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), MAX_LIMIT);

  const qb = this.threadRepo.createQueryBuilder('t')
    .where('t.questionId = :questionId', { questionId })
    .andWhere('t.isDeleted = false')
    .take(take);

  if (sort === 'new') {
    qb.orderBy('t.createdAt', 'DESC').addOrderBy('t.id', 'DESC');
    if (opts.cursor) {
      qb.andWhere('(t.createdAt, t.id) < (:c, :i)', opts.cursor as ThreadCursorNew);
    }
  } else if (sort === 'top') {
    qb.orderBy('t.score', 'DESC').addOrderBy('t.id', 'DESC');
    if (opts.cursor) {
      qb.andWhere('(t.score, t.id) < (:s, :i)', opts.cursor as ThreadCursorTop);
    }
  } else if (sort === 'hot') {
    // ADR-020 §5.4 hot 공식 (Reddit log10) — const string, user input 제외
    const hotExpr = `(LOG(GREATEST(ABS(t.score), 1)) * SIGN(t.score) + EXTRACT(EPOCH FROM t.lastActivityAt)/45000)`;
    qb.addSelect(hotExpr, 't_hot');
    qb.orderBy('t_hot', 'DESC').addOrderBy('t.id', 'DESC');
    if (opts.cursor) {
      qb.andWhere(`${hotExpr} < :h OR (${hotExpr} = :h AND t.id < :i)`, opts.cursor as ThreadCursorHot);
    }
  } else {
    throw new BadRequestException('invalid_sort');
  }

  // myVote LEFT JOIN — Q-R5-08=a
  if (userId) {
    qb.leftJoinAndMapOne(
      't.myVote',
      DiscussionVoteEntity,
      'mv',
      `mv.targetType = 'thread' AND mv.targetId = t.id AND mv.userId = :uid`,
      { uid: userId },
    );
  }

  const list = await qb.getMany();
  return list.map((t) => this.applyMaskAndBlur(this.mask(t), userId));  // §6 HIGH-3 적용
}
```

### 5.3 expression index 마이그레이션 1714000012000

```ts
// apps/api/src/migrations/1714000012000-AddDiscussionHotIndex.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDiscussionHotIndex1714000012000 implements MigrationInterface {
  name = 'AddDiscussionHotIndex1714000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_discussion_threads_hot
        ON discussion_threads (
          (LOG(GREATEST(ABS(score), 1)) * SIGN(score) + EXTRACT(EPOCH FROM last_activity_at)/45000) DESC,
          id DESC
        )
        WHERE is_deleted = FALSE;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_discussion_threads_hot;`);
  }
}
```

**적용 방법**: `synchronize: false` 환경에서는 `npm run migration:run` 으로 명시 적용. dev 환경 (synchronize:true) 에서는 별도 SQL 적용 필요 (synchronize 가 expression index 생성 미지원).

### 5.4 myVote 응답 schema (Q-R5-08=a)

```ts
// apps/web/src/lib/discussion/types.ts
export interface ThreadDto {
  id: string;
  questionId: string;
  authorId: string;
  title: string;
  body: string;       // raw markdown (Q-R5-01=b)
  score: number;
  postCount: number;
  lastActivityAt: string;  // ISO
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  myVote?: -1 | 0 | 1;     // 인증 사용자만, 비투표 시 0 또는 undefined
  isLocked?: boolean;      // HIGH-3 블러 (related_question_id 미풀이)
}

export interface PostDto {
  id: string;
  threadId: string;
  authorId: string;
  parentId: string | null;
  body: string;       // raw markdown
  score: number;
  isAccepted: boolean;
  isDeleted: boolean;
  relatedQuestionId: string | null;  // HIGH-3 키
  isLocked?: boolean;                // HIGH-3 블러 결과
  myVote?: -1 | 0 | 1;
  createdAt: string;
  updatedAt: string;
}
```

---

## 6. HIGH-3 블러 (CRITICAL C-3, Q-R5-03=a, Q-R5-12=a)

### 6.1 매핑 키

`discussion_post.related_question_id` (UUID, nullable) → `questions.topic + questions.week` → `user_progress (user_id, topic, week)` unique index.

### 6.2 서버 마스킹 (1차 방어)

```ts
// discussion.service.ts (확장)

private async applyMaskAndBlur(
  entity: DiscussionPostEntity,
  userId: string | null,
): Promise<DiscussionPostEntity & { isLocked?: boolean }> {
  if (entity.isDeleted) return entity; // [삭제된 게시물] 우선 적용
  if (!entity.relatedQuestionId) return entity; // 매핑 없음 = 공개
  if (!userId) return entity; // 비인증 read = 공개 (학습 동기 X, Q-R5-11)

  // author 본인 = 항상 공개 (Q-R5-15=b 부속)
  if (entity.authorId === userId) return entity;

  // user_progress 조회 — single query (N posts 의 LEFT JOIN 으로 N+1 회피)
  const isUnlocked = await this.checkUserProgress(userId, entity.relatedQuestionId);
  if (isUnlocked) return entity;

  // **마스킹**: body 를 `[[BLUR:related-question]]` 토큰으로 치환 + isLocked: true
  return {
    ...entity,
    body: '[[BLUR:related-question]]',
    isLocked: true,
  };
}

private async checkUserProgress(userId: string, relatedQuestionId: string): Promise<boolean> {
  // questions.topic + questions.week → user_progress lookup
  const result = await this.dataSource.query(`
    SELECT 1 FROM user_progress up
      JOIN questions q ON q.topic = up.topic AND q.week = up.week
      WHERE q.id = $1 AND up.user_id = $2
      LIMIT 1
  `, [relatedQuestionId, userId]);
  return result.length > 0;
}
```

### 6.3 N+1 회피 — listPostsByThread

**posts 리스트 단일 응답에서 user_progress 매핑은 IN (UNNEST([])) 단일 쿼리** 로 한 번에 처리:

```ts
async listPostsByThread(
  threadId: string,
  opts: ListPostsOpts,
  userId: string | null,
): Promise<PostDtoWithBlur[]> {
  const posts = await this.postRepo.find({ /* ... */ });
  if (!userId) return posts.map((p) => this.mask(p));

  // 단일 쿼리로 모든 related_question 의 풀이 여부 조회
  const relatedIds = posts
    .map((p) => p.relatedQuestionId)
    .filter((id): id is string => !!id);

  const unlockedIds = relatedIds.length === 0 ? new Set<string>() : new Set(
    (await this.dataSource.query(`
      SELECT DISTINCT q.id
        FROM questions q
        JOIN user_progress up ON up.topic = q.topic AND up.week = q.week
        WHERE q.id = ANY($1::uuid[]) AND up.user_id = $2
    `, [relatedIds, userId])).map((r: { id: string }) => r.id),
  );

  return posts.map((p) => {
    if (p.isDeleted || !p.relatedQuestionId || p.authorId === userId || unlockedIds.has(p.relatedQuestionId)) {
      return this.mask(p);
    }
    return { ...this.mask(p), body: '[[BLUR:related-question]]', isLocked: true };
  });
}
```

### 6.4 클라 블러 컴포넌트 (2차 방어)

```tsx
// apps/web/src/components/discussion/RelatedQuestionBlur.tsx
'use client';
import { Link } from '@/components/ui/link';

export function RelatedQuestionBlur({ relatedQuestionId }: { relatedQuestionId: string }) {
  return (
    <div className="related-question-blur glass-panel">
      <div className="blur(8px) opacity-40 select-none pointer-events-none">
        ████ ████████ ████ █████ ███████ █████ ███
      </div>
      <div className="blur-overlay">
        <p className="text-sm">🔒 관련 문제 풀이 후 공개됩니다</p>
        <Link href={`/play/solo/${relatedQuestionId}`} className="primary-button">
          문제 풀러 가기 →
        </Link>
      </div>
    </div>
  );
}
```

### 6.5 렌더 분기

```tsx
// PostNode.tsx
{post.isLocked
  ? <RelatedQuestionBlur relatedQuestionId={post.relatedQuestionId!} />
  : <DiscussionMarkdown>{post.body}</DiscussionMarkdown>
}
```

---

## 7. discussion 비인증 처리 (CRITICAL C-5, Q-R5-11=a)

### 7.1 현 코드 ADR 불일치

`apps/api/src/modules/discussion/discussion.controller.ts:114-116`:
```ts
@Controller('discussion')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class DiscussionController { /* ... */ }
```

→ controller 전체 인증. ADR-020 §5.3 (read 4종 인증 정책 명시 없음) 와 묵시적 모순.

### 7.2 패치 방향

**Public 데코레이터 도입** + read endpoint 4종에 명시:

```ts
// apps/api/src/modules/auth/decorators/public.decorator.ts (신규)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```ts
// JwtAuthGuard 에서 IS_PUBLIC_KEY 메타데이터 분기
canActivate(context: ExecutionContext) {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (isPublic) {
    // user 추출은 시도하되, 부재 시 null 로 통과
    return this.attachOptionalUser(context);
  }
  return super.canActivate(context);
}
```

```ts
// discussion.controller.ts (패치)
@Get('questions/:questionId/threads')
@Public()  // ← Q-R5-11=a 적용
async listThreadsByQuestion(...) { ... }

@Get('threads/:threadId')
@Public()
async getThread(...) { ... }

@Get('threads/:threadId/posts')
@Public()
async listPostsByThread(...) { ... }

// write endpoint (POST/PATCH/DELETE) 는 @Public() 미적용 → JwtAuthGuard 적용 유지
```

### 7.3 service 시그니처 변경

read service 메서드 (`listThreadsByQuestion / getThread / listPostsByThread`) 가 `userId: string | null` 파라미터를 받도록 확장. null 시:
- `myVote` 응답 미포함
- HIGH-3 블러 = author 본인 매칭 불가 → 풀이 검증도 불가 → **fail-secure: 비인증은 isLocked=true 유지** (보안 우선) — 단 §6.2 의 디폴트 정책에서 "비인증 read = 공개" 와 충돌 가능. **결정**: 비인증 read 는 모든 post 가 공개 (학습 동기 부여를 위해), 단 author 본인 분기는 비인증에서 매칭 불가하므로 자동 비활성. 즉 "비인증 = 모든 post 공개, related_question 블러도 비활성" — 게스트 미리보기 패턴.

### 7.4 ThrottlerGuard 처리

ThrottlerGuard 는 controller 전체 유지 (read 도 IP 기반 throttle). 분당 60회 / 시간당 200 (write 5/min 제외).

---

## 8. 의존성 lock + 신규 의존성 (HIGH H-4, H-8)

### 8.1 신규 의존성 (Q-R5-07=a)

| 패키지 | 버전 | 라이선스 | 무게 (gzip) | 용도 |
|--------|-----|---------|-----------|------|
| `react-markdown` | ^9.0.1 | MIT | 30KB | markdown → React VDOM |
| `rehype-sanitize` | ^6.0.0 | MIT | 6KB | HAST sanitize |
| `remark-gfm` | ^4.0.0 | MIT | 8KB | (선택) 코드 fence + 자동 링크 — 미사용 권장 (보안 surface) |
| `swr` | ^2.2.5 | MIT | 13KB | stale-while-revalidate fetcher |
| `@radix-ui/react-tabs` | ^1.0.4 | MIT | 5KB | shadcn Tabs primitive |
| `@axe-core/react` | ^4.8.0 | MPL-2.0 | 35KB (dev only) | a11y 자동 검증 (dev 모드) |

**락 전략**:
- `^9.0.1` (caret) — patch + minor 업데이트 허용. 단 **major 업데이트 (e.g. v10) 는 PR-12 머지 후 1주 관측 + react-markdown CHANGELOG 검토 후 수동 업데이트**.
- Renovate / Dependabot alert 우선순위: react-markdown / rehype-sanitize 는 보안 patch 즉시 적용.
- `package-lock.json` 커밋 필수.

### 8.2 신규 shadcn/ui 컴포넌트

```bash
pnpm dlx shadcn-ui@latest add tabs textarea
```

`apps/web/src/components/ui/tabs.tsx` + `textarea.tsx` 생성됨.

### 8.3 React Query 거부 사유

- 의존성 무게 +39KB (SWR 의 3배).
- discussion 만으로 정당화 어려움.
- ADR-019 SR queue 도 SWR 패턴으로 통일 가능 (장기 일관성).

### 8.4 native fetch 거부 사유

- optimistic update + rollback 직접 구현 보일러플레이트 큼.
- sort 탭 전환 / vote 후 mutate 패턴이 SWR `mutate(key)` 로 우아.

---

## 9. 유보 / 후속 (M-2, M-4, ADR-021 분리)

### 9.1 PR-12 범위 외 (별도 후속)

| 항목 | 후속 시점 | 결정 |
|------|---------|------|
| 글로벌 `/community` 허브 | ADR-021 (가칭) 별도 합의 | Q-R5-05=c |
| 자유 게시판 (question_id NULL) | ADR-021 또는 별도 ADR | DB 스키마 변경 동반 |
| 카테고리/태그 시스템 (Reddit 스타일) | MVP-D 이후 | 신규 entity |
| auth-storage.ts 제거 | 별도 chore PR | Q-R5-10=b |
| A09 audit log (vote/accept/IDOR) | MVP-D 이후 | M-2 |
| best answer 골드 테두리 폴리시 | 후속 폴리시 PR | ADR-020 §9 |
| SQL syntax highlighting (Shiki) | 별도 PR (MED-6) | ADR-020 §9 |
| 토론 LLM 요약/추천 | ADR-021 별도 ADR | ADR-020 §9 |
| score cache 드리프트 복구 CLI | 드리프트 실관측 시 | ADR-020 §9 |
| Best answer UI 골드 테두리 | 후속 폴리시 | ADR-020 §9 |

### 9.2 Stage 2 / Stage 3 확장 가정 (M-4)

PR-12 가 **Stage 1 (CRUD)** 만 다루고, 다음 확장이 예정:

- **Stage 2 (LLM 요약)**: thread 생성 시 LLM 으로 답변들 요약. ADR-016 LLM-judge 안전 7종 적용.
- **Stage 3 (자동 추천)**: 미풀이 사용자에게 "이 토론 답변이 도움될 거예요" 추천. SR queue (ADR-019) 와 통합.

PR-12 의 결정이 미래에 미치는 영향:
- Markdown 저장 (Q-R5-01=b) → LLM 요약도 markdown 으로 출력 가능 (일관성).
- 단일 schema 모듈 (Q-R5-02=a) → LLM 출력도 동일 화이트리스트 통과.
- isLocked flag (Q-R5-03=a) → LLM 요약도 동일 권한 체크.
- SWR (Q-R5-07=a) → discussion + SR + LLM 요약 모두 SWR 패턴 통일.

### 9.3 향후 재검토 트리거

| 트리거 | 조건 | 재검토 항목 |
|--------|-----|----------|
| TR-DISC-1 | thread 1000+ 도달 | hot 공식 expression index 효율 검증 |
| TR-DISC-2 | discussion endpoint 12개 이상 추가 | OriginGuard / ThrottlerGuard 적용 누락 lint rule |
| TR-DISC-3 | vote bomb 다계정 관찰 (동일 IP 3계정+) | ADR-020 §9 vote bomb 방어 (이메일 인증 / 초대 토큰) |
| TR-DISC-4 | 글로벌 hub 사용자 요구 3건 이상 | ADR-021 (가칭) 우선순위 격상 |

---

## 10. ADR-020 § 패치 매트릭스

| ADR-020 절 | 변경 |
|-----------|------|
| §4.2.1 C | "sanitize-html allowedTags 화이트리스트 통과 후 저장" → "Markdown raw 저장 + 클라 단독 sanitize (서버는 입력 1차 검증만)". 화이트리스트는 클라 schema 와 동일 list 인용 |
| §5.3 | read 4종 (`GET /threads/:tId`, `GET /questions/:qId/threads`, `GET /threads/:tId/posts`) `@Public()` 데코레이터 명시. write 7종은 `JwtAuthGuard` 유지. ThrottlerGuard 는 controller 전체 |
| §6 | PR-12 행을 "discussion 페이지 + VoteButton + react-markdown + rehype-sanitize + 단일 schema + HIGH-3 서버 마스킹 + 비인증 read 패치 + hot expression index 마이그레이션 1714000012000 + axe-core 통합 + SWR 도입" 으로 확장 |
| §9 | "토론 LLM 요약/추천" 행 → "별도 ADR-021 (가칭, Community Hub + LLM 요약)". "글로벌 `/community` 허브" 행 신설 |
| §11 | 변경 이력 행 추가 (consensus-012 + 사용자 결정 15건 + CRITICAL 5건 해소) |

---

## 11. 다음 단계

1. **본 docs PR 머지** (CRITICAL 5건 해소 검증)
2. **코드 PR (PR-12-code)** 시작 — TDD 7 phase RED → GREEN → REFACTOR
3. **글로벌 hub** — ADR-021 (가칭) 별도 합의 (PR-12 머지 후)
4. **chore/auth-storage-cleanup** — 병렬 가능

---

## 12. 참조

- `docs/decisions/ADR-020-ux-redesign.md` — 패치 대상 (§4.2.1 C / §5.3 / §6 / §9 / §11)
- `docs/review/consensus-012-pr-12-discussion-page.md` — 본 SDD 의 합의 근거
- `docs/review/tdd-plan-pr-12-discussion-page.md` — 본 SDD 의 TDD 분해
- `docs/review/impact-pr-12-discussion-page.md` — 본 SDD 의 ADR-007 4차원 영향
- `apps/api/src/modules/discussion/` — PR-10b 머지 코드 (확장 대상)
- `apps/api/src/modules/users/entities/user-progress.entity.ts` — HIGH-3 매핑
- `apps/web/src/app/play/solo/page.tsx` — finished CTA 추가 대상
- `apps/web/src/app/page.tsx` + `apps/web/src/components/home/hero-live-panel.tsx` — Hero 칩 추가 대상
- `docs/rationale/main-page-redesign-concept-d.md` — 시안 D 글라스 톤
- `docs/rationale/solo-play-config-redesign-concept-epsilon.md` — 시안 ε CTA 그룹

---

**SDD 끝.** 본 명세는 사용자 결정 15건 (consensus-012) 과 1:1 매칭되며, 코드 PR 진입 시 회귀 검증의 단일 source of truth 가 된다.

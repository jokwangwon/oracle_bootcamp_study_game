import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapTestApp } from './e2e-setup';
import { bearerHeader, registerUser, type TestUser } from './helpers/login-helper';
import { clearUserData } from './helpers/seed-helper';

/**
 * PR-13 (consensus-013, ADR-021) — Discussion e2e
 *
 * SDD §5 회귀 매트릭스:
 *  - hotfix #3 contract mismatch — 응답 schema 검증
 *  - hotfix #5 Throttler 부적합 — login throttle 후 다른 endpoint 영향 없음
 *  - hotfix #6 vote shape — `{ change: number }` 응답
 *  - hotfix #7 self-vote 차단 — 본인 글 vote → 403 (1714000012000 trigger)
 */

let app: INestApplication;
let questionId: string;

async function seedQuestion(app: INestApplication): Promise<string> {
  const ds = app.get(DataSource);
  const rows = await ds.query<{ id: string }[]>(`
    INSERT INTO questions (topic, week, game_mode, difficulty, content, answer, status, source)
    VALUES (
      'sql-basics', 1, 'blank-typing', 'easy',
      '{"sql":"SELECT 1 FROM ___","blanks":[{"position":0,"answer":"DUAL"}]}'::jsonb,
      '["DUAL"]'::jsonb,
      'approved', 'manual'
    )
    RETURNING id
  `);
  return rows[0].id;
}

beforeAll(async () => {
  app = await bootstrapTestApp();
});

afterAll(async () => {
  await app?.close();
});

beforeEach(async () => {
  await clearUserData(app);
  // questions 테이블도 정리 — discussion threads 가 question_id 참조
  const ds = app.get(DataSource);
  await ds.query(`TRUNCATE TABLE questions RESTART IDENTITY CASCADE`);
  questionId = await seedQuestion(app);
});

describe('Discussion e2e', () => {
  it('hotfix #6 — vote 응답 shape 가 { change: number }', async () => {
    const author = await registerUser(app);
    const voter = await registerUser(app);

    // thread 생성 (author)
    const threadRes = await request(app.getHttpServer())
      .post(`/discussion/questions/${questionId}/threads`)
      .set(bearerHeader(author))
      .send({ title: 'e2e thread for vote shape', body: '본문 내용 100자 이상은 아닐 듯' });
    expect([200, 201]).toContain(threadRes.status);
    const threadId = threadRes.body.id as string;
    expect(typeof threadId).toBe('string');

    // vote (voter)
    const voteRes = await request(app.getHttpServer())
      .post('/discussion/vote')
      .set(bearerHeader(voter))
      .send({ targetType: 'thread', targetId: threadId, value: 1 });

    expect([200, 201]).toContain(voteRes.status);
    expect(voteRes.body).toEqual({ change: expect.any(Number) });
    expect(voteRes.body.change).toBe(1);
  });

  it('hotfix #7 — 본인 thread 에 vote → 403 (self_vote trigger)', async () => {
    const author = await registerUser(app);

    const threadRes = await request(app.getHttpServer())
      .post(`/discussion/questions/${questionId}/threads`)
      .set(bearerHeader(author))
      .send({ title: 'my own thread', body: 'self-vote 차단 검증용 본문' });
    const threadId = threadRes.body.id as string;

    const voteRes = await request(app.getHttpServer())
      .post('/discussion/vote')
      .set(bearerHeader(author)) // 본인
      .send({ targetType: 'thread', targetId: threadId, value: 1 });

    expect(voteRes.status).toBe(403);
  });

  it('hotfix #3 — GET /discussion/threads/:id 응답 schema (ThreadDto 핵심 필드)', async () => {
    const u = await registerUser(app);

    const createRes = await request(app.getHttpServer())
      .post(`/discussion/questions/${questionId}/threads`)
      .set(bearerHeader(u))
      .send({ title: 'contract test thread', body: 'contract 검증용 본문 내용' });
    const threadId = createRes.body.id as string;

    const getRes = await request(app.getHttpServer())
      .get(`/discussion/threads/${threadId}`)
      .set(bearerHeader(u));

    expect(getRes.status).toBe(200);
    const body = getRes.body as Record<string, unknown>;
    // ThreadDto 핵심 필드 (PR-12 §3) — 누락 시 클라/서버 schema mismatch
    expect(body).toHaveProperty('id', threadId);
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('score');
    expect(typeof body.score).toBe('number');
  });

  it('hotfix #5 — login 5회 후 다른 endpoint 정상 (Throttler scope 분리)', async () => {
    // login throttle = 15분 5회. 5회 시도 후 다른 endpoint 가 차단되면 안 됨
    const u = await registerUser(app);

    // login 5회 시도 (잘못된 비밀번호 — 모두 401, throttle 한도 도달)
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: u.email, password: `WrongPassword!${i}` });
    }

    // 다른 endpoint (/users/me) 는 영향 없어야 — Throttler scope 분리
    const meRes = await request(app.getHttpServer())
      .get('/users/me')
      .set(bearerHeader(u));
    expect(meRes.status).toBe(200);
  });

  it('비인증 GET /discussion/threads/:id → 200 (PR-12 @Public)', async () => {
    const u = await registerUser(app);
    const createRes = await request(app.getHttpServer())
      .post(`/discussion/questions/${questionId}/threads`)
      .set(bearerHeader(u))
      .send({ title: 'public read', body: '비인증 read 검증' });
    const threadId = createRes.body.id as string;

    const getRes = await request(app.getHttpServer()).get(
      `/discussion/threads/${threadId}`,
    );
    expect(getRes.status).toBe(200);
  });
});

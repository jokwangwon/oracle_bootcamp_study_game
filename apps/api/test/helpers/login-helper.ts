import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * PR-13 Phase 1B (consensus-013) — 인증 helper.
 *
 * Session 14 §3.1 hotfix #2 (jsonwebtoken expiresIn + exp 충돌, mock JwtService)
 * 회귀 차단 — 실 JwtService 가 생성한 토큰을 그대로 사용한다.
 *
 * 백엔드 컨벤션:
 *  - register DTO = { username, email, password }
 *  - login DTO    = { email, password }  (auth.controller.ts:119 — login(dto.email, ...))
 *  - 응답 = { accessToken, refreshToken } + Set-Cookie (dual-mode)
 *
 * id 는 응답에 없으므로 JWT payload.sub 에서 추출.
 */

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
  cookies: string[];
}

let counter = 0;

export function uniqueUsername(prefix = 'e2e'): string {
  counter += 1;
  return `${prefix}_${Date.now()}_${counter}_${Math.random().toString(36).slice(2, 6)}`;
}

function decodeJwtSub(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error(`[e2e] invalid jwt: ${token.slice(0, 20)}...`);
  }
  const payload = JSON.parse(
    Buffer.from(parts[1], 'base64url').toString('utf8'),
  ) as { sub?: string };
  if (!payload.sub) {
    throw new Error('[e2e] jwt missing sub claim');
  }
  return payload.sub;
}

export async function registerUser(
  app: INestApplication,
  overrides: Partial<{ username: string; email: string; password: string }> = {},
): Promise<TestUser> {
  const username = overrides.username ?? uniqueUsername();
  const email = overrides.email ?? `${username}@e2e.test`;
  const password = overrides.password ?? 'E2eTest!Password123';

  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ username, email, password });

  if (res.status !== 201 && res.status !== 200) {
    throw new Error(
      `[e2e] register expected 201/200, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }

  const body = res.body as { accessToken?: string; refreshToken?: string };
  const accessToken = body.accessToken ?? '';
  const refreshToken = body.refreshToken ?? '';
  const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];

  if (!accessToken) {
    throw new Error(`[e2e] register response missing accessToken: ${JSON.stringify(body)}`);
  }

  return {
    id: decodeJwtSub(accessToken),
    username,
    email,
    password,
    accessToken,
    refreshToken,
    cookies,
  };
}

export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string; cookies: string[] }> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password });

  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `[e2e] login expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }

  const body = res.body as { accessToken?: string; refreshToken?: string };
  return {
    accessToken: body.accessToken ?? '',
    refreshToken: body.refreshToken ?? '',
    cookies: (res.headers['set-cookie'] ?? []) as unknown as string[],
  };
}

export async function registerAndLogin(
  app: INestApplication,
  overrides: Partial<{ username: string; email: string; password: string }> = {},
): Promise<TestUser> {
  return registerUser(app, overrides);
}

export function bearerHeader(user: TestUser): { Authorization: string } {
  return { Authorization: `Bearer ${user.accessToken}` };
}

export function cookieHeader(cookies: string[]): { Cookie: string } {
  // Set-Cookie 응답에서 key=value 만 추출 (Path/Max-Age/HttpOnly/SameSite 등 attribute 제외).
  // 클라이언트가 다음 요청에 보낼 Cookie 헤더는 `key=value; key2=value2` 형식만 유효.
  const kv = cookies
    .map((c) => c.split(';')[0]?.trim())
    .filter((c): c is string => Boolean(c))
    .join('; ');
  return { Cookie: kv };
}

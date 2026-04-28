import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { applySecurityMiddleware, buildHelmetOptions } from './security-middleware';

/**
 * ADR-020 §4.1 PR-3a (CRITICAL-B1) — helmet middleware 검증.
 *
 * 본 PR 의 helmet 옵션은 다음 3가지를 명시:
 *  1. `contentSecurityPolicy: false`  — Next.js `next.config.mjs` (PR-3b) 가 단독 관리
 *  2. `crossOriginEmbedderPolicy: false` — 외부 자원(폰트/이미지) 호환
 *  3. `hsts`: production 만 활성화 — tailscale `100.102.41.122:3002` HTTP 환경 차단 방지
 *
 * 그 외 helmet default 헤더 (X-Content-Type-Options 등 6+종) 는 그대로 유지.
 *
 * NestJS 전체 부팅 회피 — Express 인스턴스 + supertest 로 helmet 출력만 격리 검증.
 */

describe('buildHelmetOptions — env 분기', () => {
  it('NODE_ENV=production → hsts 활성 (maxAge>0, includeSubDomains)', () => {
    const opts = buildHelmetOptions({ NODE_ENV: 'production' });
    expect(opts.contentSecurityPolicy).toBe(false);
    expect(opts.crossOriginEmbedderPolicy).toBe(false);
    expect(opts.hsts).toMatchObject({ maxAge: 15552000, includeSubDomains: true });
  });

  it('NODE_ENV=development → hsts:false', () => {
    const opts = buildHelmetOptions({ NODE_ENV: 'development' });
    expect(opts.hsts).toBe(false);
  });

  it('NODE_ENV=test → hsts:false', () => {
    const opts = buildHelmetOptions({ NODE_ENV: 'test' });
    expect(opts.hsts).toBe(false);
  });

  it('NODE_ENV 미설정 → hsts:false (안전 기본)', () => {
    const opts = buildHelmetOptions({});
    expect(opts.hsts).toBe(false);
  });

  it('contentSecurityPolicy / crossOriginEmbedderPolicy 는 모든 환경에서 false', () => {
    for (const env of ['production', 'development', 'test', undefined]) {
      const opts = buildHelmetOptions(env ? { NODE_ENV: env } : {});
      expect(opts.contentSecurityPolicy).toBe(false);
      expect(opts.crossOriginEmbedderPolicy).toBe(false);
    }
  });
});

function buildTestApp(env: NodeJS.ProcessEnv): express.Express {
  const app = express();
  // applySecurityMiddleware 는 INestApplication 의 `use()` 만 호출하므로
  // duck-type 호환 Express 로 통합 검증 가능.
  applySecurityMiddleware(app as unknown as Parameters<typeof applySecurityMiddleware>[0], env);
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

describe('applySecurityMiddleware — 응답 헤더 (helmet default 6종)', () => {
  it('X-Content-Type-Options: nosniff', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('X-Frame-Options: SAMEORIGIN (clickjacking 방어)', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('Referrer-Policy: no-referrer', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('X-DNS-Prefetch-Control: off', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('X-Download-Options: noopen', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['x-download-options']).toBe('noopen');
  });

  it('X-Permitted-Cross-Domain-Policies: none', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['x-permitted-cross-domain-policies']).toBe('none');
  });

  it('X-Powered-By 헤더는 set 되지 않는다 (Express default 노출 차단)', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('applySecurityMiddleware — HSTS 환경 분기 (CRITICAL-1 가드)', () => {
  it('production: Strict-Transport-Security 헤더 존재 + max-age=15552000 + includeSubDomains', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'production' })).get('/health');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=15552000/);
    expect(res.headers['strict-transport-security']).toMatch(/includeSubDomains/);
  });

  it('development: Strict-Transport-Security 헤더 부재 (tailscale HTTP 차단 방지)', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'development' })).get('/health');
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('test: Strict-Transport-Security 헤더 부재', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'test' })).get('/health');
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });

  it('NODE_ENV 미설정: Strict-Transport-Security 헤더 부재 (안전 기본)', async () => {
    const res = await request(buildTestApp({})).get('/health');
    expect(res.headers['strict-transport-security']).toBeUndefined();
  });
});

describe('applySecurityMiddleware — Content-Security-Policy / COEP 옵트아웃', () => {
  it('Content-Security-Policy 헤더 부재 (Next.js 가 단독 관리, PR-3b 에서 추가)', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'production' })).get('/health');
    expect(res.headers['content-security-policy']).toBeUndefined();
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
  });

  it('Cross-Origin-Embedder-Policy 헤더 부재 (외부 자원 호환)', async () => {
    const res = await request(buildTestApp({ NODE_ENV: 'production' })).get('/health');
    expect(res.headers['cross-origin-embedder-policy']).toBeUndefined();
  });
});

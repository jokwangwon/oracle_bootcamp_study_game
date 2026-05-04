import { randomUUID } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import type IORedis from 'ioredis';
import jwt from 'jsonwebtoken';
import { DataSource, IsNull, Repository } from 'typeorm';

import { RefreshTokenEntity } from './entities/refresh-token.entity';
import {
  buildRefreshClaims,
  computeRefreshExpiry,
  isRefreshExpired,
  parseRefreshClaims,
  type RefreshClaims,
} from './refresh-token.utils';

/**
 * Symbol DI 토큰 — Redis client (BullMQ 와 별도 인스턴스, 동일 서버).
 * AuthModule 에서 useFactory(ConfigService) 로 IORedis 발급.
 */
export const REFRESH_REDIS = Symbol('REFRESH_REDIS');
export const REFRESH_TOKEN_CONFIG = Symbol('REFRESH_TOKEN_CONFIG');

export interface RefreshTokenServiceConfig {
  refreshSecret: string;
  refreshExpiresIn: string;
  /** 테스트 deterministic 용 — 미지정 시 `new Date()` */
  now?: () => Date;
}

export interface RotateResult {
  refreshToken: string;
  jti: string;
  userId: string;
  familyId: string;
  generation: number;
}

/**
 * PR-10a §4.2.1 부속서 A·B 절 — refresh rotation + reuse detection.
 *
 * 책임:
 *  1. login/register 시 신규 family 발급 (`issueInitial`)
 *  2. /api/auth/refresh 호출 시 회전 (`rotate`)
 *     - 만료 / 없는 jti / 이미 revoked / replacedBy 존재 → 401 + family revoke
 *     - 정상 시 트랜잭션 (기존 revoke + replacedBy 갱신 + 새 행 insert)
 *     - Redis SETNX mutex 5s grace (race / 빠른 더블탭 false positive 차단)
 *     - Redis 다운 시 fail-open (grace path)
 *  3. logout 시 모든 활성 family 일괄 revoke (`revokeAllForUser`)
 *
 * 본 service 는 access token 발급은 하지 않음 — AuthService 가 access 별도 sign.
 */
@Injectable()
export class RefreshTokenService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly repo: Repository<RefreshTokenEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
    @Inject(REFRESH_REDIS)
    private readonly redis: IORedis,
    @Inject(REFRESH_TOKEN_CONFIG)
    private readonly config: RefreshTokenServiceConfig,
  ) {}

  private nowDate(): Date {
    return this.config.now ? this.config.now() : new Date();
  }

  /** login/register 진입점. 신규 family + generation 0 + DB insert + JWT sign. */
  async issueInitial(userId: string): Promise<RotateResult> {
    const now = this.nowDate();
    const jti = randomUUID();
    const familyId = randomUUID();
    const expiresAt = computeRefreshExpiry(now, this.config.refreshExpiresIn);

    await this.repo.insert({
      jti,
      userId,
      familyId,
      generation: 0,
      expiresAt,
      revokedAt: null,
      replacedBy: null,
    });

    const refreshToken = await this.signRefresh({
      jti,
      userId,
      familyId,
      generation: 0,
      now,
    });
    return { refreshToken, jti, userId, familyId, generation: 0 };
  }

  /**
   * /api/auth/refresh 진입점.
   *
   * 1) JWT verify (만료/위조 차단) → claims
   * 2) DB lookup → null 이면 `refresh_not_found`
   * 3) reuse detection (revokedAt or replacedBy 존재) → family revoke + 401
   * 4) Redis SETNX 5s mutex
   *    - acquire 실패 (lock 점유) → grace path (rotation 없이 reissue)
   *    - redis 다운 → fail-open (grace path)
   * 5) 트랜잭션 (기존 revoke + replacedBy 갱신 + 새 행 insert)
   */
  async rotate(rawToken: string): Promise<RotateResult> {
    let claims: RefreshClaims;
    try {
      const verified = await this.jwt.verifyAsync(rawToken, {
        secret: this.config.refreshSecret,
      });
      claims = parseRefreshClaims(verified);
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        throw new UnauthorizedException('refresh_expired');
      }
      // zod parse 실패 또는 verify 위조 → invalid
      throw new UnauthorizedException('refresh_invalid');
    }

    const now = this.nowDate();
    if (isRefreshExpired(claims, now)) {
      throw new UnauthorizedException('refresh_expired');
    }

    const stored = await this.repo.findOne({ where: { jti: claims.jti } });
    if (!stored) {
      // 탈취 시나리오 — family 식별 불확실하므로 본 호출만 차단 (revoke 안 함)
      throw new UnauthorizedException('refresh_not_found');
    }

    if (stored.revokedAt !== null || stored.replacedBy !== null) {
      // family 전체 revoke (CRITICAL — chain 폐기)
      await this.repo.update(
        { userId: stored.userId, familyId: stored.familyId, revokedAt: IsNull() },
        { revokedAt: now },
      );
      throw new UnauthorizedException('refresh_reuse_detected');
    }

    // Redis SETNX mutex (fail-open)
    const lockKey = `refresh:lock:${stored.jti}`;
    let acquired: 'OK' | null = null;
    try {
      acquired = (await this.redis.set(lockKey, '1', 'EX', 5, 'NX')) as 'OK' | null;
    } catch {
      // redis 다운 — grace path 로 (rotation 없이 reissue) 진행
      acquired = null;
    }

    if (!acquired) {
      return this.reissueWithoutRotation(stored, now);
    }

    // rotation transaction
    const newJti = randomUUID();
    const newGeneration = stored.generation + 1;
    const newExpiresAt = computeRefreshExpiry(now, this.config.refreshExpiresIn);

    await this.dataSource.transaction(async (m) => {
      await m.update(
        RefreshTokenEntity,
        { jti: stored.jti },
        { revokedAt: now, replacedBy: newJti },
      );
      await m.insert(RefreshTokenEntity, {
        jti: newJti,
        userId: stored.userId,
        familyId: stored.familyId,
        generation: newGeneration,
        expiresAt: newExpiresAt,
        revokedAt: null,
        replacedBy: null,
      });
    });

    const refreshToken = await this.signRefresh({
      jti: newJti,
      userId: stored.userId,
      familyId: stored.familyId,
      generation: newGeneration,
      now,
    });
    return {
      refreshToken,
      jti: newJti,
      userId: stored.userId,
      familyId: stored.familyId,
      generation: newGeneration,
    };
  }

  /** logout 시 호출. 사용자의 모든 활성 refresh 일괄 revoke. */
  async revokeAllForUser(userId: string): Promise<void> {
    const now = this.nowDate();
    await this.repo.update({ userId, revokedAt: IsNull() }, { revokedAt: now });
  }

  /**
   * grace path — Redis lock 점유 시. DB 변경 없이 동일 jti 의 새 JWT 만 재발급.
   *
   * 정책 근거 (consensus-010 Reviewer 결정 #7):
   *  - 빠른 더블탭 / 네트워크 retry 의 false positive (= reuse 로 오인) 차단.
   *  - 5s TTL grace window 안에서만 동작 — 그 후 재호출 시 정상 rotation.
   */
  private async reissueWithoutRotation(
    stored: RefreshTokenEntity,
    now: Date,
  ): Promise<RotateResult> {
    const refreshToken = await this.signRefresh({
      jti: stored.jti,
      userId: stored.userId,
      familyId: stored.familyId,
      generation: stored.generation,
      now,
    });
    return {
      refreshToken,
      jti: stored.jti,
      userId: stored.userId,
      familyId: stored.familyId,
      generation: stored.generation,
    };
  }

  private async signRefresh(input: {
    jti: string;
    userId: string;
    familyId: string;
    generation: number;
    now: Date;
  }): Promise<string> {
    const claims = buildRefreshClaims({
      jti: input.jti,
      userId: input.userId,
      familyId: input.familyId,
      generation: input.generation,
      expiresIn: this.config.refreshExpiresIn,
      now: input.now,
    });
    // payload 에 iat/exp 가 명시되어 있으므로 expiresIn 옵션은 미지정 (충돌 방지).
    // PR-13 §5 hotfix #2 패턴 — NestJS JwtService 는 글로벌 signOptions.expiresIn 을
    // sign 시 자동 merge 하여 payload.exp 와 충돌. JwtService 우회하고 jsonwebtoken
    // 직접 호출. e2e 가 잡은 회귀.
    return jwt.sign(claims, this.config.refreshSecret);
  }
}

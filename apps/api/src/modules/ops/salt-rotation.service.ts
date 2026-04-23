import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';

import {
  OpsEventLogEntity,
  type SaltRotationPayload,
} from './entities/ops-event-log.entity';
import { UserTokenHashSaltEpochEntity } from './entities/user-token-hash-salt-epoch.entity';

/**
 * ADR-018 §3·§6·§11 — salt rotation 절차 서비스.
 *
 * 호출 경로: `scripts/rotate-salt.ts` CLI (본 커밋 4) 에서 호출. NestJS 부팅 후 CLI 모드.
 *
 * 절차:
 *  1. `ADMIN_ACK_SALT_ROTATION` 환경변수 검증 — `{prev_fp}:{new_fp}` 형식 (2-step 게이트).
 *     ADR-018 §11 step 3.
 *  2. 새 salt fingerprint 계산 (`sha256(newSalt).slice(0, 8)`). 평문 salt 는 로그/이벤트에 절대 기록 금지.
 *  3. 기존 active epoch 의 `deactivated_at` 을 현재 시각으로 UPDATE.
 *  4. `user_token_hash_salt_epochs` INSERT — 새 epoch row.
 *  5. `ops_event_log` `kind='salt_rotation'` INSERT. payload: fingerprint 쌍 + admin + reason.
 *  6. 단일 트랜잭션 보장.
 *
 * ADR-018 §7 부팅 검증 refinement (S5-C5) 와는 분리 — 본 서비스는 **rotation 발생 후 원장 기록**만.
 */

export interface RotateSaltInput {
  /** 새 salt 평문. 내부에서만 사용, 즉시 fingerprint 로 변환. */
  newSalt: string;
  /** 이전 salt 평문. 최초 rotation 시 `null`. */
  prevSalt?: string | null;
  adminId: string;
  reason: 'scheduled' | 'incident';
  note?: string | null;
  /** `ADMIN_ACK_SALT_ROTATION` 환경변수 값. `{prev_fp}:{new_fp}` 형식. */
  adminAck: string;
}

export interface RotateSaltResult {
  epochId: number;
  newFingerprint: string;
  prevFingerprint: string | null;
  activatedAt: Date;
}

@Injectable()
export class SaltRotationService {
  private readonly logger = new Logger(SaltRotationService.name);

  constructor(
    @InjectRepository(UserTokenHashSaltEpochEntity)
    private readonly epochs: Repository<UserTokenHashSaltEpochEntity>,
    @InjectRepository(OpsEventLogEntity)
    private readonly opsEvents: Repository<OpsEventLogEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async rotate(input: RotateSaltInput): Promise<RotateSaltResult> {
    this.validateInput(input);

    const newFingerprint = saltFingerprint(input.newSalt);
    const prevFingerprint = input.prevSalt ? saltFingerprint(input.prevSalt) : null;

    const expectedAck = `${prevFingerprint ?? 'none'}:${newFingerprint}`;
    if (input.adminAck !== expectedAck) {
      throw new Error(
        `ADMIN_ACK_SALT_ROTATION mismatch. expected='${expectedAck}' actual='${input.adminAck}' (ADR-018 §11 step 3)`,
      );
    }

    if (prevFingerprint && prevFingerprint === newFingerprint) {
      throw new Error(
        'prev salt and new salt fingerprints are identical — no-op rotation rejected (ADR-018 §7 refinement 2)',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const epochRepo = manager.getRepository(UserTokenHashSaltEpochEntity);
      const opsRepo = manager.getRepository(OpsEventLogEntity);
      const now = new Date();

      // 3. 기존 active epoch 비활성화 (있을 경우)
      const active = await epochRepo.findOne({ where: { deactivatedAt: IsNull() } });
      if (active) {
        active.deactivatedAt = now;
        await epochRepo.save(active);
        if (active.saltFingerprint !== (prevFingerprint ?? '')) {
          this.logger.warn(
            `active epoch fingerprint mismatch — expected='${prevFingerprint ?? 'none'}' db='${active.saltFingerprint}'`,
          );
        }
      } else if (prevFingerprint) {
        this.logger.warn(
          `no active epoch in DB but caller provided prev salt fp='${prevFingerprint}'`,
        );
      }

      // 4. 새 epoch INSERT
      const newEpoch = epochRepo.create({
        saltFingerprint: newFingerprint,
        activatedAt: now,
        deactivatedAt: null,
        adminId: input.adminId,
        reason: input.reason,
        note: input.note ?? null,
      });
      const savedEpoch = await epochRepo.save(newEpoch);

      // 5. ops_event_log 기록
      const payload: SaltRotationPayload = {
        prevFingerprint,
        newFingerprint,
        rotatedBy: input.adminId,
        reason: input.reason,
      };
      const event = opsRepo.create({
        kind: 'salt_rotation',
        userId: input.adminId,
        payload: payload as unknown as Record<string, unknown>,
      });
      await opsRepo.save(event);

      this.logger.log(
        `salt rotation complete: epoch=${savedEpoch.epochId} fp=${newFingerprint} reason=${input.reason}`,
      );

      return {
        epochId: savedEpoch.epochId,
        newFingerprint,
        prevFingerprint,
        activatedAt: now,
      };
    });
  }

  private validateInput(input: RotateSaltInput): void {
    if (!input.newSalt || input.newSalt.length < 16) {
      throw new Error('newSalt 은 최소 16자 이상 문자열이어야 합니다 (ADR-016 §7)');
    }
    if (input.prevSalt !== null && input.prevSalt !== undefined) {
      if (input.prevSalt.length < 16) {
        throw new Error('prevSalt 은 null 이거나 최소 16자 이상이어야 합니다');
      }
    }
    if (!input.adminId) {
      throw new Error('adminId 필수');
    }
    if (input.reason !== 'scheduled' && input.reason !== 'incident') {
      throw new Error(`invalid reason='${input.reason}' — 'scheduled' | 'incident' 만 허용`);
    }
  }
}

/** ADR-018 §5 + §8 금지 4 — salt 평문 저장 금지. sha256(salt).slice(0, 8). */
export function saltFingerprint(salt: string): string {
  return createHash('sha256').update(salt).digest('hex').slice(0, 8);
}

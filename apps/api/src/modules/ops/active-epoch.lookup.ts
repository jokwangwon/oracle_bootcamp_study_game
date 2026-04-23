import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { UserTokenHashSaltEpochEntity } from './entities/user-token-hash-salt-epoch.entity';

/**
 * consensus-007 S6-C1-6 + ADR-018 §5 — 활성 epoch 조회 헬퍼.
 *
 * Session 6 PR #2 에서 `answer_history.user_token_hash_epoch` 컬럼을 채우는
 * 경로에서 재사용. PR #1 에서는 helper + fail-closed 계약만 확정하고, race
 * 회귀 시나리오를 unit test 로 고정.
 *
 * Race 시나리오 (ADR-018 §5 설계):
 *  - `SaltRotationService.rotate()` 는 `dataSource.transaction` 단일 TX 내에서
 *    deactivate + insert 를 수행 → partial unique index 위반 불가 (active=1 불변).
 *  - reader(answer_history INSERT 경로) 는 rotation COMMIT 전에는 구 epoch,
 *    COMMIT 후에는 새 epoch 를 본다 (READ COMMITTED 기본 격리).
 *  - reader TX 스냅샷 안에서는 epoch 1건으로 고정되므로 해당 TX 내 hash 계산과
 *    저장되는 `user_token_hash_epoch` 는 정합.
 *
 * fail-closed: row 0 건 시 throw — NULL 저장 금지 (감사 체인 보장).
 *
 * 운영 매뉴얼:
 *  - 본 helper 를 사용하는 INSERT 경로는 `dataSource.transaction` 으로 감싸고
 *    `manager` 를 전달해야 한다. 미전달 시 TypeORM 기본 repo 사용 (non-TX).
 */
@Injectable()
export class ActiveEpochLookup {
  constructor(
    @InjectRepository(UserTokenHashSaltEpochEntity)
    private readonly defaultRepo: Repository<UserTokenHashSaltEpochEntity>,
  ) {}

  async getActiveEpochId(manager?: EntityManager): Promise<number> {
    const repo = manager
      ? manager.getRepository(UserTokenHashSaltEpochEntity)
      : this.defaultRepo;
    const active = await repo.findOne({
      where: { deactivatedAt: IsNull() },
      order: { activatedAt: 'DESC' },
    });
    if (!active) {
      throw new Error(
        'No active user_token_hash_salt_epoch row (ADR-018 §5 fail-closed). ' +
          'bootstrap seed migration (1714000004000) 미실행 또는 모든 epoch deactivated.',
      );
    }
    return active.epochId;
  }
}

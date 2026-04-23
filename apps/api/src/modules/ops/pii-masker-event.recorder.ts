import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  OpsEventLogEntity,
  type PiiMaskerTriggeredPayload,
} from './entities/ops-event-log.entity';

/**
 * ADR-016 §7 + consensus-007 S6-C1-4 — Langfuse masker metadata 화이트리스트
 * 위반 발생 시 `ops_event_log(kind='pii_masker_triggered')` INSERT.
 *
 * 호출 시점: `MaskingLangfuseCallbackHandler` 의 `guardMetadata()` 가 production
 * 모드에서 violation 발견 시 주입된 reporter 콜백을 호출한다. 본 서비스는 그
 * 콜백 entry point 역할이다.
 *
 * fail-safe: DB INSERT 실패는 throw 하지 않고 warn 로깅만 — Langfuse callback
 * 은 비동기 경로이며 DB 장애로 학생 채점 응답을 막으면 안 된다.
 *
 * **payload 에 값 저장 금지** — key 이름과 handler/runId 만. 값 자체는 이미
 * metadata 에서 drop 되어 Langfuse 로 나가지 않는다.
 */
@Injectable()
export class PiiMaskerEventRecorder {
  private readonly logger = new Logger(PiiMaskerEventRecorder.name);

  constructor(
    @InjectRepository(OpsEventLogEntity)
    private readonly repo: Repository<OpsEventLogEntity>,
  ) {}

  async record(violation: { key: string; handler: string; runId?: string }): Promise<void> {
    const payload: PiiMaskerTriggeredPayload = {
      violation: 'metadata_key',
      key: violation.key,
      handler: violation.handler,
      runId: violation.runId,
    };
    try {
      await this.repo.save(
        this.repo.create({
          kind: 'pii_masker_triggered',
          questionId: null,
          userId: null,
          payload: payload as unknown as Record<string, unknown>,
          resolvedAt: null,
        }),
      );
    } catch (err) {
      this.logger.warn(
        `pii_masker_triggered 이벤트 기록 실패 (fail-safe): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

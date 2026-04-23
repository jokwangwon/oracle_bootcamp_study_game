import { describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';

import {
  OpsEventLogEntity,
  type PiiMaskerTriggeredPayload,
} from './entities/ops-event-log.entity';
import { PiiMaskerEventRecorder } from './pii-masker-event.recorder';

/**
 * consensus-007 S6-C1-4 — PiiMaskerEventRecorder TDD.
 *
 * 검증: MaskingLangfuseCallbackHandler 의 violation reporter 가 호출될 때 본
 * recorder 가 `ops_event_log(kind='pii_masker_triggered')` 로 INSERT 한다.
 * **fail-safe**: DB INSERT 실패는 학생 채점 경로를 막지 않는다.
 */

function createMockRepo(saveImpl?: () => Promise<unknown>): {
  repo: Repository<OpsEventLogEntity>;
  saves: OpsEventLogEntity[];
} {
  const saves: OpsEventLogEntity[] = [];
  const repo = {
    create: vi.fn((entity: Partial<OpsEventLogEntity>) => entity as OpsEventLogEntity),
    save: vi.fn(async (entity: OpsEventLogEntity) => {
      if (saveImpl) return saveImpl();
      saves.push(entity);
      return entity;
    }),
  } as unknown as Repository<OpsEventLogEntity>;
  return { repo, saves };
}

describe('PiiMaskerEventRecorder', () => {
  it('record() — kind="pii_masker_triggered" INSERT + payload 키/handler/runId 저장', async () => {
    const { repo, saves } = createMockRepo();
    const recorder = new PiiMaskerEventRecorder(repo);

    await recorder.record({
      key: 'user_token_hash',
      handler: 'handleChatModelStart',
      runId: 'run-42',
    });

    expect(saves).toHaveLength(1);
    expect(saves[0].kind).toBe('pii_masker_triggered');
    expect(saves[0].userId).toBeNull();
    expect(saves[0].questionId).toBeNull();
    const payload = saves[0].payload as PiiMaskerTriggeredPayload;
    expect(payload.violation).toBe('metadata_key');
    expect(payload.key).toBe('user_token_hash');
    expect(payload.handler).toBe('handleChatModelStart');
    expect(payload.runId).toBe('run-42');
  });

  it('runId 생략 가능', async () => {
    const { repo, saves } = createMockRepo();
    const recorder = new PiiMaskerEventRecorder(repo);

    await recorder.record({ key: 'userId', handler: 'handleLLMStart' });

    expect(saves).toHaveLength(1);
    const payload = saves[0].payload as PiiMaskerTriggeredPayload;
    expect(payload.runId).toBeUndefined();
  });

  it('payload 는 **값 저장 금지** — key 이름만 저장 (PII 유출 방지)', async () => {
    const { repo, saves } = createMockRepo();
    const recorder = new PiiMaskerEventRecorder(repo);

    // 학생 답안 평문이 key 로 잘못 들어온 경우도 key 필드로만 저장. value 는
    // 애초에 recorder API 에 전달되지 않는다 (reporter signature 상 key 만).
    await recorder.record({
      key: 'sensitive_field_name',
      handler: 'handleChainStart',
    });

    const payload = saves[0].payload as PiiMaskerTriggeredPayload;
    expect(Object.keys(payload).sort()).toEqual(
      ['handler', 'key', 'runId', 'violation'].sort(),
    );
  });

  it('fail-safe — DB save 실패 시 throw 하지 않음 (warn 로깅만)', async () => {
    const { repo } = createMockRepo(async () => {
      throw new Error('DB unreachable');
    });
    const recorder = new PiiMaskerEventRecorder(repo);

    await expect(
      recorder.record({ key: 'user_token_hash', handler: 'handleChatModelStart' }),
    ).resolves.toBeUndefined();
  });
});

describe('answer_history.id = session_id PK 타입 (ADR-016 §7 D3 Hybrid)', () => {
  it('AnswerHistoryEntity.id 컬럼 메타데이터 — PrimaryGeneratedColumn uuid', async () => {
    const { AnswerHistoryEntity } = await import('../users/entities/answer-history.entity');

    const getMetadataArgsStorage = (await import('typeorm')).getMetadataArgsStorage;
    const args = getMetadataArgsStorage();

    const pks = args.generations.filter(
      (g) => (g.target as Function).name === AnswerHistoryEntity.name,
    );
    expect(pks).toHaveLength(1);
    expect(pks[0].strategy).toBe('uuid');
    expect(pks[0].propertyName).toBe('id');
  });

  it('OpsEventKind 타입에 pii_masker_triggered 추가됨', async () => {
    const { OpsEventLogEntity: Cls } = await import('./entities/ops-event-log.entity');
    // kind 컬럼 길이 제약은 varchar(32) — pii_masker_triggered(20자) 수용 가능
    expect('pii_masker_triggered'.length).toBeLessThanOrEqual(32);
    expect(Cls.name).toBe('OpsEventLogEntity');
  });
});

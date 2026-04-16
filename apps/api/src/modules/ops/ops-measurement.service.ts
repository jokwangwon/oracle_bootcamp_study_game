import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ScopeValidatorService } from '../content/services/scope-validator.service';
import { QuestionEntity } from '../content/entities/question.entity';
import {
  OpsQuestionMeasurementEntity,
  type Mt4FailureDetail,
} from './entities/ops-question-measurement.entity';
import {
  OpsEventLogEntity,
  type MeasurementFailPayload,
} from './entities/ops-event-log.entity';

export const MONITORING_WINDOW_SIZE = 100;

/**
 * 운영 초기 100건 모니터링 파이프라인의 inline 측정 서비스.
 *
 * SDD `operational-monitoring-design.md` §4.1 A 경로.
 * ADR-011 채택 조건 #3 — primary OSS 운영 개시 직후 MT3/MT4 재측정.
 *
 * 원칙:
 *  - 측정 실패가 상위 AI 문제 저장을 막지 않아야 한다.
 *  - 모든 실패 경로는 ops_event_log(measurement_fail)로 관측 가능해야 한다.
 */
@Injectable()
export class OpsMeasurementService {
  private readonly logger = new Logger(OpsMeasurementService.name);

  constructor(
    @InjectRepository(OpsQuestionMeasurementEntity)
    private readonly measureRepo: Repository<OpsQuestionMeasurementEntity>,
    @InjectRepository(OpsEventLogEntity)
    private readonly eventRepo: Repository<OpsEventLogEntity>,
    private readonly scopeValidator: ScopeValidatorService,
  ) {}

  async measureSync(
    question: QuestionEntity,
    latencyMs: number,
    modelDigest: string,
  ): Promise<void> {
    let mt3Pass = false;
    let mt3OutOfScope: string[] = [];
    try {
      const texts = collectScopeTargets(question);
      const outOfScopeSet = new Set<string>();
      for (const text of texts) {
        const v = await this.scopeValidator.validateText(text, question.week, question.topic);
        for (const token of v.outOfScope) outOfScopeSet.add(token);
      }
      mt3OutOfScope = [...outOfScopeSet];
      mt3Pass = mt3OutOfScope.length === 0;
    } catch (err) {
      await this.logMeasurementFail(question.id, err, 'mt3');
      return;
    }

    let mt4Pass: boolean | null = null;
    let mt4Failures: Mt4FailureDetail | null = null;
    if (question.gameMode === 'blank-typing') {
      const result = evaluateBlankConsistency(question);
      mt4Pass = result.pass;
      mt4Failures = result.pass ? null : result.failure;
    }

    let windowIndex: number | null = null;
    try {
      const measured = await this.measureRepo.count();
      windowIndex = measured < MONITORING_WINDOW_SIZE ? measured + 1 : null;
    } catch (err) {
      await this.logMeasurementFail(question.id, err, 'other');
      return;
    }

    try {
      await this.measureRepo.save({
        questionId: question.id,
        mt3Pass,
        mt3OutOfScope,
        mt4Pass,
        mt4Failures,
        latencyMs,
        modelDigest,
        windowIndex,
      } as OpsQuestionMeasurementEntity);
    } catch (err) {
      await this.logMeasurementFail(question.id, err, 'other');
    }
  }

  private async logMeasurementFail(
    questionId: string,
    err: unknown,
    stage: MeasurementFailPayload['stage'],
  ): Promise<void> {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`measurement_fail question=${questionId} stage=${stage}: ${msg}`);
    try {
      const payload: MeasurementFailPayload = { error: msg, stage };
      await this.eventRepo.save({
        kind: 'measurement_fail',
        questionId,
        userId: null,
        payload: payload as unknown as Record<string, unknown>,
        resolvedAt: null,
      } as OpsEventLogEntity);
    } catch (inner) {
      this.logger.error(`ops_event_log save failed: ${inner instanceof Error ? inner.message : inner}`);
    }
  }
}

/**
 * MT3 검증 대상 텍스트 — ScopeValidatorService에 넘기기 위한 모음.
 * AiQuestionGenerator의 동일 로직과 정렬.
 */
function collectScopeTargets(q: QuestionEntity): string[] {
  const out: string[] = [];
  const c = q.content as { sql?: string; description?: string };
  if (typeof c.sql === 'string') out.push(c.sql);
  if (typeof c.description === 'string') out.push(c.description);
  out.push(q.answer.join(' '));
  return out;
}

interface BlankEval {
  pass: boolean;
  failure: Mt4FailureDetail;
}

/**
 * MT4 — 빈칸-정답 일관성. 평가 하네스의 blank-consistency assertion과 동일 정책:
 *  - sql의 `___` 개수 == blanks.length
 *  - blanks[i].answer가 문자열
 *  - top-level answer 길이 == blanks.length
 */
function evaluateBlankConsistency(q: QuestionEntity): BlankEval {
  const content = q.content as {
    type?: string;
    sql?: unknown;
    blanks?: Array<{ answer?: unknown }>;
  };
  const sql = typeof content.sql === 'string' ? content.sql : '';
  const blanks = Array.isArray(content.blanks) ? content.blanks : [];
  const underscoreCount = (sql.match(/___/g) ?? []).length;

  if (blanks.length === 0 || underscoreCount !== blanks.length) {
    return {
      pass: false,
      failure: {
        expectedBlankCount: blanks.length,
        actualBlankCount: underscoreCount,
        missingAnswers: [],
      },
    };
  }

  const missingAnswers = blanks
    .map((b, i) => (typeof b.answer !== 'string' ? `blanks[${i}].answer` : null))
    .filter((x): x is string => x !== null);
  if (missingAnswers.length > 0) {
    return {
      pass: false,
      failure: { expectedBlankCount: blanks.length, actualBlankCount: underscoreCount, missingAnswers },
    };
  }

  if (!Array.isArray(q.answer) || q.answer.length !== blanks.length) {
    return {
      pass: false,
      failure: {
        expectedBlankCount: blanks.length,
        actualBlankCount: q.answer?.length ?? 0,
        missingAnswers: ['top-level-answer-length-mismatch'],
      },
    };
  }

  return {
    pass: true,
    failure: { expectedBlankCount: blanks.length, actualBlankCount: underscoreCount, missingAnswers: [] },
  };
}

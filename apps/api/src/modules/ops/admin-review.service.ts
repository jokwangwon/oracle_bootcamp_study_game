import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { QuestionEntity } from '../content/entities/question.entity';
import { OpsEventLogEntity } from './entities/ops-event-log.entity';

export interface ReviewInput {
  questionId: string;
  adminUserId: string;
  action: 'approve' | 'reject';
  reason?: string;
}

/**
 * 관리자 리뷰 서비스 (PATCH /api/questions/:id/review).
 *
 * 정책:
 *  - status가 'pending_review'인 문제만 review 대상.
 *  - approve → status='active' (수강생에게 노출 시작)
 *  - reject → status='rejected' + ops_event_log(admin_reject)
 *
 * 책임이 OpsModule에 있는 이유: reject 결과가 ops 이벤트 로그와 같은 도메인에서
 * 추적되어야 하며 (Phase B 신고율 집계와 함께), OpsModule이 이미 QuestionEntity
 * + OpsEventLogEntity Repository를 모두 보유하기 때문이다.
 */
@Injectable()
export class AdminReviewService {
  constructor(
    @InjectRepository(QuestionEntity)
    private readonly qRepo: Repository<QuestionEntity>,
    @InjectRepository(OpsEventLogEntity)
    private readonly eventRepo: Repository<OpsEventLogEntity>,
  ) {}

  async review(input: ReviewInput): Promise<QuestionEntity> {
    const q = await this.qRepo.findOne({ where: { id: input.questionId } });
    if (!q) throw new NotFoundException(`Question ${input.questionId} not found`);
    if (q.status !== 'pending_review') {
      throw new BadRequestException(
        `Question status is '${q.status}', only 'pending_review' can be reviewed`,
      );
    }

    if (input.action === 'approve') {
      q.status = 'active';
    } else {
      q.status = 'rejected';
      await this.eventRepo.save({
        kind: 'admin_reject',
        questionId: q.id,
        userId: input.adminUserId,
        payload: { reason: input.reason ?? null } as unknown as Record<string, unknown>,
        resolvedAt: null,
      } as OpsEventLogEntity);
    }
    return this.qRepo.save(q);
  }
}

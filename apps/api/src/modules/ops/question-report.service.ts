import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { QuestionEntity } from '../content/entities/question.entity';
import {
  OpsEventLogEntity,
  type StudentReportPayload,
  type StudentReportReason,
} from './entities/ops-event-log.entity';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class QuestionReportService {
  constructor(
    @InjectRepository(OpsEventLogEntity)
    private readonly eventRepo: Repository<OpsEventLogEntity>,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
  ) {}

  async report(
    questionId: string,
    userId: string,
    reason: StudentReportReason,
  ): Promise<{ eventId: string }> {
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    const duplicate = await this.eventRepo.findOne({
      where: { userId, questionId, kind: 'student_report_incorrect' },
    });
    if (duplicate) {
      throw new ConflictException('You have already reported this question');
    }

    const payload: StudentReportPayload = { reason };
    try {
      const saved = await this.eventRepo.save({
        kind: 'student_report_incorrect',
        questionId,
        userId,
        payload: payload as unknown as Record<string, unknown>,
        resolvedAt: null,
      } as OpsEventLogEntity);
      return { eventId: saved.id };
    } catch (err) {
      if (err instanceof Error && (err as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        throw new ConflictException('You have already reported this question');
      }
      throw err;
    }
  }
}

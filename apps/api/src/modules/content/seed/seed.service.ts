import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AstCanonicalGrader } from '../../grading/graders/ast-canonical.grader';
import {
  formatReport,
  validateFreeFormSeeds,
  type FreeFormSeedCandidate,
} from '../../grading/validate-free-form-seeds';
import { QuestionEntity } from '../entities/question.entity';
import { WeeklyScopeEntity } from '../entities/weekly-scope.entity';
import { ScopeValidatorService } from '../services/scope-validator.service';
import {
  WEEK1_SQL_BASICS_QUESTIONS,
  type QuestionSeed,
} from './data/week1-sql-basics.questions';
import {
  WEEK1_SQL_BASICS_SCOPE,
  type WeeklyScopeSeed,
} from './data/week1-sql-basics.scope';
import { WEEK2_TRANSACTIONS_QUESTIONS } from './data/week2-transactions.questions';
import { WEEK2_TRANSACTIONS_SCOPE } from './data/week2-transactions.scope';

/**
 * 사전 생성 문제 풀 시드 서비스
 *
 * SDD §4.5: AI API 장애 시에도 게임이 가능하도록 각 주차별 최소 50문제를
 * 사전 생성하여 캐싱한다. (1주차 빈칸 15 + 용어 15 = 30문제로 시작)
 *
 * 동작:
 *  - SEED_ON_BOOT=true 일 때만 부트 시 INSERT
 *  - 멱등: questions.count() > 0 이면 skip
 *  - 시드 전 ScopeValidator로 모든 문제의 화이트리스트 적합성 검증
 *
 * 운영 정책:
 *  - 개발/CI: SEED_ON_BOOT=true (기본 데이터 자동 주입)
 *  - 프로덕션: SEED_ON_BOOT=false (마이그레이션으로 별도 관리)
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly scopeValidator: ScopeValidatorService,
    @InjectRepository(QuestionEntity)
    private readonly questionRepo: Repository<QuestionEntity>,
    @InjectRepository(WeeklyScopeEntity)
    private readonly scopeRepo: Repository<WeeklyScopeEntity>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const enabled = this.configService.get<boolean>('SEED_ON_BOOT');
    if (!enabled) {
      this.logger.log('SEED_ON_BOOT=false, 시드 건너뜀');
      return;
    }

    await this.seed();
  }

  /**
   * 멱등 시드 실행. 외부에서 호출 가능 (테스트/관리자 트리거).
   */
  async seed(): Promise<{ inserted: { questions: number; scopes: number } }> {
    const existingQuestions = await this.questionRepo.count();
    const existingScopes = await this.scopeRepo.count();

    if (existingQuestions > 0 || existingScopes > 0) {
      this.logger.log(
        `기존 데이터 발견 (questions=${existingQuestions}, scopes=${existingScopes}), 시드 건너뜀`,
      );
      return { inserted: { questions: 0, scopes: 0 } };
    }

    // 0.5. free-form 정답 템플릿 Layer 1 파싱 사전검증 (ADR-013, 3+1 합의 MVP-B Session 3).
    //      현재 시드는 free-form 없음 → no-op. 추후 추가 시 자동 게이트화.
    this.validateFreeFormSeedsOrThrow();

    // 1. weekly_scope 먼저 INSERT (검증 기준이 되므로)
    //    week1 sql-basics + week2 transactions를 모두 등록
    await this.insertScope(WEEK1_SQL_BASICS_SCOPE);
    await this.insertScope(WEEK2_TRANSACTIONS_SCOPE);

    // 2. questions INSERT — 각 문제마다 ScopeValidator 통과 검증
    let inserted = 0;
    for (const seed of WEEK1_SQL_BASICS_QUESTIONS) {
      await this.insertQuestion(seed);
      inserted += 1;
    }
    for (const seed of WEEK2_TRANSACTIONS_QUESTIONS) {
      await this.insertQuestion(seed);
      inserted += 1;
    }

    this.logger.log(
      `시드 완료: questions=${inserted}, scopes=2 (week1 sql-basics + week2 transactions)`,
    );
    return { inserted: { questions: inserted, scopes: 2 } };
  }

  private validateFreeFormSeedsOrThrow(): void {
    const candidates: FreeFormSeedCandidate[] = [
      ...WEEK1_SQL_BASICS_QUESTIONS,
      ...WEEK2_TRANSACTIONS_QUESTIONS,
    ].map((q, i) => ({
      id: `week${q.week}-${q.gameMode}-${i}`,
      answerFormat: q.answerFormat,
      answer: q.answer,
    }));

    const report = validateFreeFormSeeds(new AstCanonicalGrader(), candidates);
    if (report.failed.length > 0) {
      throw new Error(
        `free-form seed Layer 1 파싱 사전검증 실패:\n${formatReport(report)}`,
      );
    }
    if (report.checked > 0) {
      this.logger.log(
        `free-form seed 사전검증 통과: ${report.passed}/${report.checked}`,
      );
    }
  }

  private async insertScope(seed: WeeklyScopeSeed): Promise<void> {
    const entity = this.scopeRepo.create({
      week: seed.week,
      topic: seed.topic,
      keywords: seed.keywords,
      sourceUrl: seed.sourceUrl,
    });
    await this.scopeRepo.save(entity);
  }

  /**
   * 모든 주차의 weekly_scope.keywords를 seed `*.scope.ts` 기준으로 동기화한다.
   *
   * ADR-010: seed 파일이 평가/운영의 단일 source of truth. scope.ts 수정 후
   * 기존 DB row의 keywords가 구(舊) 목록으로 남으면 평가↔운영 divergence 발생.
   * 멱등 — 이미 일치하면 UPDATE 건너뛴다.
   *
   * @returns 주차별 변경 여부
   */
  async syncScopes(): Promise<Array<{ week: number; topic: string; changed: boolean }>> {
    const seeds: WeeklyScopeSeed[] = [WEEK1_SQL_BASICS_SCOPE, WEEK2_TRANSACTIONS_SCOPE];
    const report: Array<{ week: number; topic: string; changed: boolean }> = [];
    for (const seed of seeds) {
      const existing = await this.scopeRepo.findOne({
        where: { week: seed.week, topic: seed.topic },
      });
      if (!existing) {
        await this.insertScope(seed);
        report.push({ week: seed.week, topic: seed.topic, changed: true });
        this.logger.log(`scope 신규 insert: week=${seed.week} topic=${seed.topic}`);
        continue;
      }
      const same =
        existing.keywords.length === seed.keywords.length &&
        existing.keywords.every((k, i) => k === seed.keywords[i]);
      if (same) {
        report.push({ week: seed.week, topic: seed.topic, changed: false });
        continue;
      }
      existing.keywords = [...seed.keywords];
      existing.sourceUrl = seed.sourceUrl;
      await this.scopeRepo.save(existing);
      report.push({ week: seed.week, topic: seed.topic, changed: true });
      this.logger.log(
        `scope 동기화: week=${seed.week} topic=${seed.topic} keywords=${seed.keywords.length}`,
      );
    }
    return report;
  }

  private async insertQuestion(seed: QuestionSeed): Promise<void> {
    const textsToValidate = this.collectTextsForValidation(seed);
    for (const text of textsToValidate) {
      const result = await this.scopeValidator.validateText(
        text,
        seed.week,
        seed.topic,
      );
      if (!result.valid) {
        throw new Error(
          `시드 문제가 화이트리스트를 위반합니다: out-of-scope=${result.outOfScope.join(', ')} | text=${text}`,
        );
      }
    }

    const entity = this.questionRepo.create({
      topic: seed.topic,
      week: seed.week,
      gameMode: seed.gameMode,
      difficulty: seed.difficulty,
      content: seed.content,
      answer: seed.answer,
      explanation: seed.explanation ?? null,
      status: seed.status,
      source: seed.source,
    });
    await this.questionRepo.save(entity);
  }

  /**
   * 문제 타입별로 화이트리스트 검증 대상 텍스트를 모은다.
   * - 빈칸 타이핑: SQL 본문 + 정답들
   * - 용어 맞추기: description + 정답들
   */
  private collectTextsForValidation(seed: QuestionSeed): string[] {
    const texts: string[] = [];
    if (seed.content.type === 'blank-typing') {
      texts.push(seed.content.sql);
    } else if (seed.content.type === 'term-match') {
      texts.push(seed.content.description);
    }
    texts.push(seed.answer.join(' '));
    return texts;
  }
}

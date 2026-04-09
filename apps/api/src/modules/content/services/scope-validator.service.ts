import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { extractOracleTokens } from '@oracle-game/shared';
import { LessThanOrEqual, Repository } from 'typeorm';

import { WeeklyScopeEntity } from '../entities/weekly-scope.entity';

/**
 * 학습 범위 검증
 *
 * 헌법 제3조 + SDD 4.4: AI가 생성한 문제가 사용자의 학습 범위
 * (= 누적 주차 화이트리스트)를 벗어나는 키워드를 사용하면 폐기한다.
 *
 * 이는 추론적(LLM judge)이 아닌 계산적(키워드 매칭) 검증이며,
 * 항상 우선 적용되어야 한다.
 */
@Injectable()
export class ScopeValidatorService {
  constructor(
    @InjectRepository(WeeklyScopeEntity)
    private readonly scopeRepo: Repository<WeeklyScopeEntity>,
  ) {}

  /**
   * 주어진 텍스트가 (week, topic) 화이트리스트에 포함된 키워드만 사용하는지 검증.
   *
   * 정책:
   *  - 누적 검증: 1~week 범위의 모든 키워드를 합집합으로 사용
   *  - 일반 영단어/숫자/구두점은 무시
   *  - Oracle 키워드(대문자 식별자, 함수명)만 화이트리스트와 대조
   */
  async validateText(text: string, week: number, topic: string): Promise<{
    valid: boolean;
    outOfScope: string[];
  }> {
    const scopes = await this.scopeRepo.find({
      where: {
        week: LessThanOrEqual(week),
        topic,
      },
    });

    const allowed = new Set<string>();
    for (const scope of scopes) {
      for (const kw of scope.keywords) {
        allowed.add(kw.toUpperCase());
      }
    }

    if (allowed.size === 0) {
      // 화이트리스트가 비어 있으면 검증 보류 (관리자 승인 단계로 위임)
      return { valid: true, outOfScope: [] };
    }

    const candidates = extractOracleTokens(text);
    const outOfScope = candidates.filter((token) => !allowed.has(token));

    return {
      valid: outOfScope.length === 0,
      outOfScope: [...new Set(outOfScope)],
    };
  }
}

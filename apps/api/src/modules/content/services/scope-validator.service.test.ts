import { describe, expect, it, beforeEach } from 'vitest';
import { LessThanOrEqual } from 'typeorm';

import { ScopeValidatorService } from './scope-validator.service';
import { WeeklyScopeEntity } from '../entities/weekly-scope.entity';

/**
 * 학습 범위 검증 단위 테스트
 *
 * Repository를 in-memory fake로 대체하여, 실제 DB 없이도
 * 화이트리스트 매칭 로직을 검증한다 (계산적 검증).
 */
class FakeScopeRepo {
  scopes: WeeklyScopeEntity[] = [];

  async find({ where }: { where: { week: ReturnType<typeof LessThanOrEqual<number>>; topic: string } }) {
    // LessThanOrEqual의 _value를 추출
    const maxWeek = (where.week as unknown as { _value: number })._value;
    return this.scopes.filter((s) => s.week <= maxWeek && s.topic === where.topic);
  }
}

function makeValidator() {
  const repo = new FakeScopeRepo();
  // 1주차: SQL 기초
  repo.scopes.push({
    id: '1',
    week: 1,
    topic: 'sql-basics',
    keywords: ['SELECT', 'FROM', 'WHERE', 'ORDER', 'BY'],
    sourceUrl: null,
    createdAt: new Date(),
  });
  // 2주차: SQL 함수 (1주차 키워드 + NVL, COALESCE)
  repo.scopes.push({
    id: '2',
    week: 2,
    topic: 'sql-basics',
    keywords: ['NVL', 'COALESCE', 'TO_CHAR'],
    sourceUrl: null,
    createdAt: new Date(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new ScopeValidatorService(repo as any);
  return service;
}

describe('ScopeValidatorService', () => {
  let service: ScopeValidatorService;

  beforeEach(() => {
    service = makeValidator();
  });

  it('1주차 화이트리스트 내 키워드만 사용하면 통과한다', async () => {
    const result = await service.validateText(
      'SELECT * FROM employees WHERE salary > 3000',
      1,
      'sql-basics',
    );
    expect(result.valid).toBe(true);
    expect(result.outOfScope).toEqual([]);
  });

  it('1주차에 NVL을 사용하면 범위 이탈로 차단된다', async () => {
    const result = await service.validateText(
      'SELECT NVL(name, "없음") FROM employees',
      1,
      'sql-basics',
    );
    expect(result.valid).toBe(false);
    expect(result.outOfScope).toContain('NVL');
  });

  it('2주차에 NVL을 사용하면 통과한다 (누적 화이트리스트)', async () => {
    const result = await service.validateText(
      'SELECT NVL(name, "없음") FROM employees',
      2,
      'sql-basics',
    );
    expect(result.valid).toBe(true);
  });

  it('화이트리스트가 비어 있으면 통과시킨다 (관리자 승인 단계로 위임)', async () => {
    const repo = new FakeScopeRepo();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const empty = new ScopeValidatorService(repo as any);
    const result = await empty.validateText('SELECT * FROM x', 1, 'sql-basics');
    expect(result.valid).toBe(true);
  });

  it('소문자 키워드는 검증 대상이 아니다 (Oracle 식별자만 매칭)', async () => {
    const result = await service.validateText(
      'select * from employees',
      1,
      'sql-basics',
    );
    expect(result.valid).toBe(true);
  });
});

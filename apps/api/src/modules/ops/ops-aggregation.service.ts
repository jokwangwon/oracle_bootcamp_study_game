import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Repository } from 'typeorm';

import {
  OpsEventLogEntity,
  type GateBreachPayload,
} from './entities/ops-event-log.entity';
import { OpsQuestionMeasurementEntity } from './entities/ops-question-measurement.entity';
import { MONITORING_WINDOW_SIZE } from './ops-measurement.service';

export interface GateThresholds {
  mt3MinRate: number;
  mt4MinRate: number;
  p95MaxMs: number;
  studentReportMaxRate: number;
}

export const DEFAULT_GATE_THRESHOLDS: GateThresholds = {
  mt3MinRate: 0.95,
  mt4MinRate: 0.93,
  p95MaxMs: 60_000,
  studentReportMaxRate: 0.05,
};

export interface AggregateInput {
  mt3Rate: number;
  mt4Rate: number | null;
  p95LatencyMs: number;
  studentReportRate: number;
  windowSize: number;
}

export function evaluateGates(input: AggregateInput, t: GateThresholds): GateBreachPayload[] {
  if (input.windowSize === 0) return [];
  const breaches: GateBreachPayload[] = [];
  if (input.mt3Rate < t.mt3MinRate) {
    breaches.push({
      metric: 'mt3_rate',
      observed: input.mt3Rate,
      threshold: t.mt3MinRate,
      windowSize: input.windowSize,
    });
  }
  if (input.mt4Rate !== null && input.mt4Rate < t.mt4MinRate) {
    breaches.push({
      metric: 'mt4_rate',
      observed: input.mt4Rate,
      threshold: t.mt4MinRate,
      windowSize: input.windowSize,
    });
  }
  if (input.p95LatencyMs > t.p95MaxMs) {
    breaches.push({
      metric: 'p95_latency',
      observed: input.p95LatencyMs,
      threshold: t.p95MaxMs,
      windowSize: input.windowSize,
    });
  }
  if (input.studentReportRate > t.studentReportMaxRate) {
    breaches.push({
      metric: 'student_report_rate',
      observed: input.studentReportRate,
      threshold: t.studentReportMaxRate,
      windowSize: input.windowSize,
    });
  }
  return breaches;
}

export interface ReportWriter {
  write(filePath: string, content: string): Promise<void>;
  exists(filePath: string): boolean;
}

export const REPORT_WRITER = Symbol('ReportWriter');

const DEFAULT_WINDOW_REPORT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'docs',
  'operations',
  'monitoring-window-1.md',
);

export const defaultReportWriter: ReportWriter = {
  exists: (p) => fs.existsSync(p),
  write: async (p, c) => {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, c, 'utf-8');
  },
};

interface RawAggregate {
  window_size: number;
  mt3_pass_count: number;
  mt4_eligible_count: number;
  mt4_pass_count: number;
  p95_ms: number;
}

@Injectable()
export class OpsAggregationService {
  private readonly logger = new Logger(OpsAggregationService.name);
  private readonly thresholds: GateThresholds = DEFAULT_GATE_THRESHOLDS;
  private readonly reportPath: string = DEFAULT_WINDOW_REPORT_PATH;

  constructor(
    @InjectRepository(OpsQuestionMeasurementEntity)
    private readonly measureRepo: Repository<OpsQuestionMeasurementEntity>,
    @InjectRepository(OpsEventLogEntity)
    private readonly eventRepo: Repository<OpsEventLogEntity>,
    @Optional() @Inject(REPORT_WRITER) private readonly writer: ReportWriter = defaultReportWriter,
  ) {}

  /**
   * SDD §4.3 — 1시간 cron. 운영 개시 후 100건 window 내내 동작하며,
   * window 종료(window_index=100) 시점 직후 리포트 1회 생성.
   * window 외 측정에도 cron은 계속 돌며 rolling 검증을 한다.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'ops-aggregation' })
  async runAggregation(): Promise<void> {
    const raw = await this.fetchAggregate();
    if (raw.window_size === 0) {
      return;
    }

    const studentReports = await this.eventRepo.count({
      where: { kind: 'student_report_incorrect' },
    });
    const studentReportRate = studentReports / raw.window_size;

    const mt3Rate = raw.mt3_pass_count / raw.window_size;
    const mt4Rate = raw.mt4_eligible_count > 0 ? raw.mt4_pass_count / raw.mt4_eligible_count : null;

    const breaches = evaluateGates(
      {
        mt3Rate,
        mt4Rate,
        p95LatencyMs: raw.p95_ms,
        studentReportRate,
        windowSize: raw.window_size,
      },
      this.thresholds,
    );

    for (const breach of breaches) {
      await this.eventRepo.save({
        kind: 'gate_breach',
        questionId: null,
        userId: null,
        payload: breach as unknown as Record<string, unknown>,
        resolvedAt: null,
      } as OpsEventLogEntity);
      this.logger.warn(
        `gate_breach ${breach.metric}: observed=${breach.observed} threshold=${breach.threshold} window=${breach.windowSize}`,
      );
    }

    if (raw.window_size >= MONITORING_WINDOW_SIZE) {
      await this.writeWindowOneReport(raw, mt3Rate, mt4Rate, studentReportRate, breaches);
    }
  }

  private async fetchAggregate(): Promise<RawAggregate> {
    const qb = this.measureRepo
      .createQueryBuilder('m')
      .select('COUNT(*)', 'window_size')
      .addSelect('COUNT(*) FILTER (WHERE m.mt3_pass)', 'mt3_pass_count')
      .addSelect('COUNT(*) FILTER (WHERE m.mt4_pass IS NOT NULL)', 'mt4_eligible_count')
      .addSelect('COUNT(*) FILTER (WHERE m.mt4_pass)', 'mt4_pass_count')
      .addSelect(
        'COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY m.latency_ms), 0)',
        'p95_ms',
      )
      .where('m.window_index BETWEEN 1 AND :max', { max: MONITORING_WINDOW_SIZE });

    const raw = (await qb.getRawOne()) as
      | { [k: string]: string | number | null }
      | undefined;
    return {
      window_size: Number(raw?.window_size ?? 0),
      mt3_pass_count: Number(raw?.mt3_pass_count ?? 0),
      mt4_eligible_count: Number(raw?.mt4_eligible_count ?? 0),
      mt4_pass_count: Number(raw?.mt4_pass_count ?? 0),
      p95_ms: Number(raw?.p95_ms ?? 0),
    };
  }

  private async writeWindowOneReport(
    raw: RawAggregate,
    mt3Rate: number,
    mt4Rate: number | null,
    studentReportRate: number,
    breaches: GateBreachPayload[],
  ): Promise<void> {
    if (this.writer.exists(this.reportPath)) {
      this.logger.log(`window-1 리포트 이미 존재 — skip: ${this.reportPath}`);
      return;
    }
    const content = renderWindowOneReport({
      raw,
      mt3Rate,
      mt4Rate,
      studentReportRate,
      breaches,
      thresholds: this.thresholds,
      generatedAt: new Date().toISOString(),
    });
    await this.writer.write(this.reportPath, content);
    this.logger.log(`window-1 리포트 작성: ${this.reportPath}`);
  }
}

interface RenderInput {
  raw: RawAggregate;
  mt3Rate: number;
  mt4Rate: number | null;
  studentReportRate: number;
  breaches: GateBreachPayload[];
  thresholds: GateThresholds;
  generatedAt: string;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function renderWindowOneReport(input: RenderInput): string {
  const { raw, mt3Rate, mt4Rate, studentReportRate, breaches, thresholds, generatedAt } = input;
  const lines = [
    '# 운영 모니터링 — window-1 (초기 100건) 리포트',
    '',
    `**생성 시각**: ${generatedAt}`,
    `**근거 SDD**: \`docs/architecture/operational-monitoring-design.md\` §4.4`,
    `**근거 ADR**: ADR-011 채택 조건 #3`,
    '',
    '## 측정 결과',
    '',
    '| 지표 | 측정값 | 기준 | 합격 |',
    '|---|---|---|---|',
    `| MT3 (화이트리스트) | ${raw.mt3_pass_count}/${raw.window_size} = ${pct(mt3Rate)} | ≥ ${pct(thresholds.mt3MinRate)} | ${mt3Rate >= thresholds.mt3MinRate ? '✅' : '❌'} |`,
    `| MT4 (빈칸 일관성) | ${mt4Rate === null ? 'N/A' : `${raw.mt4_pass_count}/${raw.mt4_eligible_count} = ${pct(mt4Rate)}`} | ≥ ${pct(thresholds.mt4MinRate)} | ${mt4Rate === null || mt4Rate >= thresholds.mt4MinRate ? '✅' : '❌'} |`,
    `| p95 지연 | ${(raw.p95_ms / 1000).toFixed(1)}s | ≤ ${(thresholds.p95MaxMs / 1000).toFixed(0)}s | ${raw.p95_ms <= thresholds.p95MaxMs ? '✅' : '❌'} |`,
    `| 수강생 신고율 | ${pct(studentReportRate)} | ≤ ${pct(thresholds.studentReportMaxRate)} | ${studentReportRate <= thresholds.studentReportMaxRate ? '✅' : '❌'} |`,
    '',
    '## 게이트 위반 요약',
    '',
  ];
  if (breaches.length === 0) {
    lines.push('전 게이트 통과. ADR-011 P1 운영 개시 안정성 확인.');
  } else {
    lines.push('| 메트릭 | 측정값 | 기준 |');
    lines.push('|---|---|---|');
    for (const b of breaches) {
      lines.push(`| ${b.metric} | ${b.observed} | ${b.threshold} |`);
    }
    lines.push('');
    lines.push('→ Phase 3 (Gold Set 200문제 확대 + 강사 peer review) 트리거 검토 필요.');
  }
  lines.push('', '## 다음 단계', '', '- rolling metric 단계로 전환 (window_index NULL 영역)');
  lines.push('- Phase C 알림 채널 결정 (Slack / email)');
  lines.push('- ADR-011 로드맵 P2(3개월 후 M4 이중 라우팅 재검토) 트리거 카운터 시작');
  lines.push('');
  return lines.join('\n');
}

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Repository } from 'typeorm';

import {
  OpsEventLogEntity,
  type GateBreachPayload,
  type OpsEventKind,
} from './entities/ops-event-log.entity';
import { OpsQuestionMeasurementEntity } from './entities/ops-question-measurement.entity';
import { MONITORING_WINDOW_SIZE } from './ops-measurement.service';

export interface GateThresholds {
  mt3MinRate: number;
  mt4MinRate: number;
  p95MaxMs: number;
  studentReportMaxRate: number;
  /** ADR-017 MT6 — free-form Layer 1 canonical match 비율 breach 기준 */
  mt6BreachBelow: number;
  /** ADR-017 MT7 — 캡스톤 step DAG 위반 건수 허용치 (MVP-C 이후 활성) */
  mt7MaxViolations: number;
  /** ADR-017 MT8 — LLM-judge 호출률 breach 기준 */
  mt8BreachAbove: number;
}

export const DEFAULT_GATE_THRESHOLDS: GateThresholds = {
  mt3MinRate: 0.95,
  mt4MinRate: 0.93,
  p95MaxMs: 60_000,
  studentReportMaxRate: 0.05,
  mt6BreachBelow: 0.6,
  mt7MaxViolations: 0,
  mt8BreachAbove: 0.15,
};

export interface AggregateInput {
  mt3Rate: number;
  mt4Rate: number | null;
  p95LatencyMs: number;
  studentReportRate: number;
  windowSize: number;
  /** ADR-017 MT6 — free-form 중 Layer 1에서 해소된 비율. free-form 샘플 0이면 null */
  mt6Rate: number | null;
  /** ADR-017 MT7 — 캡스톤 DAG 위반 누적 건수. MVP-C 미도입이면 0 고정 */
  mt7Violations: number;
  /** ADR-017 MT8 — 전체 채점 중 Layer 3(LLM) 호출 비율. 채점 샘플 0이면 null */
  mt8Rate: number | null;
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
  if (input.mt6Rate !== null && input.mt6Rate < t.mt6BreachBelow) {
    breaches.push({
      metric: 'mt6_canonical_match_rate',
      observed: input.mt6Rate,
      threshold: t.mt6BreachBelow,
      windowSize: input.windowSize,
    });
  }
  if (input.mt7Violations > t.mt7MaxViolations) {
    breaches.push({
      metric: 'mt7_capstone_violations',
      observed: input.mt7Violations,
      threshold: t.mt7MaxViolations,
      windowSize: input.windowSize,
    });
  }
  if (input.mt8Rate !== null && input.mt8Rate > t.mt8BreachAbove) {
    breaches.push({
      metric: 'mt8_llm_judge_ratio',
      observed: input.mt8Rate,
      threshold: t.mt8BreachAbove,
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
  /**
   * ADR-017 MT6 — free-form 샘플 수. **ADR-013 커밋 3 보정**: 파서 한계
   * (ast_failure_reason IS NOT NULL) 샘플은 분모에서 제외해 "진짜 모호성"만 추적.
   */
  free_form_total: number;
  /** Layer 1에서 해소된 free-form 수 (layer_1_resolved=true AND ast_failure_reason IS NULL) */
  free_form_layer1_resolved: number;
  /**
   * ADR-017 MT8 — grading_method='llm' 채점 수. **ADR-013 커밋 3 보정**: 파서 한계
   * (ast_failure_reason IS NOT NULL) 샘플은 분모/분자에서 제외. 파서 버그가 강제로
   * LLM 호출을 유발하는 경우가 MT8 breach 로 오인되는 것을 방지.
   */
  llm_judge_calls: number;
  /** 채점 기록된 총 샘플 (grading_method IS NOT NULL AND ast_failure_reason IS NULL) */
  graded_total: number;
  /**
   * ADR-013 커밋 3 — 파서 한계로 MT6/MT8 분모에서 제외된 샘플 수.
   * 리포트 투명성용. Rewriter(Session 4+) 도입 후 감소해야 정상.
   */
  parser_dialect_skipped: number;
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
    const mt6Rate =
      raw.free_form_total > 0 ? raw.free_form_layer1_resolved / raw.free_form_total : null;
    const mt8Rate = raw.graded_total > 0 ? raw.llm_judge_calls / raw.graded_total : null;
    // MT7 — 캡스톤 DAG 위반. capstone_sessions 엔티티가 MVP-C에서 도입되므로
    // MVP-A 시점에는 0 고정. 이후 dedicated repository가 생기면 교체.
    const mt7Violations = 0;

    const breaches = evaluateGates(
      {
        mt3Rate,
        mt4Rate,
        p95LatencyMs: raw.p95_ms,
        studentReportRate,
        windowSize: raw.window_size,
        mt6Rate,
        mt7Violations,
        mt8Rate,
      },
      this.thresholds,
    );

    for (const breach of breaches) {
      await this.eventRepo.save({
        kind: mapBreachKind(breach.metric),
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
      await this.writeWindowOneReport(
        raw,
        mt3Rate,
        mt4Rate,
        studentReportRate,
        mt6Rate,
        mt7Violations,
        mt8Rate,
        breaches,
      );
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
      .addSelect(
        "COUNT(*) FILTER (WHERE m.answer_format = 'free-form' AND m.ast_failure_reason IS NULL)",
        'free_form_total',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE m.answer_format = 'free-form' AND m.layer_1_resolved = TRUE AND m.ast_failure_reason IS NULL)",
        'free_form_layer1_resolved',
      )
      .addSelect(
        "COUNT(*) FILTER (WHERE m.grading_method = 'llm' AND m.ast_failure_reason IS NULL)",
        'llm_judge_calls',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE m.grading_method IS NOT NULL AND m.ast_failure_reason IS NULL)',
        'graded_total',
      )
      .addSelect(
        'COUNT(*) FILTER (WHERE m.ast_failure_reason IS NOT NULL)',
        'parser_dialect_skipped',
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
      free_form_total: Number(raw?.free_form_total ?? 0),
      free_form_layer1_resolved: Number(raw?.free_form_layer1_resolved ?? 0),
      llm_judge_calls: Number(raw?.llm_judge_calls ?? 0),
      graded_total: Number(raw?.graded_total ?? 0),
      parser_dialect_skipped: Number(raw?.parser_dialect_skipped ?? 0),
    };
  }

  private async writeWindowOneReport(
    raw: RawAggregate,
    mt3Rate: number,
    mt4Rate: number | null,
    studentReportRate: number,
    mt6Rate: number | null,
    mt7Violations: number,
    mt8Rate: number | null,
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
      mt6Rate,
      mt7Violations,
      mt8Rate,
      breaches,
      thresholds: this.thresholds,
      generatedAt: new Date().toISOString(),
    });
    await this.writer.write(this.reportPath, content);
    this.logger.log(`window-1 리포트 작성: ${this.reportPath}`);
  }
}

function mapBreachKind(metric: GateBreachPayload['metric']): OpsEventKind {
  switch (metric) {
    case 'mt6_canonical_match_rate':
      return 'mt6_breach';
    case 'mt7_capstone_violations':
      return 'mt7_breach';
    case 'mt8_llm_judge_ratio':
      return 'mt8_breach';
    default:
      return 'gate_breach';
  }
}

interface RenderInput {
  raw: RawAggregate;
  mt3Rate: number;
  mt4Rate: number | null;
  studentReportRate: number;
  mt6Rate: number | null;
  mt7Violations: number;
  mt8Rate: number | null;
  breaches: GateBreachPayload[];
  thresholds: GateThresholds;
  generatedAt: string;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function renderWindowOneReport(input: RenderInput): string {
  const {
    raw,
    mt3Rate,
    mt4Rate,
    studentReportRate,
    mt6Rate,
    mt7Violations,
    mt8Rate,
    breaches,
    thresholds,
    generatedAt,
  } = input;
  const mt6Cell =
    mt6Rate === null
      ? 'N/A (free-form 샘플 없음)'
      : `${raw.free_form_layer1_resolved}/${raw.free_form_total} = ${pct(mt6Rate)}`;
  const mt6Pass = mt6Rate === null || mt6Rate >= thresholds.mt6BreachBelow;
  const mt8Cell =
    mt8Rate === null
      ? 'N/A (채점 샘플 없음)'
      : `${raw.llm_judge_calls}/${raw.graded_total} = ${pct(mt8Rate)}`;
  const mt8Pass = mt8Rate === null || mt8Rate <= thresholds.mt8BreachAbove;
  const lines = [
    '# 운영 모니터링 — window-1 (초기 100건) 리포트',
    '',
    `**생성 시각**: ${generatedAt}`,
    `**근거 SDD**: \`docs/architecture/operational-monitoring-design.md\` §4.4`,
    `**근거 ADR**: ADR-011 채택 조건 #3, ADR-017 (MT6/MT7/MT8)`,
    '',
    '## 측정 결과',
    '',
    '| 지표 | 측정값 | 기준 | 합격 |',
    '|---|---|---|---|',
    `| MT3 (화이트리스트) | ${raw.mt3_pass_count}/${raw.window_size} = ${pct(mt3Rate)} | ≥ ${pct(thresholds.mt3MinRate)} | ${mt3Rate >= thresholds.mt3MinRate ? '✅' : '❌'} |`,
    `| MT4 (빈칸 일관성) | ${mt4Rate === null ? 'N/A' : `${raw.mt4_pass_count}/${raw.mt4_eligible_count} = ${pct(mt4Rate)}`} | ≥ ${pct(thresholds.mt4MinRate)} | ${mt4Rate === null || mt4Rate >= thresholds.mt4MinRate ? '✅' : '❌'} |`,
    `| MT6 (free-form canonical) | ${mt6Cell} | ≥ ${pct(thresholds.mt6BreachBelow)} | ${mt6Pass ? '✅' : '❌'} |`,
    `| MT7 (캡스톤 DAG 위반) | ${mt7Violations}건 (MVP-C 이후 활성) | = ${thresholds.mt7MaxViolations} | ${mt7Violations <= thresholds.mt7MaxViolations ? '✅' : '❌'} |`,
    `| MT8 (LLM-judge 호출률) | ${mt8Cell} | ≤ ${pct(thresholds.mt8BreachAbove)} | ${mt8Pass ? '✅' : '❌'} |`,
    `| p95 지연 | ${(raw.p95_ms / 1000).toFixed(1)}s | ≤ ${(thresholds.p95MaxMs / 1000).toFixed(0)}s | ${raw.p95_ms <= thresholds.p95MaxMs ? '✅' : '❌'} |`,
    `| 수강생 신고율 | ${pct(studentReportRate)} | ≤ ${pct(thresholds.studentReportMaxRate)} | ${studentReportRate <= thresholds.studentReportMaxRate ? '✅' : '❌'} |`,
    '',
    `> **ADR-013 Session 3 보정**: Layer 1 파서 한계로 MT6/MT8 분모에서 제외된 샘플 **${raw.parser_dialect_skipped}건**. Session 4+ Rewriter 도입 후 감소해야 정상.`,
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

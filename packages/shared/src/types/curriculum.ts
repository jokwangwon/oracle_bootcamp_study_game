/**
 * Oracle DBA 부트캠프 커리큘럼 정의
 *
 * 주차 순서는 변경될 수 있으며, 강사 진도에 따라 동적으로 조정 가능.
 */

export const CURRICULUM_TOPICS = [
  'sql-basics',
  'sql-functions',
  'transactions',
  'plsql',
  'administration',
  'backup-recovery',
  'performance-tuning',
  'sql-tuning',
  'rac',
  'linux',
  'python-hadoop',
] as const;

export type Topic = (typeof CURRICULUM_TOPICS)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  'sql-basics': 'SQL 기초',
  'sql-functions': 'SQL 함수',
  transactions: '트랜잭션 & 읽기 일관성',
  plsql: 'PL/SQL',
  administration: 'Oracle 관리',
  'backup-recovery': 'Backup & Recovery',
  'performance-tuning': 'Performance Tuning',
  'sql-tuning': 'SQL Tuning',
  rac: 'RAC (Real Application Cluster)',
  linux: 'Linux',
  'python-hadoop': 'Python & Hadoop',
};

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface WeeklyScope {
  week: number;
  topic: Topic;
  keywords: string[]; // 해당 주차에서 허용된 키워드 화이트리스트
  sourceUrl?: string; // 노션 자료 출처
  createdAt: Date;
}

/**
 * 메인 페이지 mock ViewModel — 시안 D (PR-8b).
 *
 * 실제 API 가 준비될 때까지의 시각 검증용. concept-d §4.3 수치 그대로.
 * 실 API 연결 시 이 파일을 교체 (`data.ts` 의 import 경로만 바꾸면 됨).
 */

import type { HomeViewModel } from './types';

const today: HomeViewModel['todayQuestion'] = {
  // PR-12 §3.2 mock — 실 API 연결 시 백엔드에서 채움.
  questionId: '00000000-0000-4000-8000-000000000016',
  discussionCount: 4,
  filename: 'day16-cursor.sql',
  modeLabel: '빈칸 · 객관식',
  code: [
    [
      { text: 'CURSOR', kind: 'keyword' },
      { text: ' c_emp ' },
      { text: 'IS', kind: 'keyword' },
    ],
    [
      { text: '  ' },
      { text: 'SELECT', kind: 'fn' },
      { text: ' empno ' },
      { text: 'FROM', kind: 'fn' },
      { text: ' emp;' },
    ],
    [
      { text: 'FOR', kind: 'keyword' },
      { text: ' rec ' },
      { text: 'IN', kind: 'keyword' },
      { text: ' c_emp ' },
      { text: 'LOOP', kind: 'keyword' },
    ],
    [
      { text: '  DBMS.PUT(' },
      { text: '??', kind: 'highlight' },
      { text: ');' },
    ],
  ],
};

export const authedMock: HomeViewModel = {
  hero: {
    chapterLabel: 'DAY 16 / 20 · PL/SQL CURSOR',
    title: '오늘의 PL/SQL,\n4문제만 풀고 가요',
    subtitle: '1위까지 880 XP · 8일째 연속 학습',
    streakIndicator: true,
    // 정식 resume (직전 세션 복원) 은 백엔드 GET /games/solo/last-session
    // endpoint 가 필요 — 별도 PR. 현재는 새 세션 config 화면으로 진입하는
    // "솔로 게임 시작" 으로 명명해 동작/문구 일치.
    primaryCta: { label: '솔로 게임 시작', href: '/play/solo' },
    secondaryCta: { label: '오답 노트', href: '/review/mistakes' },
  },
  todayQuestion: today,
  ticker: {
    activeUsers: 12,
    topPlayer: { name: '김OO', score: 4820 },
    accuracyPct: 67,
  },
  journey: {
    days: Array.from({ length: 20 }, (_, i) => {
      const day = i + 1;
      let status: HomeViewModel['journey']['days'][number]['status'];
      if (day <= 13) status = 'done';
      else if (day <= 15) status = 'recent';
      else if (day === 16) status = 'today';
      else status = 'upcoming';
      return { day, status };
    }),
    currentDay: 16,
    completedDays: 15,
    totalDays: 20,
  },
  cards: {
    primary: {
      modeChips: ['빈칸', '용어', 'MC', '+2'],
      chapterProgress: { completed: 7, total: 12, xpReward: 150 },
    },
    ranking: {
      top: [
        { rank: 1, name: '김OO', score: 4820 },
        { rank: 2, name: '이OO', score: 4210 },
      ],
      me: { rank: 7, name: '나', score: 3940 },
    },
    admin: { locked: true },
  },
};

const guestCode: HomeViewModel['todayQuestion'] = {
  filename: 'intro.sql',
  modeLabel: '빈칸 · 객관식',
  code: [
    [
      { text: 'SELECT', kind: 'fn' },
      { text: ' ename, sal' },
    ],
    [
      { text: 'FROM', kind: 'fn' },
      { text: ' emp' },
    ],
    [
      { text: 'WHERE', kind: 'fn' },
      { text: ' deptno = ' },
      { text: '??', kind: 'highlight' },
      { text: ';' },
    ],
    [{ text: '' }],
  ],
};

export const guestMock: HomeViewModel = {
  hero: {
    chapterLabel: null,
    title: 'SQL과 PL/SQL,\n외우지 말고 풀면서 익히자',
    subtitle: '부트캠프에서 배우는 SQL/PL/SQL 용어와 함수를 게임으로 자연스럽게 외우자.',
    streakIndicator: false,
    primaryCta: { label: '지금 시작하기', href: '/register' },
    secondaryCta: { label: '랭킹 보기', href: '/rankings' },
  },
  todayQuestion: guestCode,
  ticker: null,
  guestTickerCopy: '최근 풀이 1,247건 · 오늘 +82',
  journey: {
    days: Array.from({ length: 20 }, (_, i) => ({
      day: i + 1,
      status: 'upcoming' as const,
    })),
    currentDay: 0,
    completedDays: 0,
    totalDays: 20,
  },
  cards: {
    primary: {
      modeChips: ['빈칸', '용어', 'MC', '+2'],
      chapterProgress: null,
    },
    ranking: {
      top: [
        { rank: 1, name: '김OO', score: 4820 },
        { rank: 2, name: '이OO', score: 4210 },
      ],
      me: null,
    },
    admin: { locked: true },
  },
};

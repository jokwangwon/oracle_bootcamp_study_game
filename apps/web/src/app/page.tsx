import Link from 'next/link';
import { ArrowRight, BookOpen, Trophy, Settings2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';

const cards = [
  {
    href: '/play/solo',
    title: '솔로 플레이',
    desc: '주차/주제/난이도 선택. 빈칸·용어·MC 등 5가지 모드.',
    icon: BookOpen,
    primary: true,
  },
  {
    href: '/rankings',
    title: '랭킹',
    desc: '동기 수강생들과 점수 경쟁',
    icon: Trophy,
    primary: false,
  },
  {
    href: '/admin/scope',
    title: '학습 범위 관리',
    desc: '(관리자) 노션 자료 import 및 화이트리스트 편집',
    icon: Settings2,
    primary: false,
  },
] as const;

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="mb-12">
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-fg sm:text-5xl">
          Oracle DBA 학습 게임
        </h1>
        <p className="max-w-2xl text-base text-fg-muted sm:text-lg">
          부트캠프에서 배우는 SQL/PL/SQL 용어와 함수를 게임으로 자연스럽게 외우자.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group block focus:outline-none">
            <Card
              className={
                'relative h-full overflow-hidden border-border bg-bg-elevated transition-all duration-200 ' +
                'hover:-translate-y-0.5 hover:border-brand hover:shadow-lg ' +
                'group-focus-visible:ring-2 group-focus-visible:ring-brand group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-bg'
              }
            >
              {c.primary && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand via-brand/70 to-transparent"
                />
              )}
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                </div>
                <CardTitle className="text-lg text-fg">{c.title}</CardTitle>
                <CardDescription className="text-fg-muted">{c.desc}</CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}

import Link from 'next/link';

export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '4rem 1.5rem',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        Oracle DBA 학습 게임
      </h1>
      <p style={{ color: 'var(--fg-muted)', marginBottom: '2.5rem' }}>
        부트캠프에서 배우는 SQL/PL/SQL 용어와 함수를 게임으로 자연스럽게 외우자.
      </p>

      <section
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        }}
      >
        <Card
          href="/play/solo"
          title="솔로 플레이"
          desc="혼자 학습 모드. 주차/주제/난이도 선택"
        />
        <Card
          href="/rankings"
          title="랭킹"
          desc="동기 수강생들과 점수 경쟁"
        />
        <Card
          href="/admin/scope"
          title="학습 범위 관리"
          desc="(관리자) 노션 자료 import 및 화이트리스트 편집"
        />
      </section>
    </main>
  );
}

function Card({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'block',
        padding: '1.5rem',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{title}</h2>
      <p style={{ color: 'var(--fg-muted)', fontSize: '0.9rem' }}>{desc}</p>
    </Link>
  );
}

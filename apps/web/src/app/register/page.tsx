'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { apiClient } from '@/lib/api-client';
import { setToken } from '@/lib/auth-storage';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { accessToken } = await apiClient.auth.register({
        username,
        email,
        password,
      });
      setToken(accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원가입 실패');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 420,
        margin: '0 auto',
        padding: '4rem 1.5rem',
      }}
    >
      <h1 style={{ fontSize: '1.75rem', marginBottom: '1.5rem' }}>회원가입</h1>

      <form onSubmit={handleSubmit}>
        <Field label="닉네임 (2자 이상)">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={2}
            maxLength={50}
            autoFocus
            style={inputStyle}
          />
        </Field>

        <Field label="이메일">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
        </Field>

        <Field label="비밀번호 (8자 이상)">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            style={inputStyle}
          />
        </Field>

        <button
          type="submit"
          disabled={submitting}
          style={{
            ...buttonStyle,
            opacity: submitting ? 0.6 : 1,
            marginTop: '1rem',
          }}
        >
          {submitting ? '가입 중...' : '회원가입'}
        </button>

        {error && <p style={{ color: 'var(--error)', marginTop: '1rem' }}>{error}</p>}
      </form>

      <p style={{ marginTop: '1.5rem', color: 'var(--fg-muted)' }}>
        이미 계정이 있나요?{' '}
        <Link href="/login" style={{ color: 'var(--accent)' }}>
          로그인
        </Link>
      </p>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: '1rem' }}>
      <span
        style={{
          display: 'block',
          color: 'var(--fg-muted)',
          marginBottom: '0.25rem',
          fontSize: '0.9rem',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem',
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--fg)',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: 8,
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  width: '100%',
};

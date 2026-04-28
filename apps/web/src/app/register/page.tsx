'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { apiClient } from '@/lib/api-client';
import { setToken } from '@/lib/auth-storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    <main className="mx-auto flex max-w-md flex-col px-6 py-16">
      <Card className="border-border bg-bg-elevated">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-fg">회원가입</CardTitle>
          <CardDescription className="text-fg-muted">
            이메일로 가입하고 부트캠프 학습을 시작하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-fg">
                닉네임
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                maxLength={50}
                autoFocus
                autoComplete="nickname"
              />
              <p className="text-xs text-fg-muted">2~50자</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-fg">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-fg">
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-xs text-fg-muted">8자 이상</p>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand text-brand-fg hover:bg-brand/90"
              size="lg"
            >
              {submitting ? '가입 중...' : '회원가입'}
            </Button>

            {error && (
              <p role="alert" aria-live="polite" className="text-sm text-error">
                {error}
              </p>
            )}
          </form>

          <p className="mt-6 text-sm text-fg-muted">
            이미 계정이 있나요?{' '}
            <Link href="/login" className="font-medium text-brand underline-offset-4 hover:underline">
              로그인
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

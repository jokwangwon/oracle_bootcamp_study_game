import { describe, it, expect, vi } from 'vitest';

import { ModelDigestProvider } from './model-digest.provider';
import type { ModelPin } from './eval/pins/types';
import type { TagsFetcher } from './eval/pins/verify';

class FakeConfig {
  constructor(private readonly map: Record<string, string | undefined>) {}
  get<T = string>(key: string): T {
    return this.map[key] as unknown as T;
  }
}

const tagsOk = (model: string, digest: string): TagsFetcher =>
  async () => ({ models: [{ name: model, digest, modified_at: '2026-04-09T05:47:45Z' }] });

const pinFor = (model: string, digest: string): ModelPin[] => [
  { model, digest, addedAt: '2026-04-15T00:00:00Z' },
];

describe('ModelDigestProvider', () => {
  it('anthropic provider: verify를 건너뛰고 claude-api:<model> 디지스트를 반환', async () => {
    const provider = new ModelDigestProvider(
      new FakeConfig({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'claude-opus-4-6' }) as never,
      vi.fn() as TagsFetcher,
      [],
    );
    await provider.onModuleInit();

    expect(provider.getDigest()).toBe('claude-api:claude-opus-4-6');
  });

  it('ollama provider + pin 일치: currentDigest를 캐시하고 model@digest 형식으로 반환', async () => {
    const provider = new ModelDigestProvider(
      new FakeConfig({ LLM_PROVIDER: 'ollama', LLM_MODEL: 'qwen3-coder-next:latest' }) as never,
      tagsOk('qwen3-coder-next:latest', 'ca06e9e4087c'),
      pinFor('qwen3-coder-next:latest', 'ca06e9e4087c'),
    );
    await provider.onModuleInit();

    expect(provider.getDigest()).toBe('qwen3-coder-next:latest@ca06e9e4087c');
  });

  it('ollama provider + pin 불일치: 부팅 시 throw (fail-closed)', async () => {
    const provider = new ModelDigestProvider(
      new FakeConfig({ LLM_PROVIDER: 'ollama', LLM_MODEL: 'qwen3-coder-next:latest' }) as never,
      tagsOk('qwen3-coder-next:latest', 'deadbeef'),
      pinFor('qwen3-coder-next:latest', 'ca06e9e4087c'),
    );

    await expect(provider.onModuleInit()).rejects.toThrow(/digest-mismatch/);
  });

  it('ollama provider + pin 누락: 부팅 시 throw (fail-closed)', async () => {
    const provider = new ModelDigestProvider(
      new FakeConfig({ LLM_PROVIDER: 'ollama', LLM_MODEL: 'qwen3-coder-next:latest' }) as never,
      tagsOk('qwen3-coder-next:latest', 'ca06e9e4087c'),
      [],
    );

    await expect(provider.onModuleInit()).rejects.toThrow(/not-pinned/);
  });

  it('DIGEST_PIN_SKIP=true: verify를 건너뛰고 unverified-skip 디지스트를 반환', async () => {
    const provider = new ModelDigestProvider(
      new FakeConfig({
        LLM_PROVIDER: 'ollama',
        LLM_MODEL: 'qwen3-coder-next:latest',
        DIGEST_PIN_SKIP: 'true',
      }) as never,
      vi.fn() as TagsFetcher,
      [],
    );
    await provider.onModuleInit();

    expect(provider.getDigest()).toBe('qwen3-coder-next:latest@unverified-skip');
  });

  it('getDigest를 init 전에 호출하면 명시적 에러', () => {
    const provider = new ModelDigestProvider(
      new FakeConfig({ LLM_PROVIDER: 'anthropic', LLM_MODEL: 'claude' }) as never,
      vi.fn() as TagsFetcher,
      [],
    );

    expect(() => provider.getDigest()).toThrow(/not initialized/i);
  });
});

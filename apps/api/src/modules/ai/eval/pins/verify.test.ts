import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { verifyApprovedModel, loadPins, savePins } from './verify';
import type { ModelPin, OllamaTagsResponse } from './types';

const mkTags = (models: Array<{ name: string; digest: string }>): OllamaTagsResponse => ({
  models: models.map((m) => ({ ...m, modified_at: '2026-04-09T05:47:45Z' })),
});

const fakeFetch = (resp: OllamaTagsResponse) => async () => resp;

describe('verifyApprovedModel', () => {
  it('returns not-pinned when pins array is empty', async () => {
    const result = await verifyApprovedModel(
      'qwen3-coder-next:latest',
      [],
      fakeFetch(mkTags([{ name: 'qwen3-coder-next:latest', digest: 'abc123' }])),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-pinned');
      expect(result.model).toBe('qwen3-coder-next:latest');
    }
  });

  it('returns not-pinned when target model has no pin entry', async () => {
    const pins: ModelPin[] = [
      { model: 'qwen2.5-coder:32b', digest: 'b92d6a0bd47e', addedAt: '2026-04-15T00:00:00Z' },
    ];
    const result = await verifyApprovedModel(
      'qwen3-coder-next:latest',
      pins,
      fakeFetch(mkTags([{ name: 'qwen3-coder-next:latest', digest: 'abc123' }])),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-pinned');
  });

  it('returns not-found-in-ollama when Ollama lacks the model', async () => {
    const pins: ModelPin[] = [
      { model: 'qwen3-coder-next:latest', digest: 'ca06e9e4087c', addedAt: '2026-04-15T00:00:00Z' },
    ];
    const result = await verifyApprovedModel(
      'qwen3-coder-next:latest',
      pins,
      fakeFetch(mkTags([{ name: 'exaone3.5:32b', digest: 'f2f69abac3da' }])),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-found-in-ollama');
  });

  it('returns ok when digest matches exactly', async () => {
    const pins: ModelPin[] = [
      {
        model: 'qwen3-coder-next:latest',
        digest: 'ca06e9e4087c714d',
        addedAt: '2026-04-15T00:00:00Z',
        evalRound: 'R-2026-04-14T11-32-26Z',
      },
    ];
    const result = await verifyApprovedModel(
      'qwen3-coder-next:latest',
      pins,
      fakeFetch(mkTags([{ name: 'qwen3-coder-next:latest', digest: 'ca06e9e4087c714d' }])),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pin.evalRound).toBe('R-2026-04-14T11-32-26Z');
      expect(result.currentDigest).toBe('ca06e9e4087c714d');
    }
  });

  it('accepts matching prefix (Ollama returns short hash in list)', async () => {
    const pins: ModelPin[] = [
      {
        model: 'qwen3-coder-next:latest',
        digest: 'ca06e9e4087c714dffffffffffffffffffff',
        addedAt: '2026-04-15T00:00:00Z',
      },
    ];
    const result = await verifyApprovedModel(
      'qwen3-coder-next:latest',
      pins,
      fakeFetch(mkTags([{ name: 'qwen3-coder-next:latest', digest: 'ca06e9e4087c714d' }])),
    );
    expect(result.ok).toBe(true);
  });

  it('returns digest-mismatch when digests diverge', async () => {
    const pins: ModelPin[] = [
      { model: 'qwen3-coder-next:latest', digest: 'ca06e9e4087c', addedAt: '2026-04-15T00:00:00Z' },
    ];
    const result = await verifyApprovedModel(
      'qwen3-coder-next:latest',
      pins,
      fakeFetch(mkTags([{ name: 'qwen3-coder-next:latest', digest: 'deadbeef0000' }])),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('digest-mismatch');
      expect(result.pin?.digest).toBe('ca06e9e4087c');
      expect(result.currentDigest).toBe('deadbeef0000');
    }
  });

  it('propagates fetch errors as not-found-in-ollama with message', async () => {
    const boom = async (): Promise<OllamaTagsResponse> => {
      throw new Error('ECONNREFUSED');
    };
    const pins: ModelPin[] = [
      { model: 'qwen3-coder-next:latest', digest: 'ca06e9e4087c', addedAt: '2026-04-15T00:00:00Z' },
    ];
    const result = await verifyApprovedModel('qwen3-coder-next:latest', pins, boom);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('not-found-in-ollama');
      expect(result.message).toContain('ECONNREFUSED');
    }
  });
});

describe('loadPins / savePins', () => {
  it('round-trips pins through JSON file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pins-'));
    const file = path.join(dir, 'approved-models.json');
    const pins: ModelPin[] = [
      {
        model: 'qwen3-coder-next:latest',
        digest: 'ca06e9e4087c714d',
        addedAt: '2026-04-15T00:00:00Z',
        evalRound: 'R-2026-04-14T11-32-26Z',
        notes: 'ADR-011 primary',
      },
    ];
    savePins(file, pins);
    const loaded = loadPins(file);
    expect(loaded).toEqual(pins);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns empty array when file does not exist', () => {
    const file = path.join(os.tmpdir(), `missing-${Date.now()}.json`);
    expect(loadPins(file)).toEqual([]);
  });

  it('throws when file content is not an array', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pins-'));
    const file = path.join(dir, 'bad.json');
    fs.writeFileSync(file, '{"not":"an array"}');
    expect(() => loadPins(file)).toThrow(/array/i);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

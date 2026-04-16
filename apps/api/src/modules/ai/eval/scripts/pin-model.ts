#!/usr/bin/env tsx
/**
 * Ollama 모델 digest pin CLI.
 *
 * ADR-011 채택 조건 #2 — 평가에서 PASS한 모델의 digest를 JSON 파일로 고정하여
 * 이후 실행에서 drift를 차단한다.
 *
 * 사용법:
 *   npx tsx apps/api/src/modules/ai/eval/scripts/pin-model.ts \
 *     --model qwen3-coder-next:latest \
 *     --round R-2026-04-14T11-32-26Z \
 *     --notes "ADR-011 primary"
 *
 * 옵션:
 *   --model <name>     Ollama 모델명 (필수)
 *   --round <roundId>  근거 평가 라운드 ID (선택)
 *   --notes <text>     운영자 주석 (선택)
 *   --file <path>      approved-models.json 경로 (기본: pins/approved-models.json)
 *   --force            동일 모델 pin이 이미 존재해도 digest를 덮어씀
 */

import * as path from 'node:path';

import { defaultTagsFetcher, loadPins, savePins } from '../pins/verify';
import type { ModelPin } from '../pins/types';

interface Args {
  model: string;
  round?: string;
  notes?: string;
  file: string;
  force: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let model = '';
  let round: string | undefined;
  let notes: string | undefined;
  let force = false;
  let file = path.resolve(__dirname, '..', 'pins', 'approved-models.json');

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--model':
        model = argv[++i] ?? '';
        break;
      case '--round':
        round = argv[++i];
        break;
      case '--notes':
        notes = argv[++i];
        break;
      case '--file':
        file = path.resolve(argv[++i] ?? file);
        break;
      case '--force':
        force = true;
        break;
    }
  }

  if (!model) {
    console.error('Error: --model <name> is required');
    process.exit(1);
  }
  return { model, round, notes, file, force };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const tags = await defaultTagsFetcher()();
  const match = tags.models.find((m) => m.name === args.model);
  if (!match) {
    console.error(`Model "${args.model}" not found in Ollama.`);
    console.error('Available:', tags.models.map((m) => m.name).join(', '));
    process.exit(2);
  }

  const pins = loadPins(args.file);
  const existing = pins.find((p) => p.model === args.model);
  if (existing && !args.force) {
    if (existing.digest === match.digest) {
      console.log(`No change: "${args.model}" already pinned to ${match.digest}.`);
      return;
    }
    console.error(
      `Pin for "${args.model}" exists with digest ${existing.digest} (current: ${match.digest}). Use --force to overwrite.`,
    );
    process.exit(3);
  }

  const entry: ModelPin = {
    model: args.model,
    digest: match.digest,
    addedAt: new Date().toISOString(),
    evalRound: args.round,
    notes: args.notes,
  };
  const next = existing
    ? pins.map((p) => (p.model === args.model ? entry : p))
    : [...pins, entry];
  savePins(args.file, next);
  console.log(`${existing ? 'Updated' : 'Added'} pin: ${args.model} -> ${match.digest}`);
  console.log(`File: ${args.file}`);
}

main().catch((err) => {
  console.error('Unexpected failure:', err);
  process.exit(1);
});

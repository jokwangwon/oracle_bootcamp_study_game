/**
 * ADR-018 §11 — salt rotation CLI.
 *
 * 사용법:
 *   # 정기 rotation
 *   pnpm ops:rotate-salt --reason=scheduled --admin-id=<uuid>
 *
 *   # 사고 대응
 *   pnpm ops:rotate-salt --reason=incident --admin-id=<uuid> --note="...유출 의심..."
 *
 * 전제 조건 (ADR-018 §11):
 *  1. `.env` 에 새 `USER_TOKEN_HASH_SALT` (+ 필요 시 `USER_TOKEN_HASH_SALT_PREV`) 기입.
 *  2. `ADMIN_ACK_SALT_ROTATION=<prev_fp_or_none>:<new_fp>` 환경변수 설정 (2-step 게이트).
 *  3. api 컨테이너 재기동 (새 salt 로 부팅 성공 확인).
 *  4. 본 CLI 실행 → epoch 원장 INSERT + ops_event_log 기록.
 *  5. `ADMIN_ACK_SALT_ROTATION` 즉시 제거.
 *
 * salt 평문은 stdout/로그/이벤트 어디에도 기록되지 않는다. fingerprint (sha256 8자)만 출력.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';

import { AppModule } from '../app.module';
import { SaltRotationService } from '../modules/ops/salt-rotation.service';

dotenv.config();

interface ParsedArgs {
  reason: 'scheduled' | 'incident';
  adminId: string;
  note: string | null;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const args: Partial<ParsedArgs> = { note: null };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--reason=')) {
      const v = arg.slice('--reason='.length);
      if (v !== 'scheduled' && v !== 'incident') {
        throw new Error(`--reason 은 'scheduled' 또는 'incident' 여야 합니다 (받음: ${v})`);
      }
      args.reason = v;
    } else if (arg.startsWith('--admin-id=')) {
      args.adminId = arg.slice('--admin-id='.length);
    } else if (arg.startsWith('--note=')) {
      args.note = arg.slice('--note='.length);
    } else {
      throw new Error(`알 수 없는 인자: ${arg}`);
    }
  }
  if (!args.reason) throw new Error('--reason 필수');
  if (!args.adminId) throw new Error('--admin-id 필수 (운영자 UUID)');
  return args as ParsedArgs;
}

export async function runRotateSalt(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const logger = new Logger('rotate-salt');
  const parsed = parseArgs(argv);

  const newSalt = env.USER_TOKEN_HASH_SALT;
  const prevSalt = env.USER_TOKEN_HASH_SALT_PREV ?? null;
  const adminAck = env.ADMIN_ACK_SALT_ROTATION;

  if (!newSalt || newSalt.length < 16) {
    throw new Error(
      'USER_TOKEN_HASH_SALT 미설정 또는 16자 미만. .env 먼저 수정 후 api 재기동하세요.',
    );
  }
  if (!adminAck) {
    throw new Error(
      'ADMIN_ACK_SALT_ROTATION 미설정. 형식: <prev_fp_or_none>:<new_fp> (ADR-018 §11 step 3)',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.get(SaltRotationService);
    const result = await service.rotate({
      newSalt,
      prevSalt,
      adminId: parsed.adminId,
      reason: parsed.reason,
      note: parsed.note,
      adminAck,
    });
    logger.log(
      `✅ salt rotation 완료: epoch_id=${result.epochId} new_fp=${result.newFingerprint} prev_fp=${result.prevFingerprint ?? 'none'} reason=${parsed.reason}`,
    );
    logger.log('다음 단계: ADMIN_ACK_SALT_ROTATION 환경변수를 즉시 제거하세요.');
  } finally {
    await app.close();
  }
}

// __filename 기반 CLI 진입점 검출 (vitest import 시 실행 방지)
if (require.main === module) {
  runRotateSalt().catch((err) => {
    console.error('[rotate-salt] FAILED:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

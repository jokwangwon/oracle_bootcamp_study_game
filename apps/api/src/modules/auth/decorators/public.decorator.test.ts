import { describe, expect, it } from 'vitest';

import { IS_PUBLIC_KEY, Public } from './public.decorator';

/**
 * PR-12 §7 — @Public() 메타데이터 데코레이터 단위 검증.
 */

describe('Public 데코레이터 (Phase 3c)', () => {
  it('IS_PUBLIC_KEY 상수가 "isPublic" 으로 고정', () => {
    expect(IS_PUBLIC_KEY).toBe('isPublic');
  });

  it('@Public() 적용 시 IS_PUBLIC_KEY 메타데이터에 true 설정', () => {
    class Sample {
      @Public()
      foo() {
        return 'ok';
      }

      bar() {
        return 'no';
      }
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Sample.prototype.foo)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, Sample.prototype.bar)).toBeUndefined();
  });
});

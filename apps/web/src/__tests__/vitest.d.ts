/// <reference types="vitest/globals" />
import '@testing-library/jest-dom/vitest';
import type * as VitestAxeMatchers from 'vitest-axe/matchers';

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends VitestAxeMatchers.AxeMatchers {}
  interface AsymmetricMatchersContaining extends VitestAxeMatchers.AxeMatchers {}
}

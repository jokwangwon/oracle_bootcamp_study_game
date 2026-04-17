import { describe, it, expect } from 'vitest';

import { blocksToMarkdown, type SupportedBlock } from './notion-markdown';

describe('blocksToMarkdown', () => {
  it('빈 배열 → 빈 문자열', () => {
    expect(blocksToMarkdown([])).toBe('');
  });

  it('paragraph 블록을 단순 텍스트로 변환', () => {
    const blocks: SupportedBlock[] = [
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'Hello world' }] } },
    ];
    expect(blocksToMarkdown(blocks)).toBe('Hello world');
  });

  it('heading_1/2/3을 #/##/### 으로 변환', () => {
    const blocks: SupportedBlock[] = [
      { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'H1' }] } },
      { type: 'heading_2', heading_2: { rich_text: [{ plain_text: 'H2' }] } },
      { type: 'heading_3', heading_3: { rich_text: [{ plain_text: 'H3' }] } },
    ];
    expect(blocksToMarkdown(blocks)).toBe('# H1\n\n## H2\n\n### H3');
  });

  it('bulleted/numbered list item을 -/1. 로 변환', () => {
    const blocks: SupportedBlock[] = [
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'one' }] } },
      { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'two' }] } },
      { type: 'numbered_list_item', numbered_list_item: { rich_text: [{ plain_text: 'three' }] } },
    ];
    expect(blocksToMarkdown(blocks)).toBe('- one\n- two\n\n1. three');
  });

  it('code 블록을 ```language``` 로 변환', () => {
    const blocks: SupportedBlock[] = [
      {
        type: 'code',
        code: { rich_text: [{ plain_text: 'SELECT * FROM emp;' }], language: 'sql' },
      },
    ];
    expect(blocksToMarkdown(blocks)).toBe('```sql\nSELECT * FROM emp;\n```');
  });

  it('quote / divider 변환', () => {
    const blocks: SupportedBlock[] = [
      { type: 'quote', quote: { rich_text: [{ plain_text: 'wisdom' }] } },
      { type: 'divider', divider: {} },
    ];
    expect(blocksToMarkdown(blocks)).toBe('> wisdom\n\n---');
  });

  it('미지원 블록은 주석으로 보존 (감사)', () => {
    const blocks: SupportedBlock[] = [
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'before' }] } },
      // @ts-expect-error — unknown 블록 타입을 일부러 주입
      { type: 'embed', embed: { url: 'https://example.com' } },
      { type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'after' }] } },
    ];
    const md = blocksToMarkdown(blocks);
    expect(md).toContain('before');
    expect(md).toContain('<!-- unsupported notion block: embed -->');
    expect(md).toContain('after');
  });

  it('rich_text 여러 fragment를 그대로 이어붙임 (formatting은 plain_text만 사용)', () => {
    const blocks: SupportedBlock[] = [
      {
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { plain_text: '안녕 ' },
            { plain_text: '세계' },
          ],
        },
      },
    ];
    expect(blocksToMarkdown(blocks)).toBe('안녕 세계');
  });

  it('rich_text 빈 배열 → 빈 줄 (paragraph)', () => {
    const blocks: SupportedBlock[] = [
      { type: 'paragraph', paragraph: { rich_text: [] } },
    ];
    expect(blocksToMarkdown(blocks)).toBe('');
  });
});

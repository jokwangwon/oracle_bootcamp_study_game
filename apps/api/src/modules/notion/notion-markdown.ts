/**
 * Notion 블록 → 마크다운 변환 (계산적, pure).
 *
 * SDD §4.2.1. 지원 블록은 화이트리스트 (paragraph/heading/list/code/quote/divider).
 * 미지원 블록은 `<!-- unsupported notion block: ... -->` 주석으로 보존하여
 * 감사 추적이 가능하도록 한다.
 *
 * rich_text는 단순화를 위해 `plain_text`만 사용한다 (bold/italic 등 inline
 * formatting은 Phase 2에서 처리). Notion SDK의 BlockObjectResponse 전체 타입을
 * 의존하지 않고 필요한 최소 shape만 인터페이스로 좁혀 단위 테스트를 단순화한다.
 */

interface RichText {
  plain_text: string;
}

interface RichTextContainer {
  rich_text: RichText[];
}

export type SupportedBlock =
  | { type: 'paragraph'; paragraph: RichTextContainer }
  | { type: 'heading_1'; heading_1: RichTextContainer }
  | { type: 'heading_2'; heading_2: RichTextContainer }
  | { type: 'heading_3'; heading_3: RichTextContainer }
  | { type: 'bulleted_list_item'; bulleted_list_item: RichTextContainer }
  | { type: 'numbered_list_item'; numbered_list_item: RichTextContainer }
  | { type: 'quote'; quote: RichTextContainer }
  | { type: 'divider'; divider: Record<string, never> }
  | { type: 'code'; code: RichTextContainer & { language?: string } };

/** 임의 블록 — type 키만 안전하게 읽기 위한 좁은 타입 */
interface AnyBlock {
  type: string;
  [key: string]: unknown;
}

function joinPlain(rt: RichText[] | undefined): string {
  if (!rt) return '';
  return rt.map((r) => r.plain_text).join('');
}

function blockToMarkdown(block: AnyBlock): string {
  switch (block.type) {
    case 'paragraph': {
      const rt = (block.paragraph as RichTextContainer | undefined)?.rich_text;
      return joinPlain(rt);
    }
    case 'heading_1':
      return `# ${joinPlain((block.heading_1 as RichTextContainer | undefined)?.rich_text)}`;
    case 'heading_2':
      return `## ${joinPlain((block.heading_2 as RichTextContainer | undefined)?.rich_text)}`;
    case 'heading_3':
      return `### ${joinPlain((block.heading_3 as RichTextContainer | undefined)?.rich_text)}`;
    case 'bulleted_list_item':
      return `- ${joinPlain((block.bulleted_list_item as RichTextContainer | undefined)?.rich_text)}`;
    case 'numbered_list_item':
      return `1. ${joinPlain((block.numbered_list_item as RichTextContainer | undefined)?.rich_text)}`;
    case 'quote':
      return `> ${joinPlain((block.quote as RichTextContainer | undefined)?.rich_text)}`;
    case 'divider':
      return '---';
    case 'code': {
      const c = block.code as (RichTextContainer & { language?: string }) | undefined;
      const lang = c?.language ?? '';
      const body = joinPlain(c?.rich_text);
      return `\`\`\`${lang}\n${body}\n\`\`\``;
    }
    default:
      return `<!-- unsupported notion block: ${block.type} -->`;
  }
}

export function blocksToMarkdown(blocks: ReadonlyArray<AnyBlock | SupportedBlock>): string {
  if (blocks.length === 0) return '';

  // 같은 타입의 list_item들은 줄바꿈 1개로 묶고, 다른 블록 사이는 빈 줄 1개.
  const segments: string[] = [];
  let prevType: string | null = null;

  for (const block of blocks) {
    const md = blockToMarkdown(block as AnyBlock);
    const isList = block.type === 'bulleted_list_item' || block.type === 'numbered_list_item';
    const sameListAsPrev = isList && block.type === prevType;
    if (segments.length === 0) {
      segments.push(md);
    } else if (sameListAsPrev) {
      segments.push(`\n${md}`);
    } else {
      segments.push(`\n\n${md}`);
    }
    prevType = block.type;
  }
  return segments.join('').replace(/\n{3,}/g, '\n\n').trim();
}

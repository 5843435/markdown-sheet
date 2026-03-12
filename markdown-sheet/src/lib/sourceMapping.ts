import { marked, type Tokens } from "marked";

export interface SourceMapping {
  startLine: number; // 0-based line in body (after frontmatter)
  endLine: number; // 0-based, inclusive
  type: string; // "heading" | "paragraph" | "list" | etc.
}

export interface ListItemMapping {
  startLine: number;
  endLine: number;
}

/**
 * 改行数をカウント（charOffset 0〜to の範囲）
 */
function countNewlines(text: string, to: number): number {
  let count = 0;
  for (let i = 0; i < to && i < text.length; i++) {
    if (text[i] === "\n") count++;
  }
  return count;
}

/**
 * marked.lexer() でトークンを取得し、各トップレベルトークンの
 * ソース行範囲を計算する。
 *
 * body は frontmatter 除去後の本文（前処理前）。
 */
export function computeSourceMappings(body: string): SourceMapping[] {
  const tokens = marked.lexer(body);
  const mappings: SourceMapping[] = [];
  let charOffset = 0;

  for (const token of tokens) {
    if (!token.raw) continue;

    const idx = body.indexOf(token.raw, charOffset);
    if (idx === -1) continue;

    const startLine = countNewlines(body, idx);
    // raw は末尾に \n を含むことが多いので、最後の改行は endLine に含めない
    const rawEnd = idx + token.raw.length;
    const trailingNewlines =
      token.raw.endsWith("\n\n") ? 2 : token.raw.endsWith("\n") ? 1 : 0;
    const endLine = countNewlines(body, rawEnd - trailingNewlines);

    mappings.push({
      startLine,
      endLine: Math.max(startLine, endLine),
      type: token.type,
    });

    charOffset = rawEnd;
  }

  return mappings;
}

/**
 * List トークン内の各 ListItem の行範囲を計算する。
 * renderer の listitem() が呼ばれる順に消費できるよう、
 * ドキュメント内の全リストの全アイテムを順番に返す。
 */
export function computeListItemMappings(body: string): ListItemMapping[] {
  const tokens = marked.lexer(body);
  const mappings: ListItemMapping[] = [];
  let charOffset = 0;

  for (const token of tokens) {
    if (!token.raw) continue;

    const listIdx = body.indexOf(token.raw, charOffset);
    if (listIdx === -1) continue;
    charOffset = listIdx + token.raw.length;

    if (token.type !== "list") continue;

    const listToken = token as Tokens.List;
    let itemOffset = listIdx;

    for (const item of listToken.items) {
      const itemIdx = body.indexOf(item.raw, itemOffset);
      if (itemIdx === -1) continue;

      const startLine = countNewlines(body, itemIdx);
      const rawEnd = itemIdx + item.raw.length;
      const trailing = item.raw.endsWith("\n") ? 1 : 0;
      const endLine = countNewlines(body, rawEnd - trailing);

      mappings.push({
        startLine,
        endLine: Math.max(startLine, endLine),
      });

      itemOffset = rawEnd;
    }
  }

  return mappings;
}

export interface TableMapping {
  startLine: number; // 0-based line in body (after frontmatter)
  endLine: number;
}

/**
 * テーブルトークンの行範囲を計算する。
 * renderer の table() が呼ばれる順に消費できるよう、
 * ドキュメント内の全テーブルを順番に返す。
 */
export function computeTableMappings(body: string): TableMapping[] {
  const tokens = marked.lexer(body);
  const mappings: TableMapping[] = [];
  let charOffset = 0;

  for (const token of tokens) {
    if (!token.raw) continue;

    const idx = body.indexOf(token.raw, charOffset);
    if (idx === -1) continue;
    const rawEnd = idx + token.raw.length;
    charOffset = rawEnd;

    if (token.type !== "table") continue;

    const startLine = countNewlines(body, idx);
    const trailing = token.raw.endsWith("\n") ? 1 : 0;
    const endLine = countNewlines(body, rawEnd - trailing);

    mappings.push({
      startLine,
      endLine: Math.max(startLine, endLine),
    });
  }

  return mappings;
}

/**
 * Frontmatter ("---\n...\n---\n") の行数を返す。
 * frontmatter がなければ 0。
 */
export function countFrontMatterLines(content: string): number {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return 0;
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) return 0;
  // "---\n" + yaml + "\n---\n" の行数
  const fmBlock = content.slice(0, end + 4); // includes "\n---"
  // 末尾に改行があればそれも含む
  const afterFm = end + 4;
  const hasTrailingNl =
    content[afterFm] === "\n" || content[afterFm] === "\r";
  const lines = fmBlock.split("\n").length;
  return hasTrailingNl ? lines : lines;
}

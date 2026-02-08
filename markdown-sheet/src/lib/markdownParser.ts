import type { MarkdownTable, ParsedDocument } from "../types";

/** パイプ区切り行をセル値配列にパースする */
function parseRow(line: string): string[] {
  const trimmed = line.trim();
  let inner = trimmed;
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").map((s) => s.trim());
}

/** セパレーター行かどうか判定 */
function isSeparatorLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  let inner = trimmed;
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").every((cell) => {
    const c = cell.trim();
    return c.length > 0 && /^:?-+:?$/.test(c);
  });
}

/** セパレーター行からアライメント情報を取得 */
function parseAlignments(line: string): string[] {
  const trimmed = line.trim();
  let inner = trimmed;
  if (inner.startsWith("|")) inner = inner.slice(1);
  if (inner.endsWith("|")) inner = inner.slice(0, -1);
  return inner.split("|").map((cell) => {
    const c = cell.trim();
    const left = c.startsWith(":");
    const right = c.endsWith(":");
    if (left && right) return "center";
    if (right) return "right";
    if (left) return "left";
    return "none";
  });
}

/** テーブル行かどうか */
function isTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length > 0 && trimmed.includes("|");
}

/** Markdown テキストをパースし、テーブル群を抽出する */
export function parseMarkdown(content: string): ParsedDocument {
  const lines = content.split("\n");
  const tables: MarkdownTable[] = [];
  let i = 0;
  let lastHeading: string | null = null;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed.startsWith("#")) {
      lastHeading = trimmed.replace(/^#+\s*/, "");
      i++;
      continue;
    }

    if (
      i + 1 < lines.length &&
      isTableLine(lines[i]) &&
      isSeparatorLine(lines[i + 1])
    ) {
      const startLine = i;
      const headers = parseRow(lines[i]);
      const alignments = parseAlignments(lines[i + 1]);
      const rows: string[][] = [];

      let j = i + 2;
      while (j < lines.length && isTableLine(lines[j]) && !isSeparatorLine(lines[j])) {
        let row = parseRow(lines[j]);
        // 列数をヘッダーに合わせる
        while (row.length < headers.length) row.push("");
        row = row.slice(0, headers.length);
        rows.push(row);
        j++;
      }

      tables.push({
        heading: lastHeading,
        headers,
        alignments,
        rows,
        start_line: startLine,
        end_line: j - 1,
      });

      i = j;
      continue;
    }

    i++;
  }

  return { lines, tables };
}

/** テーブルを Markdown テキストに変換 */
export function serializeTable(table: MarkdownTable): string {
  const colCount = table.headers.length;
  const widths = table.headers.map((h) => Math.max(h.length, 3));
  for (const row of table.rows) {
    for (let ci = 0; ci < colCount; ci++) {
      widths[ci] = Math.max(widths[ci], (row[ci] || "").length);
    }
  }

  let out = "|";
  for (let ci = 0; ci < colCount; ci++) {
    out += ` ${table.headers[ci].padEnd(widths[ci])} |`;
  }
  out += "\n|";

  for (let ci = 0; ci < colCount; ci++) {
    const a = table.alignments[ci] || "none";
    const dashes = "-".repeat(widths[ci]);
    if (a === "left") out += `:${dashes}-|`;
    else if (a === "right") out += ` ${dashes}:|`;
    else if (a === "center") out += `:${dashes}:|`;
    else out += ` ${dashes}-|`;
  }
  out += "\n";

  for (const row of table.rows) {
    out += "|";
    for (let ci = 0; ci < colCount; ci++) {
      const cell = row[ci] || "";
      out += ` ${cell.padEnd(widths[ci])} |`;
    }
    out += "\n";
  }

  return out;
}

/** ドキュメントを再構築する */
export function rebuildDocument(
  originalLines: string[],
  tables: MarkdownTable[]
): string {
  if (tables.length === 0) return originalLines.join("\n");

  let result = "";
  let cursor = 0;

  for (const table of tables) {
    for (let k = cursor; k < table.start_line; k++) {
      result += originalLines[k] + "\n";
    }
    result += serializeTable(table);
    cursor = table.end_line + 1;
  }

  for (let k = cursor; k < originalLines.length; k++) {
    result += originalLines[k] + "\n";
  }

  if (result.endsWith("\n") && originalLines[originalLines.length - 1] !== "") {
    result = result.slice(0, -1);
  }

  return result;
}

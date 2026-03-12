import type { MarkdownTable } from "../types";

/** 行を追加する（指定行の上 or 下） */
export function addRowToTable(
  table: MarkdownTable,
  afterRow: number,
  position: "above" | "below"
): MarkdownTable {
  const next = structuredClone(table);
  const newRow = new Array(next.headers.length).fill("");
  const insertAt = position === "above" ? afterRow : afterRow + 1;
  next.rows.splice(insertAt, 0, newRow);
  next.end_line += 1;
  return next;
}

/** 行を削除する（最低1行は残す） */
export function deleteRowFromTable(
  table: MarkdownTable,
  row: number
): MarkdownTable {
  if (table.rows.length <= 1) return table;
  const next = structuredClone(table);
  next.rows.splice(row, 1);
  next.end_line -= 1;
  return next;
}

/** 列を追加する（指定列の左 or 右） */
export function addColumnToTable(
  table: MarkdownTable,
  afterCol: number,
  position: "left" | "right"
): MarkdownTable {
  const next = structuredClone(table);
  const insertAt = position === "left" ? afterCol : afterCol + 1;
  next.headers.splice(insertAt, 0, "");
  next.alignments.splice(insertAt, 0, "none");
  for (const row of next.rows) {
    row.splice(insertAt, 0, "");
  }
  return next;
}

/** 列を削除する（最低1列は残す） */
export function deleteColumnFromTable(
  table: MarkdownTable,
  col: number
): MarkdownTable {
  if (table.headers.length <= 1) return table;
  const next = structuredClone(table);
  next.headers.splice(col, 1);
  next.alignments.splice(col, 1);
  for (const row of next.rows) {
    row.splice(col, 1);
  }
  return next;
}

/** テーブルを CSV 文字列に変換する */
export function tableToCsv(table: MarkdownTable): string {
  const escape = (s: string) => {
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines: string[] = [];
  lines.push(table.headers.map(escape).join(","));
  for (const row of table.rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}

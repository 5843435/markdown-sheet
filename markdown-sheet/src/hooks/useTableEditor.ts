import { useCallback } from "react";
import type { MarkdownTable } from "../types";
import { useUndoRedo } from "./useUndoRedo";

export function useTableEditor(initialTables: MarkdownTable[]) {
  const { state: tables, push, undo, redo, reset, canUndo, canRedo } =
    useUndoRedo<MarkdownTable[]>(initialTables);

  /** セルの値を更新する */
  const updateCell = useCallback(
    (tableIndex: number, row: number, col: number, value: string) => {
      const next = structuredClone(tables);
      const t = next[tableIndex];
      if (row === -1) {
        t.headers[col] = value;
      } else {
        t.rows[row][col] = value;
      }
      push(next);
    },
    [tables, push]
  );

  /** 行を追加する（指定行の上 or 下） */
  const addRow = useCallback(
    (tableIndex: number, afterRow: number, position: "above" | "below") => {
      const next = structuredClone(tables);
      const t = next[tableIndex];
      const newRow = new Array(t.headers.length).fill("");
      const insertAt = position === "above" ? afterRow : afterRow + 1;
      t.rows.splice(insertAt, 0, newRow);
      t.end_line += 1;
      push(next);
    },
    [tables, push]
  );

  /** 行を削除する */
  const deleteRow = useCallback(
    (tableIndex: number, row: number) => {
      const next = structuredClone(tables);
      const t = next[tableIndex];
      if (t.rows.length <= 1) return; // 最低1行は残す
      t.rows.splice(row, 1);
      t.end_line -= 1;
      push(next);
    },
    [tables, push]
  );

  /** 列を追加する（指定列の左 or 右） */
  const addColumn = useCallback(
    (tableIndex: number, afterCol: number, position: "left" | "right") => {
      const next = structuredClone(tables);
      const t = next[tableIndex];
      const insertAt = position === "left" ? afterCol : afterCol + 1;
      t.headers.splice(insertAt, 0, "");
      t.alignments.splice(insertAt, 0, "none");
      for (const row of t.rows) {
        row.splice(insertAt, 0, "");
      }
      push(next);
    },
    [tables, push]
  );

  /** 列を削除する */
  const deleteColumn = useCallback(
    (tableIndex: number, col: number) => {
      const next = structuredClone(tables);
      const t = next[tableIndex];
      if (t.headers.length <= 1) return; // 最低1列は残す
      t.headers.splice(col, 1);
      t.alignments.splice(col, 1);
      for (const row of t.rows) {
        row.splice(col, 1);
      }
      push(next);
    },
    [tables, push]
  );

  return {
    tables,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  };
}

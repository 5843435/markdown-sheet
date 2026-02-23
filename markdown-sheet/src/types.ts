/** Markdown テーブル1つ分のデータ */
export interface MarkdownTable {
  heading: string | null;
  headers: string[];
  alignments: string[];
  rows: string[][];
  start_line: number;
  end_line: number;
}

/** Markdown ドキュメント全体のパース結果 */
export interface ParsedDocument {
  lines: string[];
  tables: MarkdownTable[];
}

/** ファイルツリーのエントリ */
export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileEntry[] | null;
}

/** セルの位置 */
export interface CellPosition {
  tableIndex: number;
  row: number; // -1 = ヘッダー
  col: number;
}

/** コンテキストメニューの位置と状態 */
export interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  tableIndex: number;
  row: number;
  col: number;
}

/** Undo/Redo 用のスナップショット */
export type TablesSnapshot = MarkdownTable[];

/** 最近開いたファイルのエントリ */
export interface RecentFile {
  path: string;
  name: string;
  ts: number;
}

/** AI API 設定 */
export interface AiSettings {
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  apiFormat: "openai" | "anthropic";
}

/** エディタタブ1つ分の保存状態 */
export interface Tab {
  id: string;
  filePath: string | null;
  content: string;
  originalLines: string[];
  tables: MarkdownTable[];
  dirty: boolean;
  contentUndoStack: string[];
  contentRedoStack: string[];
}

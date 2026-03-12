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
  apiFormat: "openai" | "anthropic" | "azure";
}

/** エディタタブ1つ分の保存状態 */
export interface Tab {
  id: string;
  filePath: string | null;
  content: string;
  dirty: boolean;
  contentUndoStack: string[];
  contentRedoStack: string[];
}

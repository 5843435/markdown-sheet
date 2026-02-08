import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import FileTree from "./components/FileTree";
import SearchReplace from "./components/SearchReplace";
import TableEditor from "./components/TableEditor";
import Toolbar from "./components/Toolbar";
import { useTableEditor } from "./hooks/useTableEditor";
import { parseMarkdown, rebuildDocument } from "./lib/markdownParser";
import type { FileEntry, MarkdownTable, ParsedDocument } from "./types";

function App() {
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [originalLines, setOriginalLines] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const {
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
  } = useTableEditor([]);

  // ファイル読み込み（Tauri コマンド or フロントエンド直接パース）
  const loadFile = useCallback(
    async (filePath: string) => {
      try {
        const doc: ParsedDocument = await invoke("read_markdown_file", {
          filePath,
        });
        setOriginalLines(doc.lines);
        reset(doc.tables);
        setActiveFile(filePath);
        setDirty(false);
      } catch {
        // Tauri が使えない場合、フロントエンドでパースを試みる
        try {
          const { readTextFile } = await import("@tauri-apps/plugin-fs");
          const content = await readTextFile(filePath);
          const doc = parseMarkdown(content);
          setOriginalLines(doc.lines);
          reset(doc.tables);
          setActiveFile(filePath);
          setDirty(false);
        } catch (e) {
          console.error("ファイル読み込みエラー:", e);
        }
      }
    },
    [reset]
  );

  // フォルダを開く
  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (!selected) return;
    try {
      const entries: FileEntry[] = await invoke("get_file_tree", {
        dirPath: selected,
      });
      setFileTree(entries);
    } catch (e) {
      console.error("フォルダ読み込みエラー:", e);
    }
  }, []);

  // ファイルを開く
  const handleOpenFile = useCallback(async () => {
    const selected = await open({
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!selected) return;
    await loadFile(selected);
  }, [loadFile]);

  // 上書き保存
  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      await invoke("save_markdown_file", {
        filePath: activeFile,
        originalLines,
        tables,
      });
      setDirty(false);
    } catch {
      // フロントエンド版
      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        const content = rebuildDocument(originalLines, tables);
        await writeTextFile(activeFile, content);
        setDirty(false);
      } catch (e) {
        console.error("保存エラー:", e);
      }
    }
  }, [activeFile, originalLines, tables]);

  // 別名で保存
  const handleSaveAs = useCallback(async () => {
    const selected = await save({
      filters: [{ name: "Markdown", extensions: ["md"] }],
    });
    if (!selected) return;
    try {
      await invoke("save_markdown_file", {
        filePath: selected,
        originalLines,
        tables,
      });
      setActiveFile(selected);
      setDirty(false);
    } catch (e) {
      console.error("保存エラー:", e);
    }
  }, [originalLines, tables]);

  // テーブル変更を dirty に反映
  const handleUpdateCell = useCallback(
    (tableIndex: number, row: number, col: number, value: string) => {
      updateCell(tableIndex, row, col, value);
      setDirty(true);
    },
    [updateCell]
  );

  const handleAddRow = useCallback(
    (tableIndex: number, afterRow: number, position: "above" | "below") => {
      addRow(tableIndex, afterRow, position);
      setDirty(true);
    },
    [addRow]
  );

  const handleDeleteRow = useCallback(
    (tableIndex: number, row: number) => {
      deleteRow(tableIndex, row);
      setDirty(true);
    },
    [deleteRow]
  );

  const handleAddColumn = useCallback(
    (tableIndex: number, afterCol: number, position: "left" | "right") => {
      addColumn(tableIndex, afterCol, position);
      setDirty(true);
    },
    [addColumn]
  );

  const handleDeleteColumn = useCallback(
    (tableIndex: number, col: number) => {
      deleteColumn(tableIndex, col);
      setDirty(true);
    },
    [deleteColumn]
  );

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      } else if (e.ctrlKey && (e.key === "f" || e.key === "h")) {
        e.preventDefault();
        setShowSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, undo, redo]);

  // ファイル名を抽出
  const fileName = activeFile
    ? activeFile.split(/[\\/]/).pop() ?? null
    : null;

  return (
    <div className="app">
      <Toolbar
        fileName={fileName}
        dirty={dirty}
        canUndo={canUndo}
        canRedo={canRedo}
        onOpenFolder={handleOpenFolder}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onUndo={undo}
        onRedo={redo}
        onToggleSearch={() => setShowSearch((s) => !s)}
      />
      {showSearch && (
        <SearchReplace
          tables={tables}
          onReplace={handleUpdateCell}
          onClose={() => setShowSearch(false)}
        />
      )}
      <div className="app-body">
        <FileTree
          entries={fileTree}
          activeFile={activeFile}
          onSelectFile={loadFile}
        />
        <TableEditor
          tables={tables}
          onUpdateCell={handleUpdateCell}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
          onAddColumn={handleAddColumn}
          onDeleteColumn={handleDeleteColumn}
        />
      </div>
    </div>
  );
}

export default App;

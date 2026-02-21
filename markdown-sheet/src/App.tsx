import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import FileTree from "./components/FileTree";
import MarkdownPreview from "./components/MarkdownPreview";
import SearchReplace from "./components/SearchReplace";
import TableEditor from "./components/TableEditor";
import Toolbar from "./components/Toolbar";
import { useTableEditor } from "./hooks/useTableEditor";
import { parseMarkdown, rebuildDocument } from "./lib/markdownParser";
import type { FileEntry, MarkdownTable, ParsedDocument } from "./types";

// @ts-ignore
import html2pdf from "html2pdf.js";

type ViewTab = "preview" | "table";
type Theme = "light" | "dark";

function App() {
  // --- Theme ---
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("md-theme") as Theme) || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("md-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  // --- File state ---
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState(""); // raw markdown
  const [originalLines, setOriginalLines] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>("preview");
  const [editorVisible, setEditorVisible] = useState(true);

  // --- Toast ---
  const [toast, setToast] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const showToast = (message: string, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  };

  // --- Table editor ---
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

  // --- Editor pane ---
  const [editorRatio, setEditorRatio] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Scroll sync ---
  const [syncScroll, setSyncScroll] = useState(
    () => localStorage.getItem("md-sync-scroll") !== "false"
  );
  const isSyncingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("md-sync-scroll", String(syncScroll));
  }, [syncScroll]);

  useEffect(() => {
    if (!syncScroll || !editorVisible || activeViewTab !== "preview") return;
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const syncFromEditor = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const ratio = editor.scrollTop / Math.max(editor.scrollHeight - editor.clientHeight, 1);
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    const syncFromPreview = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const ratio = preview.scrollTop / Math.max(preview.scrollHeight - preview.clientHeight, 1);
      editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    editor.addEventListener("scroll", syncFromEditor, { passive: true });
    preview.addEventListener("scroll", syncFromPreview, { passive: true });
    return () => {
      editor.removeEventListener("scroll", syncFromEditor);
      preview.removeEventListener("scroll", syncFromPreview);
    };
  }, [syncScroll, editorVisible, activeViewTab]);

  // --- File loading ---
  const loadFile = useCallback(
    async (filePath: string) => {
      try {
        const doc: ParsedDocument = await invoke("read_markdown_file", {
          filePath,
        });
        setOriginalLines(doc.lines);
        reset(doc.tables);
        setActiveFile(filePath);
        setContent(doc.lines.join("\n"));
        setDirty(false);
      } catch {
        try {
          const text = await readTextFile(filePath);
          const doc = parseMarkdown(text);
          setOriginalLines(doc.lines);
          reset(doc.tables);
          setActiveFile(filePath);
          setContent(text);
          setDirty(false);
        } catch (e) {
          console.error("ファイル読み込みエラー:", e);
          showToast("ファイル読み込みに失敗しました", true);
        }
      }
    },
    [reset]
  );

  // --- Folder open ---
  const handleOpenFolder = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await open({ directory: true });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast("フォルダ選択ダイアログを開けませんでした", true);
      return;
    }
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

  // --- File open ---
  const handleOpenFile = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await open({
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          { name: "All", extensions: ["*"] },
        ],
      });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast("ファイル選択ダイアログを開けませんでした", true);
      return;
    }
    if (!selected) return;
    await loadFile(selected);
  }, [loadFile]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      // テーブル編集タブの場合はテーブルデータから保存
      if (activeViewTab === "table") {
        await invoke("save_markdown_file", {
          filePath: activeFile,
          originalLines,
          tables,
        });
      } else {
        // プレビュータブの場合はエディタの内容から保存
        await writeTextFile(activeFile, content);
      }
      setDirty(false);
      showToast("保存しました");
    } catch {
      try {
        const text =
          activeViewTab === "table"
            ? rebuildDocument(originalLines, tables)
            : content;
        await writeTextFile(activeFile, text);
        setDirty(false);
        showToast("保存しました");
      } catch (e) {
        console.error("保存エラー:", e);
        showToast("保存に失敗しました", true);
      }
    }
  }, [activeFile, activeViewTab, originalLines, tables, content]);

  // --- Save As ---
  const handleSaveAs = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast("保存ダイアログを開けませんでした", true);
      return;
    }
    if (!selected) return;
    try {
      const text =
        activeViewTab === "table"
          ? rebuildDocument(originalLines, tables)
          : content;
      await writeTextFile(selected, text);
      setActiveFile(selected);
      setDirty(false);
      showToast("保存しました");
    } catch (e) {
      console.error("保存エラー:", e);
      showToast("保存に失敗しました", true);
    }
  }, [activeViewTab, originalLines, tables, content]);

  // --- Editor content change ---
  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setDirty(true);
      // テーブルデータも再パース
      const doc = parseMarkdown(newContent);
      setOriginalLines(doc.lines);
      reset(doc.tables);
    },
    [reset]
  );

  // --- Table cell operations (mark dirty) ---
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

  // --- テーブル変更をエディタに反映 ---
  useEffect(() => {
    if (activeViewTab === "table" && dirty && originalLines.length > 0) {
      const rebuilt = rebuildDocument(originalLines, tables);
      setContent(rebuilt);
    }
  }, [tables, activeViewTab]);

  // --- タブ切替時にデータ同期 ---
  const handleViewTabChange = useCallback(
    (tab: ViewTab) => {
      if (tab === "table" && activeViewTab === "preview") {
        // プレビュー → テーブル: エディタの内容からテーブル再パース
        const doc = parseMarkdown(content);
        setOriginalLines(doc.lines);
        reset(doc.tables);
      }
      setActiveViewTab(tab);
    },
    [activeViewTab, content, reset]
  );

  // --- Export PDF ---
  const handleExportPdf = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const fileName = activeFile
        ? activeFile.split(/[\\/]/).pop()?.replace(/\.md$/i, "") || "document"
        : "document";
      const opt = {
        margin: 10,
        filename: `${fileName}.pdf`,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      };
      html2pdf().set(opt).from(el).save();
      showToast("PDF出力中...");
    } catch (error) {
      console.error("PDF export error:", error);
      showToast("PDF出力に失敗しました", true);
    }
  }, [activeFile]);

  // --- Export HTML ---
  const handleExportHtml = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const htmlContent = el.innerHTML;
      const title = activeFile
        ? activeFile.split(/[\\/]/).pop() || "document"
        : "document";
      const exportContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
      body { font-family: "Segoe UI", "Meiryo", sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
      pre { background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
      code { font-family: "Consolas", monospace; font-size: 85%; background-color: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; }
      pre code { background: none; padding: 0; }
      blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; padding-left: 1em; margin-left: 0; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
      th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
      th { background-color: #f6f8fa; }
      tr:nth-child(2n) { background-color: #f6f8fa; }
      img { max-width: 100%; }
      h1 { border-bottom: 2px solid #e9d5ff; padding-bottom: 0.3em; color: #9333ea; }
      h2 { border-bottom: 1px solid #e9d5ff; padding-bottom: 0.3em; color: #a855f7; }
    </style>
</head>
<body>${htmlContent}</body>
</html>`;

      const path = await save({
        filters: [{ name: "HTML", extensions: ["html", "htm"] }],
        defaultPath: `${title.replace(/\.md$/i, "")}.html`,
      });
      if (path) {
        await writeTextFile(path, exportContent);
        showToast("HTMLをエクスポートしました");
      }
    } catch (error) {
      console.error("HTML export error:", error);
      showToast("HTMLエクスポートに失敗しました", true);
    }
  }, [activeFile]);

  // --- Insert Formatting ---
  const handleInsertFormatting = useCallback((format: string) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const before = content.substring(0, start);
    const after = content.substring(end);

    let newContent = content;
    let newSelStart = start;
    let newSelEnd = end;

    const wrapInline = (marker: string) => {
      const text = selected || "テキスト";
      newContent = `${before}${marker}${text}${marker}${after}`;
      newSelStart = start + marker.length;
      newSelEnd = newSelStart + text.length;
    };

    const prefixLines = (prefix: string) => {
      if (selected) {
        const lines = selected.split("\n").map((l) => `${prefix}${l}`).join("\n");
        newContent = `${before}${lines}${after}`;
        newSelStart = start;
        newSelEnd = start + lines.length;
      } else {
        const lineStart = before.lastIndexOf("\n") + 1;
        newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
        newSelStart = start + prefix.length;
        newSelEnd = newSelStart;
      }
    };

    switch (format) {
      case "bold":   wrapInline("**"); break;
      case "italic": wrapInline("*");  break;
      case "strike": wrapInline("~~"); break;
      case "code": {
        if (selected.includes("\n")) {
          newContent = `${before}\`\`\`\n${selected}\n\`\`\`${after}`;
          newSelStart = start + 4;
          newSelEnd = newSelStart + selected.length;
        } else {
          wrapInline("`");
        }
        break;
      }
      case "h1":    prefixLines("# ");   break;
      case "h2":    prefixLines("## ");  break;
      case "h3":    prefixLines("### "); break;
      case "ul":    prefixLines("- ");   break;
      case "ol":    prefixLines("1. ");  break;
      case "quote": prefixLines("> ");   break;
      case "link": {
        const text = selected || "リンクテキスト";
        newContent = `${before}[${text}](url)${after}`;
        newSelStart = start + 1;
        newSelEnd = newSelStart + text.length;
        break;
      }
      case "hr": {
        const nl = before.endsWith("\n") || before === "" ? "" : "\n";
        newContent = `${before}${nl}---\n${after}`;
        newSelStart = start + nl.length + 4;
        newSelEnd = newSelStart;
        break;
      }
      default: return;
    }

    handleContentChange(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newSelStart, newSelEnd);
    }, 0);
  }, [content, handleContentChange]);

  // --- Copy rich text ---
  const handleCopyRichText = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const styledHtml = `<div style="font-family: 'Segoe UI', 'Meiryo', sans-serif; font-size: 14px; line-height: 1.8;">${el.innerHTML}</div>`;
      const htmlBlob = new Blob([styledHtml], { type: "text/html" });
      const textBlob = new Blob([el.innerText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      showToast("書式付きでコピーしました (PPT/Excelに貼り付け可能)");
    } catch (error) {
      console.error("Rich text copy error:", error);
      showToast("書式付きコピーに失敗しました", true);
    }
  }, []);

  // --- Keyboard shortcuts ---
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
      } else if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        handleCopyRichText();
      } else if (e.ctrlKey && e.key === "b" && activeViewTab === "preview") {
        e.preventDefault();
        handleInsertFormatting("bold");
      } else if (e.ctrlKey && e.key === "i" && activeViewTab === "preview") {
        e.preventDefault();
        handleInsertFormatting("italic");
      } else if (e.ctrlKey && e.key === "\\") {
        e.preventDefault();
        setEditorVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, undo, redo, handleCopyRichText, handleInsertFormatting, activeViewTab]);

  // --- Divider drag ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const startX = e.clientX;
      const containerRect = container.getBoundingClientRect();
      const startRatio = editorRatio;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const newRatio =
          startRatio + (deltaX / containerRect.width) * 100;
        setEditorRatio(Math.max(15, Math.min(75, newRatio)));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [editorRatio]
  );

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
        theme={theme}
        activeViewTab={activeViewTab}
        editorVisible={editorVisible}
        onOpenFolder={handleOpenFolder}
        onOpenFile={handleOpenFile}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onUndo={undo}
        onRedo={redo}
        onToggleSearch={() => setShowSearch((s) => !s)}
        onToggleTheme={toggleTheme}
        onExportPdf={handleExportPdf}
        onExportHtml={handleExportHtml}
        onCopyRichText={handleCopyRichText}
        onToggleEditor={() => setEditorVisible((v) => !v)}
      />

      {showSearch && (
        activeViewTab === "table" ? (
          <SearchReplace
            tables={tables}
            onReplace={handleUpdateCell}
            onClose={() => setShowSearch(false)}
          />
        ) : (
          <SearchReplace
            textContent={content}
            onTextReplace={handleContentChange}
            onClose={() => setShowSearch(false)}
          />
        )
      )}

      {/* View Tabs */}
      <div className="view-tabs">
        <button
          className={`view-tab ${activeViewTab === "preview" ? "active" : ""}`}
          onClick={() => handleViewTabChange("preview")}
        >
          プレビュー
        </button>
        <button
          className={`view-tab ${activeViewTab === "table" ? "active" : ""}`}
          onClick={() => handleViewTabChange("table")}
        >
          テーブル編集
        </button>
      </div>

      <div className="app-body">
        <FileTree
          entries={fileTree}
          activeFile={activeFile}
          onSelectFile={loadFile}
        />

        {activeViewTab === "preview" ? (
          /* Preview mode: Editor + Preview */
          <div
            className="content-area"
            style={{ display: "flex", flexDirection: "row" }}
            ref={containerRef}
          >
            {editorVisible && (
              <>
                <div
                  className="editor-panel"
                  style={{ flex: `0 0 ${editorRatio}%` }}
                >
                  <div className="editor-panel-header">
                    <span>Markdown ソース</span>
                    <button
                      className={`sync-scroll-btn ${syncScroll ? "active" : ""}`}
                      onClick={() => setSyncScroll((v) => !v)}
                      title={syncScroll ? "スクロール同期: ON (クリックでOFF)" : "スクロール同期: OFF (クリックでON)"}
                    >
                      ⇅ 同期
                    </button>
                  </div>
                  <div className="format-bar">
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("bold"); }} title="太字 (Ctrl+B)"><b>B</b></button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("italic"); }} title="斜体 (Ctrl+I)"><i>I</i></button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("strike"); }} title="取り消し線"><s>S</s></button>
                    <span className="format-separator" />
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h1"); }} title="見出し1">H1</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h2"); }} title="見出し2">H2</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h3"); }} title="見出し3">H3</button>
                    <span className="format-separator" />
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("ul"); }} title="箇条書きリスト">• リスト</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("ol"); }} title="番号付きリスト">1. リスト</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("quote"); }} title="引用">&gt; 引用</button>
                    <span className="format-separator" />
                    <button className="format-btn format-btn-mono" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("code"); }} title="コード">`code`</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("link"); }} title="リンク">&#128279; リンク</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("hr"); }} title="水平線">&#8212; 区切り</button>
                  </div>
                  <textarea
                    ref={editorRef}
                    className="editor-textarea"
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Markdownを入力するか、ファイルを開いてください..."
                  />
                </div>
                <div className="divider" onMouseDown={handleMouseDown} />
              </>
            )}
            <MarkdownPreview content={content} previewRef={previewRef} />
          </div>
        ) : (
          /* Table edit mode */
          <TableEditor
            tables={tables}
            onUpdateCell={handleUpdateCell}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            onAddColumn={handleAddColumn}
            onDeleteColumn={handleDeleteColumn}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`toast ${toast.isError ? "toast-error" : "toast-success"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;

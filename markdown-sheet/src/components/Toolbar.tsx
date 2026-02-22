import { type FC, useEffect, useRef, useState } from "react";
import type { RecentFile } from "../types";
import "./Toolbar.css";

interface Props {
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  theme: "light" | "dark";
  activeViewTab: "preview" | "table";
  editorVisible: boolean;
  recentFiles: RecentFile[];
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onOpenRecent: (path: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onToggleTheme: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onCopyRichText: () => void;
  onPasteFromClipboard: () => void;
  onToggleEditor: () => void;
}

const Toolbar: FC<Props> = ({
  dirty,
  canUndo,
  canRedo,
  theme,
  activeViewTab,
  editorVisible,
  recentFiles,
  onOpenFolder,
  onOpenFile,
  onOpenRecent,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  onToggleSearch,
  onToggleTheme,
  onExportPdf,
  onExportHtml,
  onCopyRichText,
  onPasteFromClipboard,
  onToggleEditor,
}) => {
  const [showRecent, setShowRecent] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!showRecent) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRecent]);

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        {/* ===== 入力グループ ===== */}
        <span className="toolbar-group-label">入力</span>
        <button onClick={onOpenFolder} title="フォルダを開く">
          <span className="icon">&#128193;</span> フォルダ
        </button>
        <button onClick={onOpenFile} title="ファイルを開く">
          <span className="icon">&#128196;</span> 開く
        </button>
        {/* 履歴ドロップダウン */}
        <div className="toolbar-dropdown-wrap" ref={dropdownRef}>
          <button
            onClick={() => setShowRecent((v) => !v)}
            title="最近開いたファイル"
            className={showRecent ? "active-dropdown" : ""}
          >
            &#128221; 履歴
          </button>
          {showRecent && (
            <div className="toolbar-dropdown">
              {recentFiles.length === 0 ? (
                <div className="dropdown-empty">履歴なし</div>
              ) : (
                recentFiles.map((f) => (
                  <div
                    key={f.path}
                    className="dropdown-item"
                    title={f.path}
                    onClick={() => {
                      onOpenRecent(f.path);
                      setShowRecent(false);
                    }}
                  >
                    {f.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <button onClick={onPasteFromClipboard} title="クリップボードのテキストを貼り付け">
          <span className="icon">&#128203;</span> クリップボード
        </button>

        <div className="toolbar-separator" />

        {/* ===== 保存グループ ===== */}
        <span className="toolbar-group-label">保存</span>
        <button onClick={onSave} title="上書き保存 (Ctrl+S)" disabled={!dirty}>
          <span className="icon">&#128190;</span> 保存
        </button>
        <button onClick={onSaveAs} title="別名で保存">
          名前を付けて保存
        </button>

        <div className="toolbar-separator" />

        {/* ===== 編集グループ ===== */}
        <span className="toolbar-group-label">編集</span>
        <button onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
          &#8630; 戻す
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="やり直す (Ctrl+Y)">
          &#8631; やり直す
        </button>
        <button onClick={onToggleSearch} title="検索・置換 (Ctrl+F)">
          &#128269; 検索
        </button>

        {activeViewTab === "preview" && (
          <>
            <div className="toolbar-separator" />

            {/* ===== 表示グループ ===== */}
            <span className="toolbar-group-label">表示</span>
            <button
              onClick={onToggleEditor}
              title={`エディタを${editorVisible ? "非表示" : "表示"} (Ctrl+\\)`}
            >
              {editorVisible ? "◀ エディタ" : "▶ エディタ"}
            </button>

            <div className="toolbar-separator" />

            {/* ===== 出力グループ ===== */}
            <span className="toolbar-group-label">出力</span>
            <button onClick={onCopyRichText} title="書式付きでコピー (PPT/Excel向け)">
              書式コピー
            </button>
            <button onClick={onExportPdf} title="PDFとしてエクスポート">
              PDF
            </button>
            <button onClick={onExportHtml} title="HTMLとしてエクスポート">
              HTML
            </button>
          </>
        )}
      </div>
      <div className="toolbar-right">
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={`${theme === "light" ? "ダーク" : "ライト"}テーマに切替`}
        >
          {theme === "light" ? "\u263E" : "\u2600"}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;

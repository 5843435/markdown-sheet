import { type FC } from "react";
import "./Toolbar.css";

interface Props {
  fileName: string | null;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  theme: "light" | "dark";
  activeViewTab: "preview" | "table";
  editorVisible: boolean;
  onOpenFolder: () => void;
  onOpenFile: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSearch: () => void;
  onToggleTheme: () => void;
  onExportPdf: () => void;
  onExportHtml: () => void;
  onCopyRichText: () => void;
  onToggleEditor: () => void;
}

const Toolbar: FC<Props> = ({
  fileName,
  dirty,
  canUndo,
  canRedo,
  theme,
  activeViewTab,
  editorVisible,
  onOpenFolder,
  onOpenFile,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  onToggleSearch,
  onToggleTheme,
  onExportPdf,
  onExportHtml,
  onCopyRichText,
  onToggleEditor,
}) => {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button onClick={onOpenFolder} title="フォルダを開く">
          <span className="icon">&#128193;</span> フォルダ
        </button>
        <button onClick={onOpenFile} title="ファイルを開く">
          <span className="icon">&#128196;</span> 開く
        </button>
        <button onClick={onSave} title="上書き保存 (Ctrl+S)">
          <span className="icon">&#128190;</span> 保存
        </button>
        <button onClick={onSaveAs} title="別名で保存">
          名前を付けて保存
        </button>
        <div className="toolbar-separator" />
        <button onClick={onUndo} disabled={!canUndo} title="元に戻す (Ctrl+Z)">
          &#8630; 戻す
        </button>
        <button onClick={onRedo} disabled={!canRedo} title="やり直す (Ctrl+Y)">
          &#8631; やり直す
        </button>
        <div className="toolbar-separator" />
        <button onClick={onToggleSearch} title="検索・置換 (Ctrl+F)">
          &#128269; 検索
        </button>
        {activeViewTab === "preview" && (
          <>
            <div className="toolbar-separator" />
            <button
              onClick={onToggleEditor}
              title={`エディタを${editorVisible ? "非表示" : "表示"} (Ctrl+\\)`}
            >
              {editorVisible ? "◀ エディタ" : "▶ エディタ"}
            </button>
            <div className="toolbar-separator" />
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
        <span className="file-name">
          {fileName ? `${fileName}${dirty ? " *" : ""}` : "ファイル未選択"}
        </span>
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

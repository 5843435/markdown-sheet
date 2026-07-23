import { type FC, useEffect, useRef, useState } from "react";
import type { RecentFile } from "../types";
import { useT } from "../i18n";
import "./Toolbar.css";

interface Props {
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  theme: "light" | "dark";
  editorVisible: boolean;
  leftPanelVisible: boolean;
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
  onExportWord: () => void;
  onCopyRichText: () => void;
  onPasteFromClipboard: () => void;
  onToggleEditor: () => void;
  onToggleLeftPanel: () => void;
  isPreviewOnly: boolean;
  onTogglePreviewOnly: () => void;
  onOpenSettings: () => void;
}

const Toolbar: FC<Props> = ({
  dirty,
  canUndo,
  canRedo,
  theme,
  editorVisible,
  leftPanelVisible,
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
  onExportWord,
  onCopyRichText,
  onPasteFromClipboard,
  onToggleEditor,
  onToggleLeftPanel,
  isPreviewOnly,
  onTogglePreviewOnly,
  onOpenSettings,
}) => {
  const t = useT();
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
        {/* ===== Input group ===== */}
        <span className="toolbar-group-label">{t("toolbar.group.input")}</span>
        <button onClick={onOpenFolder} title={t("toolbar.openFolder")}>
          <span className="icon">&#128193;</span> {t("toolbar.folder")}
        </button>
        <button onClick={onOpenFile} title={t("toolbar.openFile")}>
          <span className="icon">&#128196;</span> {t("toolbar.open")}
        </button>
        {/* Recent files dropdown */}
        <div className="toolbar-dropdown-wrap" ref={dropdownRef}>
          <button
            onClick={() => setShowRecent((v) => !v)}
            title={t("toolbar.recent")}
            className={showRecent ? "active-dropdown" : ""}
          >
            &#128221; {t("toolbar.recentLabel")}
          </button>
          {showRecent && (
            <div className="toolbar-dropdown">
              {recentFiles.length === 0 ? (
                <div className="dropdown-empty">{t("toolbar.recentEmpty")}</div>
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
        <button onClick={onPasteFromClipboard} title={t("toolbar.pasteClipboard")}>
          <span className="icon">&#128203;</span> {t("toolbar.clipboard")}
        </button>

        <div className="toolbar-separator" />

        {/* ===== Save group ===== */}
        <span className="toolbar-group-label">{t("toolbar.group.save")}</span>
        <button onClick={onSave} title={t("toolbar.saveTitle")} disabled={!dirty}>
          <span className="icon">&#128190;</span> {t("toolbar.save")}
        </button>
        <button onClick={onSaveAs} title={t("toolbar.saveAsTitle")}>
          {t("toolbar.saveAs")}
        </button>

        <div className="toolbar-separator" />

        {/* ===== Edit group ===== */}
        <span className="toolbar-group-label">{t("toolbar.group.edit")}</span>
        <button onClick={onUndo} disabled={!canUndo} title={t("toolbar.undoTitle")}>
          &#8630; {t("toolbar.undo")}
        </button>
        <button onClick={onRedo} disabled={!canRedo} title={t("toolbar.redoTitle")}>
          &#8631; {t("toolbar.redo")}
        </button>
        <button onClick={onToggleSearch} title={t("toolbar.searchTitle")}>
          &#128269; {t("toolbar.search")}
        </button>

        <div className="toolbar-separator" />

        {/* ===== View group ===== */}
        <span className="toolbar-group-label">{t("toolbar.group.view")}</span>
        <button
          onClick={onToggleLeftPanel}
          title={leftPanelVisible ? t("toolbar.panelHide") : t("toolbar.panelShow")}
        >
          {leftPanelVisible ? t("toolbar.panelOn") : t("toolbar.panelOff")}
        </button>
        <button
          onClick={onToggleEditor}
          title={editorVisible ? t("toolbar.editorHideTitle") : t("toolbar.editorShowTitle")}
        >
          {editorVisible ? t("toolbar.editorOn") : t("toolbar.editorOff")}
        </button>
        <button
          onClick={onTogglePreviewOnly}
          className={isPreviewOnly ? "active-dropdown" : ""}
          title={t("toolbar.fullPreviewTitle")}
        >
          {t("toolbar.fullPreview")}
        </button>

        <div className="toolbar-separator" />

        {/* ===== Output group ===== */}
        <span className="toolbar-group-label">{t("toolbar.group.output")}</span>
        <button onClick={onCopyRichText} title={t("toolbar.richCopyTitle")}>
          {t("toolbar.richCopy")}
        </button>
        <button onClick={onExportPdf} title={t("toolbar.pdfTitle")}>
          PDF
        </button>
        <button onClick={onExportHtml} title={t("toolbar.htmlTitle")}>
          HTML
        </button>
        <button onClick={onExportWord} title={t("toolbar.wordTitle")}>
          Word
        </button>
      </div>
      <div className="toolbar-right">
        <button
          className="settings-btn"
          onClick={onOpenSettings}
          title={t("toolbar.settingsTitle")}
        >
          ⚙
        </button>
        <button
          className="theme-toggle"
          onClick={onToggleTheme}
          title={theme === "light" ? t("toolbar.themeToDark") : t("toolbar.themeToLight")}
        >
          {theme === "light" ? "\u263E" : "\u2600"}
        </button>
      </div>
    </div>
  );
};

export default Toolbar;

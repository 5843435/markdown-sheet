import { useState } from "react";
import MarkdownPreview from "./MarkdownPreview";
import OfficePreview from "./OfficePreview";
import Terminal from "./Terminal";
import type { AiSettings } from "../types";
import { docxToMarkdown } from "../lib/docxToMarkdown";
import "./PreviewPanel.css";

interface Props {
  content: string;
  filePath?: string | null;
  folderPath?: string | null;
  previewRef?: React.RefObject<HTMLDivElement | null>;
  aiSettings?: AiSettings;
  onUpdateMermaidBlock?: (blockIndex: number, newSource: string) => void;
  theme: "light" | "dark";
  officeFileData?: Uint8Array | null;
  officeFileType?: string | null;
  onOpenFile?: (path: string) => void;
  onRefreshFileTree?: () => void;
}

export default function PreviewPanel({
  content,
  filePath,
  folderPath,
  previewRef,
  aiSettings,
  onUpdateMermaidBlock,
  theme,
  officeFileData,
  officeFileType,
  onOpenFile,
  onRefreshFileTree,
}: Props) {
  const [activeTab, setActiveTab] = useState<"preview" | "terminal">("preview");
  const [converting, setConverting] = useState(false);

  // Extract directory from filePath for terminal cwd, fall back to open folder path
  const cwd = filePath
    ? filePath.replace(/[\\/][^\\/]*$/, "")
    : folderPath ?? "C:\\";

  const isOffice = officeFileData && officeFileType;
  const isDocx = filePath?.toLowerCase().endsWith(".docx");

  const handleConvertToMarkdown = async () => {
    if (!officeFileData || !filePath) return;
    setConverting(true);
    try {
      const { mdPath } = await docxToMarkdown(officeFileData, filePath);
      onRefreshFileTree?.();
      onOpenFile?.(mdPath);
    } catch (e) {
      alert(`変換に失敗しました: ${e instanceof Error ? e.message : e}`);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="preview-panel-wrapper">
      <div className="preview-panel-tabs">
        <button
          className={`preview-panel-tab${activeTab === "preview" ? " active" : ""}`}
          onClick={() => setActiveTab("preview")}
        >
          プレビュー
        </button>
        <button
          className={`preview-panel-tab${activeTab === "terminal" ? " active" : ""}`}
          onClick={() => setActiveTab("terminal")}
        >
          ターミナル
        </button>
      </div>
      {isOffice && isDocx && activeTab === "preview" && (
        <div className="preview-convert-bar">
          <button
            onClick={handleConvertToMarkdown}
            disabled={converting}
          >
            {converting ? "変換中..." : "Markdownに変換"}
          </button>
        </div>
      )}
      <div className="preview-panel-content">
        <div style={{ display: activeTab === "preview" ? "contents" : "none" }}>
          {isOffice ? (
            <OfficePreview data={officeFileData} fileType={officeFileType} theme={theme} />
          ) : (
            <MarkdownPreview
              content={content}
              filePath={filePath}
              previewRef={previewRef}
              aiSettings={aiSettings}
              onUpdateMermaidBlock={onUpdateMermaidBlock}
            />
          )}
        </div>
        <div style={{
          display: activeTab === "terminal" ? "block" : "none",
          height: "100%",
        }}>
          <Terminal cwd={cwd} visible={activeTab === "terminal"} theme={theme} />
        </div>
      </div>
    </div>
  );
}

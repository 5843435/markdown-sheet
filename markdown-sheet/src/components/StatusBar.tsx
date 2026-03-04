import { type FC } from "react";
import "./StatusBar.css";

interface Props {
  content: string;
  autoSave: boolean;
  onToggleAutoSave: () => void;
  activeFilePath: string | null;
}

const StatusBar: FC<Props> = ({ content, autoSave, onToggleAutoSave, activeFilePath }) => {
  const charCount = content.length;
  const lineCount = content ? content.split("\n").length : 0;

  return (
    <div className="status-bar">
      {activeFilePath && (
        <>
          <span className="status-item status-filepath" title={activeFilePath}>{activeFilePath}</span>
          <span className="status-sep" />
        </>
      )}
      <span className="status-item">文字数: {charCount.toLocaleString()}</span>
      <span className="status-sep" />
      <span className="status-item">行: {lineCount.toLocaleString()}</span>
      <span className="status-spacer" />
      <button
        className={`status-autosave-btn ${autoSave ? "active" : ""}`}
        onClick={onToggleAutoSave}
        title="自動保存のオン/オフを切替 (30秒間隔)"
      >
        自動保存: {autoSave ? "ON" : "OFF"}
      </button>
    </div>
  );
};

export default StatusBar;

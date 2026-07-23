import { type FC } from "react";
import { useT } from "../i18n";
import "./StatusBar.css";

interface Props {
  content: string;
  autoSave: boolean;
  onToggleAutoSave: () => void;
}

const StatusBar: FC<Props> = ({ content, autoSave, onToggleAutoSave }) => {
  const t = useT();
  const charCount = content.length;
  const lineCount = content ? content.split("\n").length : 0;

  return (
    <div className="status-bar">
      <span className="status-item">{t("status.chars", { n: charCount.toLocaleString() })}</span>
      <span className="status-sep" />
      <span className="status-item">{t("status.lines", { n: lineCount.toLocaleString() })}</span>
      <span className="status-spacer" />
      <button
        className={`status-autosave-btn ${autoSave ? "active" : ""}`}
        onClick={onToggleAutoSave}
        title={t("status.autoSaveTitle")}
      >
        {t("status.autoSave", { state: autoSave ? "ON" : "OFF" })}
      </button>
    </div>
  );
};

export default StatusBar;

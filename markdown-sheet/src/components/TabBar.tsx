import { type FC } from "react";
import type { Tab } from "../types";
import "./TabBar.css";

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

const TabBar: FC<Props> = ({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab }) => {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const name = tab.filePath
          ? tab.filePath.split(/[\\/]/).pop() ?? "無題"
          : "無題";
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`tab-item ${isActive ? "active" : ""}`}
            onClick={() => onSelectTab(tab.id)}
            title={tab.filePath ?? "保存されていない新規ファイル"}
          >
            <span className="tab-label">
              {name}
              {tab.dirty ? " *" : ""}
            </span>
            <button
              className="tab-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (tab.dirty) {
                  if (!window.confirm(`"${name}" の変更は保存されていません。閉じますか？`)) return;
                }
                onCloseTab(tab.id);
              }}
              title="タブを閉じる"
              disabled={tabs.length === 1}
            >
              ×
            </button>
          </div>
        );
      })}
      <button className="tab-new-btn" onClick={onNewTab} title="新しいタブ">
        +
      </button>
    </div>
  );
};

export default TabBar;

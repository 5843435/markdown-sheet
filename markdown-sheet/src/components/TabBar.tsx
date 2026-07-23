import { type FC } from "react";
import type { Tab } from "../types";
import { useT } from "../i18n";
import "./TabBar.css";

interface Props {
  tabs: Tab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

const TabBar: FC<Props> = ({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab }) => {
  const t = useT();
  return (
    <div className="tab-bar">
      {tabs.map((tab) => {
        const name = tab.filePath
          ? tab.filePath.split(/[\\/]/).pop() ?? t("tab.untitled")
          : t("tab.untitled");
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`tab-item ${isActive ? "active" : ""}`}
            onClick={() => onSelectTab(tab.id)}
            title={tab.filePath ?? t("tab.unsavedNew")}
          >
            <span className="tab-label">
              {name}
              {tab.dirty ? " *" : ""}
            </span>
            <button
              type="button"
              className="tab-close-btn"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (tab.dirty) {
                  if (!window.confirm(t("confirm.unsavedClose", { name }))) return;
                }
                onCloseTab(tab.id);
              }}
              title={t("tab.close")}
              disabled={tabs.length <= 1}
            >
              ×
            </button>
          </div>
        );
      })}
      <button className="tab-new-btn" onClick={onNewTab} title={t("tab.new")}>
        +
      </button>
    </div>
  );
};

export default TabBar;

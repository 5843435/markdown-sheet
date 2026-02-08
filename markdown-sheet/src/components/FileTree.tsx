import { type FC, useState } from "react";
import type { FileEntry } from "../types";
import "./FileTree.css";

interface Props {
  entries: FileEntry[];
  activeFile: string | null;
  onSelectFile: (path: string) => void;
}

const FileTreeNode: FC<{
  entry: FileEntry;
  activeFile: string | null;
  onSelectFile: (path: string) => void;
  depth: number;
}> = ({ entry, activeFile, onSelectFile, depth }) => {
  const [expanded, setExpanded] = useState(true);

  if (entry.is_dir) {
    return (
      <div className="tree-node">
        <div
          className="tree-item tree-dir"
          style={{ paddingLeft: depth * 16 }}
          onClick={() => setExpanded(!expanded)}
        >
          <span className="tree-icon">{expanded ? "\u25BE" : "\u25B8"}</span>
          <span className="tree-label">{entry.name}</span>
        </div>
        {expanded &&
          entry.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              activeFile={activeFile}
              onSelectFile={onSelectFile}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      className={`tree-item tree-file ${activeFile === entry.path ? "active" : ""}`}
      style={{ paddingLeft: depth * 16 }}
      onClick={() => onSelectFile(entry.path)}
    >
      <span className="tree-icon">{"\u2630"}</span>
      <span className="tree-label">{entry.name}</span>
    </div>
  );
};

const FileTree: FC<Props> = ({ entries, activeFile, onSelectFile }) => {
  if (entries.length === 0) {
    return (
      <div className="file-tree">
        <div className="tree-empty">フォルダを開いてください</div>
      </div>
    );
  }

  return (
    <div className="file-tree">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          activeFile={activeFile}
          onSelectFile={onSelectFile}
          depth={0}
        />
      ))}
    </div>
  );
};

export default FileTree;

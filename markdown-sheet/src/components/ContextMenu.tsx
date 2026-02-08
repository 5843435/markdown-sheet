import { type FC, useEffect, useRef } from "react";
import type { ContextMenuState } from "../types";
import "./ContextMenu.css";

interface Props {
  menu: ContextMenuState;
  onClose: () => void;
  onAddRowAbove: () => void;
  onAddRowBelow: () => void;
  onDeleteRow: () => void;
  onAddColumnLeft: () => void;
  onAddColumnRight: () => void;
  onDeleteColumn: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onBold: () => void;
  onItalic: () => void;
  onStrikethrough: () => void;
  onCode: () => void;
}

const ContextMenu: FC<Props> = ({
  menu,
  onClose,
  onAddRowAbove,
  onAddRowBelow,
  onDeleteRow,
  onAddColumnLeft,
  onAddColumnRight,
  onDeleteColumn,
  onCopy,
  onCut,
  onPaste,
  onBold,
  onItalic,
  onStrikethrough,
  onCode,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!menu.visible) return null;

  return (
    <div
      ref={ref}
      className="context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="ctx-group">
        <button onClick={onCopy}>
          <span className="ctx-label">コピー</span>
          <span className="ctx-shortcut">Ctrl+C</span>
        </button>
        <button onClick={onCut}>
          <span className="ctx-label">カット</span>
          <span className="ctx-shortcut">Ctrl+X</span>
        </button>
        <button onClick={onPaste}>
          <span className="ctx-label">貼り付け</span>
          <span className="ctx-shortcut">Ctrl+V</span>
        </button>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-group">
        <button onClick={onAddRowAbove}>
          <span className="ctx-label">行を上に挿入</span>
        </button>
        <button onClick={onAddRowBelow}>
          <span className="ctx-label">行を下に挿入</span>
        </button>
        <button onClick={onDeleteRow} disabled={menu.row === -1}>
          <span className="ctx-label">行を削除</span>
        </button>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-group">
        <button onClick={onAddColumnLeft}>
          <span className="ctx-label">列を左に挿入</span>
        </button>
        <button onClick={onAddColumnRight}>
          <span className="ctx-label">列を右に挿入</span>
        </button>
        <button onClick={onDeleteColumn}>
          <span className="ctx-label">列を削除</span>
        </button>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-group">
        <button onClick={onBold}>
          <span className="ctx-label">太字</span>
          <span className="ctx-shortcut">Ctrl+B</span>
        </button>
        <button onClick={onItalic}>
          <span className="ctx-label">斜体</span>
          <span className="ctx-shortcut">Ctrl+I</span>
        </button>
        <button onClick={onStrikethrough}>
          <span className="ctx-label">取り消し線</span>
          <span className="ctx-shortcut">Ctrl+5</span>
        </button>
        <button onClick={onCode}>
          <span className="ctx-label">コード</span>
          <span className="ctx-shortcut">Ctrl+`</span>
        </button>
      </div>
    </div>
  );
};

export default ContextMenu;

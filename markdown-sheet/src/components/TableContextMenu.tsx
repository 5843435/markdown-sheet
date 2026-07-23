import { type FC, useEffect, useRef } from "react";
import { useT } from "../i18n";
import "./TableContextMenu.css";

export interface TableContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  tableIndex: number;
  row: number; // -1 = header
  col: number;
}

interface Props {
  menu: TableContextMenuState;
  onClose: () => void;
  onAddRowAbove: () => void;
  onAddRowBelow: () => void;
  onDeleteRow: () => void;
  onAddColumnLeft: () => void;
  onAddColumnRight: () => void;
  onDeleteColumn: () => void;
  onExportCsv: () => void;
}

const TableContextMenu: FC<Props> = ({
  menu,
  onClose,
  onAddRowAbove,
  onAddRowBelow,
  onDeleteRow,
  onAddColumnLeft,
  onAddColumnRight,
  onDeleteColumn,
  onExportCsv,
}) => {
  const t = useT();
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
      className="table-context-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="ctx-group">
        <button onClick={onAddRowAbove}>
          <span className="ctx-label">{t("table.rowAbove")}</span>
        </button>
        <button onClick={onAddRowBelow}>
          <span className="ctx-label">{t("table.rowBelow")}</span>
        </button>
        <button onClick={onDeleteRow} disabled={menu.row === -1}>
          <span className="ctx-label">{t("table.rowDelete")}</span>
        </button>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-group">
        <button onClick={onAddColumnLeft}>
          <span className="ctx-label">{t("table.colLeft")}</span>
        </button>
        <button onClick={onAddColumnRight}>
          <span className="ctx-label">{t("table.colRight")}</span>
        </button>
        <button onClick={onDeleteColumn}>
          <span className="ctx-label">{t("table.colDelete")}</span>
        </button>
      </div>
      <div className="ctx-divider" />
      <div className="ctx-group">
        <button onClick={onExportCsv}>
          <span className="ctx-label">{t("table.csvExport")}</span>
        </button>
      </div>
    </div>
  );
};

export default TableContextMenu;

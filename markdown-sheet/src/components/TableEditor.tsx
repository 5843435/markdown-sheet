import {
  type FC,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CellPosition, ContextMenuState, MarkdownTable } from "../types";
import ContextMenu from "./ContextMenu";
import "./TableEditor.css";

interface Props {
  tables: MarkdownTable[];
  onUpdateCell: (
    tableIndex: number,
    row: number,
    col: number,
    value: string
  ) => void;
  onAddRow: (
    tableIndex: number,
    afterRow: number,
    position: "above" | "below"
  ) => void;
  onDeleteRow: (tableIndex: number, row: number) => void;
  onAddColumn: (
    tableIndex: number,
    afterCol: number,
    position: "left" | "right"
  ) => void;
  onDeleteColumn: (tableIndex: number, col: number) => void;
  onExportCsv?: (tableIndex: number) => void;
}

/** Markdown書式のトグル */
function toggleWrap(text: string, wrapper: string): string {
  if (
    text.startsWith(wrapper) &&
    text.endsWith(wrapper) &&
    text.length >= wrapper.length * 2
  ) {
    return text.slice(wrapper.length, -wrapper.length);
  }
  return `${wrapper}${text}${wrapper}`;
}

/** HTMLエスケープ */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** セル内のMarkdownインライン書式をHTMLに変換 */
function formatCellHtml(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(
    /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g,
    "<em>$1</em>"
  );
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/`(.+?)`/g, '<code class="md-inline-code">$1</code>');
  return html;
}

/** 書式が含まれるか */
function hasFormatting(text: string): boolean {
  return (
    /\*\*.+?\*\*/.test(text) ||
    /(?<!\*)\*(?!\*).+?(?<!\*)\*(?!\*)/.test(text) ||
    /~~.+?~~/.test(text) ||
    /`.+?`/.test(text)
  );
}

type InsertDeleteMode = null | "insert" | "delete";

const TableEditor: FC<Props> = ({
  tables,
  onUpdateCell,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  onExportCsv,
}) => {
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    visible: false,
    tableIndex: 0,
    row: 0,
    col: 0,
  });
  const [insertDeleteMode, setInsertDeleteMode] =
    useState<InsertDeleteMode>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 編集開始
  const startEditing = useCallback(
    (tableIndex: number, row: number, col: number) => {
      const t = tables[tableIndex];
      const value = row === -1 ? t.headers[col] : t.rows[row]?.[col] ?? "";
      setEditingCell({ tableIndex, row, col });
      setEditValue(value);
    },
    [tables]
  );

  // 編集確定
  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    onUpdateCell(
      editingCell.tableIndex,
      editingCell.row,
      editingCell.col,
      editValue
    );
    setEditingCell(null);
  }, [editingCell, editValue, onUpdateCell]);

  // 編集キャンセル
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  // セル移動
  const moveSelection = useCallback(
    (
      tableIndex: number,
      row: number,
      col: number,
      dRow: number,
      dCol: number
    ) => {
      const t = tables[tableIndex];
      let newRow = row + dRow;
      let newCol = col + dCol;

      if (newCol >= t.headers.length) {
        newCol = 0;
        newRow += 1;
      } else if (newCol < 0) {
        newCol = t.headers.length - 1;
        newRow -= 1;
      }

      if (newRow < -1) newRow = -1;
      if (newRow >= t.rows.length) newRow = t.rows.length - 1;

      setSelectedCell({ tableIndex, row: newRow, col: newCol });
    },
    [tables]
  );

  // 書式トグル
  const toggleFormat = useCallback(
    (wrapper: string) => {
      if (editingCell) {
        setEditValue((v) => toggleWrap(v, wrapper));
        return;
      }
      if (!selectedCell) return;
      const t = tables[selectedCell.tableIndex];
      const value =
        selectedCell.row === -1
          ? t.headers[selectedCell.col]
          : t.rows[selectedCell.row]?.[selectedCell.col] ?? "";
      onUpdateCell(
        selectedCell.tableIndex,
        selectedCell.row,
        selectedCell.col,
        toggleWrap(value, wrapper)
      );
    },
    [selectedCell, editingCell, tables, onUpdateCell]
  );

  // セルの値を取得
  const getCellValue = useCallback(
    (tableIndex: number, row: number, col: number) => {
      const t = tables[tableIndex];
      if (!t) return "";
      return row === -1 ? t.headers[col] ?? "" : t.rows[row]?.[col] ?? "";
    },
    [tables]
  );

  // コピー
  const handleCopy = useCallback(() => {
    if (!selectedCell) return;
    const val = getCellValue(
      selectedCell.tableIndex,
      selectedCell.row,
      selectedCell.col
    );
    navigator.clipboard.writeText(val);
  }, [selectedCell, getCellValue]);

  // カット
  const handleCut = useCallback(() => {
    handleCopy();
    if (selectedCell) {
      onUpdateCell(
        selectedCell.tableIndex,
        selectedCell.row,
        selectedCell.col,
        ""
      );
    }
  }, [handleCopy, selectedCell, onUpdateCell]);

  // ペースト
  const handlePaste = useCallback(async () => {
    if (!selectedCell) return;
    try {
      const text = await navigator.clipboard.readText();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length > 1 || lines[0]?.includes("\t")) {
        const t = tables[selectedCell.tableIndex];
        for (let ri = 0; ri < lines.length; ri++) {
          const cells = lines[ri].split("\t");
          for (let ci = 0; ci < cells.length; ci++) {
            const targetRow = selectedCell.row + ri;
            const targetCol = selectedCell.col + ci;
            if (targetCol < t.headers.length) {
              if (targetRow === -1) {
                onUpdateCell(
                  selectedCell.tableIndex,
                  -1,
                  targetCol,
                  cells[ci].trim()
                );
              } else if (targetRow < t.rows.length) {
                onUpdateCell(
                  selectedCell.tableIndex,
                  targetRow,
                  targetCol,
                  cells[ci].trim()
                );
              }
            }
          }
        }
      } else {
        onUpdateCell(
          selectedCell.tableIndex,
          selectedCell.row,
          selectedCell.col,
          text.trim()
        );
      }
    } catch {
      // clipboard アクセス失敗
    }
  }, [selectedCell, tables, onUpdateCell]);

  // Ctrl+D: Fill Down
  const fillDown = useCallback(() => {
    if (!selectedCell || selectedCell.row <= 0) return;
    const aboveValue = getCellValue(
      selectedCell.tableIndex,
      selectedCell.row === 0 ? -1 : selectedCell.row - 1,
      selectedCell.col
    );
    onUpdateCell(
      selectedCell.tableIndex,
      selectedCell.row,
      selectedCell.col,
      aboveValue
    );
  }, [selectedCell, getCellValue, onUpdateCell]);

  // キーボードハンドリング
  const handleCellKeyDown = useCallback(
    (e: KeyboardEvent, tableIndex: number, row: number, col: number) => {
      const t = tables[tableIndex];

      // 編集中のキー処理
      if (editingCell) {
        if (e.key === "Enter") {
          e.preventDefault();
          commitEdit();
          moveSelection(tableIndex, row, col, 1, 0);
        } else if (e.key === "Escape") {
          cancelEdit();
        } else if (e.key === "Tab") {
          e.preventDefault();
          commitEdit();
          moveSelection(tableIndex, row, col, 0, e.shiftKey ? -1 : 1);
        } else if (e.ctrlKey && e.key === "b") {
          e.preventDefault();
          toggleFormat("**");
        } else if (e.ctrlKey && e.key === "i") {
          e.preventDefault();
          toggleFormat("*");
        } else if (e.ctrlKey && e.key === "5") {
          e.preventDefault();
          toggleFormat("~~");
        } else if (e.ctrlKey && e.key === "`") {
          e.preventDefault();
          toggleFormat("`");
        }
        return;
      }

      // Ctrl系ショートカット
      if (e.ctrlKey) {
        switch (e.key) {
          case "c":
            e.preventDefault();
            handleCopy();
            return;
          case "x":
            e.preventDefault();
            handleCut();
            return;
          case "v":
            e.preventDefault();
            handlePaste();
            return;
          case "d":
            e.preventDefault();
            fillDown();
            return;
          case "b":
            e.preventDefault();
            toggleFormat("**");
            return;
          case "i":
            e.preventDefault();
            toggleFormat("*");
            return;
          case "5":
            e.preventDefault();
            toggleFormat("~~");
            return;
          case "`":
            e.preventDefault();
            toggleFormat("`");
            return;
          case "Home":
            e.preventDefault();
            setSelectedCell({ tableIndex, row: -1, col: 0 });
            return;
          case "End":
            e.preventDefault();
            setSelectedCell({
              tableIndex,
              row: t.rows.length - 1,
              col: t.headers.length - 1,
            });
            return;
          case "+":
          case "=":
            if (e.shiftKey) {
              e.preventDefault();
              setInsertDeleteMode("insert");
            }
            return;
          case "-":
            e.preventDefault();
            setInsertDeleteMode("delete");
            return;
        }
        return;
      }

      switch (e.key) {
        case "Enter":
        case "F2":
          e.preventDefault();
          startEditing(tableIndex, row, col);
          break;
        case "Tab":
          e.preventDefault();
          moveSelection(tableIndex, row, col, 0, e.shiftKey ? -1 : 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveSelection(tableIndex, row, col, -1, 0);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveSelection(tableIndex, row, col, 1, 0);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveSelection(tableIndex, row, col, 0, -1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveSelection(tableIndex, row, col, 0, 1);
          break;
        case "Home":
          e.preventDefault();
          setSelectedCell({ tableIndex, row, col: 0 });
          break;
        case "End":
          e.preventDefault();
          setSelectedCell({
            tableIndex,
            row,
            col: t.headers.length - 1,
          });
          break;
        case "Delete":
          e.preventDefault();
          onUpdateCell(tableIndex, row, col, "");
          break;
        case "Backspace":
          e.preventDefault();
          onUpdateCell(tableIndex, row, col, "");
          startEditing(tableIndex, row, col);
          break;
        default:
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setEditingCell({ tableIndex, row, col });
            setEditValue(e.key);
          }
      }
    },
    [
      editingCell,
      tables,
      commitEdit,
      cancelEdit,
      startEditing,
      moveSelection,
      onUpdateCell,
      handleCopy,
      handleCut,
      handlePaste,
      fillDown,
      toggleFormat,
    ]
  );

  // 右クリック
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, tableIndex: number, row: number, col: number) => {
      e.preventDefault();
      setSelectedCell({ tableIndex, row, col });
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        visible: true,
        tableIndex,
        row,
        col,
      });
    },
    []
  );

  const closeContextMenu = useCallback(
    () => setContextMenu((m) => ({ ...m, visible: false })),
    []
  );

  // 挿入/削除ダイアログのアクション
  const handleInsertAction = useCallback(
    (action: string) => {
      if (!selectedCell) return;
      const { tableIndex, row, col } = selectedCell;
      switch (action) {
        case "row-above":
          onAddRow(tableIndex, row === -1 ? 0 : row, "above");
          break;
        case "row-below":
          onAddRow(tableIndex, row === -1 ? 0 : row, "below");
          break;
        case "col-left":
          onAddColumn(tableIndex, col, "left");
          break;
        case "col-right":
          onAddColumn(tableIndex, col, "right");
          break;
        case "delete-row":
          if (row >= 0) onDeleteRow(tableIndex, row);
          break;
        case "delete-col":
          onDeleteColumn(tableIndex, col);
          break;
      }
      setInsertDeleteMode(null);
    },
    [selectedCell, onAddRow, onAddColumn, onDeleteRow, onDeleteColumn]
  );

  // 選択セルにフォーカス
  useEffect(() => {
    if (selectedCell && !editingCell) {
      const cellEl = document.querySelector(
        `[data-cell="${selectedCell.tableIndex}-${selectedCell.row}-${selectedCell.col}"]`
      ) as HTMLElement;
      cellEl?.focus();
    }
  }, [selectedCell, editingCell]);

  // 編集時 input にフォーカス
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editingCell]);

  // 挿入/削除ダイアログ: Escape で閉じる
  useEffect(() => {
    if (!insertDeleteMode) return;
    const handleKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setInsertDeleteMode(null);
    };
    const handleClick = () => setInsertDeleteMode(null);
    window.addEventListener("keydown", handleKey);
    const timer = setTimeout(
      () => window.addEventListener("mousedown", handleClick),
      100
    );
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("mousedown", handleClick);
      clearTimeout(timer);
    };
  }, [insertDeleteMode]);

  if (tables.length === 0) {
    return (
      <div className="table-editor-empty">
        <p>Markdown ファイルを開いてテーブルを編集してください</p>
        <p className="hint">
          テーブルが含まれる .md ファイルを選択するか開きます
        </p>
      </div>
    );
  }

  const isSelected = (ti: number, r: number, c: number) =>
    selectedCell?.tableIndex === ti &&
    selectedCell?.row === r &&
    selectedCell?.col === c;

  const isEditing = (ti: number, r: number, c: number) =>
    editingCell?.tableIndex === ti &&
    editingCell?.row === r &&
    editingCell?.col === c;

  const renderCellContent = (value: string) => {
    if (!value) return "\u00A0";
    if (hasFormatting(value)) {
      return (
        <span dangerouslySetInnerHTML={{ __html: formatCellHtml(value) }} />
      );
    }
    return value;
  };

  const renderCell = (
    tableIndex: number,
    row: number,
    col: number,
    value: string,
    isHeader: boolean
  ) => {
    const Tag = isHeader ? "th" : "td";
    const editing = isEditing(tableIndex, row, col);
    const selected = isSelected(tableIndex, row, col);

    return (
      <Tag
        key={col}
        data-cell={`${tableIndex}-${row}-${col}`}
        className={`table-cell ${selected ? "selected" : ""} ${editing ? "editing" : ""}`}
        tabIndex={0}
        onClick={() => setSelectedCell({ tableIndex, row, col })}
        onDoubleClick={() => startEditing(tableIndex, row, col)}
        onKeyDown={(e) => handleCellKeyDown(e, tableIndex, row, col)}
        onContextMenu={(e) => handleContextMenu(e, tableIndex, row, col)}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="cell-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => handleCellKeyDown(e, tableIndex, row, col)}
          />
        ) : (
          <span className="cell-text">{renderCellContent(value)}</span>
        )}
      </Tag>
    );
  };

  return (
    <div className="table-editor">
      {/* 書式バー */}
      <div className="format-bar">
        <button
          className="fmt-btn"
          onClick={() => toggleFormat("**")}
          title="太字 (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          className="fmt-btn fmt-italic"
          onClick={() => toggleFormat("*")}
          title="斜体 (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          className="fmt-btn"
          onClick={() => toggleFormat("~~")}
          title="取り消し線 (Ctrl+5)"
        >
          <del>S</del>
        </button>
        <button
          className="fmt-btn fmt-code"
          onClick={() => toggleFormat("`")}
          title="コード (Ctrl+`)"
        >
          {"</>"}
        </button>
        <div className="fmt-separator" />
        <span className="fmt-hint">
          {selectedCell
            ? `R${selectedCell.row === -1 ? "H" : selectedCell.row + 1}C${selectedCell.col + 1}`
            : ""}
        </span>
      </div>

      {tables.map((table, ti) => (
        <div key={ti} className="table-section">
          <div className="table-section-header">
            {table.heading && <h3 className="table-heading">{table.heading}</h3>}
            {onExportCsv && (
              <button
                className="csv-export-btn"
                onClick={() => onExportCsv(ti)}
                title="このテーブルをCSVでエクスポート"
              >
                CSV↓
              </button>
            )}
          </div>
          <div className="table-wrapper">
            <table className="md-table">
              <thead>
                <tr>
                  <th className="row-number">#</th>
                  {table.headers.map((h, ci) =>
                    renderCell(ti, -1, ci, h, true)
                  )}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri}>
                    <td className="row-number">{ri + 1}</td>
                    {row.map((cell, ci) => renderCell(ti, ri, ci, cell, false))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* 挿入/削除ダイアログ */}
      {insertDeleteMode && (
        <div className="insert-delete-overlay">
          <div className="insert-delete-dialog">
            <div className="iddlg-title">
              {insertDeleteMode === "insert" ? "挿入" : "削除"}
            </div>
            {insertDeleteMode === "insert" ? (
              <>
                <button onClick={() => handleInsertAction("row-above")}>
                  行を上に挿入
                </button>
                <button onClick={() => handleInsertAction("row-below")}>
                  行を下に挿入
                </button>
                <button onClick={() => handleInsertAction("col-left")}>
                  列を左に挿入
                </button>
                <button onClick={() => handleInsertAction("col-right")}>
                  列を右に挿入
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleInsertAction("delete-row")}
                  disabled={!selectedCell || selectedCell.row === -1}
                >
                  行を削除
                </button>
                <button onClick={() => handleInsertAction("delete-col")}>
                  列を削除
                </button>
              </>
            )}
            <button
              className="iddlg-cancel"
              onClick={() => setInsertDeleteMode(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      <ContextMenu
        menu={contextMenu}
        onClose={closeContextMenu}
        onAddRowAbove={() => {
          onAddRow(contextMenu.tableIndex, contextMenu.row, "above");
          closeContextMenu();
        }}
        onAddRowBelow={() => {
          onAddRow(contextMenu.tableIndex, contextMenu.row, "below");
          closeContextMenu();
        }}
        onDeleteRow={() => {
          onDeleteRow(contextMenu.tableIndex, contextMenu.row);
          closeContextMenu();
        }}
        onAddColumnLeft={() => {
          onAddColumn(contextMenu.tableIndex, contextMenu.col, "left");
          closeContextMenu();
        }}
        onAddColumnRight={() => {
          onAddColumn(contextMenu.tableIndex, contextMenu.col, "right");
          closeContextMenu();
        }}
        onDeleteColumn={() => {
          onDeleteColumn(contextMenu.tableIndex, contextMenu.col);
          closeContextMenu();
        }}
        onCopy={() => {
          handleCopy();
          closeContextMenu();
        }}
        onCut={() => {
          handleCut();
          closeContextMenu();
        }}
        onPaste={() => {
          handlePaste();
          closeContextMenu();
        }}
        onBold={() => {
          toggleFormat("**");
          closeContextMenu();
        }}
        onItalic={() => {
          toggleFormat("*");
          closeContextMenu();
        }}
        onStrikethrough={() => {
          toggleFormat("~~");
          closeContextMenu();
        }}
        onCode={() => {
          toggleFormat("`");
          closeContextMenu();
        }}
      />
    </div>
  );
};

export default TableEditor;

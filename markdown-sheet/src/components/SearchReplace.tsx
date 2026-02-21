import { type FC, useState } from "react";
import type { MarkdownTable } from "../types";
import "./SearchReplace.css";

interface Props {
  // テーブルモード（テーブル編集タブ用）
  tables?: MarkdownTable[];
  onReplace?: (tableIndex: number, row: number, col: number, newValue: string) => void;
  // テキストモード（プレビュータブ用）
  textContent?: string;
  onTextReplace?: (newContent: string) => void;
  // 共通
  onClose: () => void;
}

interface TableMatch {
  tableIndex: number;
  row: number; // -1 = header
  col: number;
  value: string;
}

const SearchReplace: FC<Props> = ({
  tables,
  onReplace,
  textContent,
  onTextReplace,
  onClose,
}) => {
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");

  // テーブルモード用
  const [matches, setMatches] = useState<TableMatch[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);

  // テキストモード用
  const [textMatchCount, setTextMatchCount] = useState(0);

  const isTextMode = textContent !== undefined;

  // ---- テーブルモード ----
  const doSearchTable = () => {
    if (!search || !tables) { setMatches([]); return; }
    const found: TableMatch[] = [];
    const query = search.toLowerCase();
    tables.forEach((table, ti) => {
      table.headers.forEach((h, ci) => {
        if (h.toLowerCase().includes(query))
          found.push({ tableIndex: ti, row: -1, col: ci, value: h });
      });
      table.rows.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          if (cell.toLowerCase().includes(query))
            found.push({ tableIndex: ti, row: ri, col: ci, value: cell });
        });
      });
    });
    setMatches(found);
    setCurrentMatch(0);
  };

  const replaceOneTable = () => {
    if (matches.length === 0 || !onReplace) return;
    const m = matches[currentMatch];
    const newValue = m.value.replaceAll(
      new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      replace
    );
    onReplace(m.tableIndex, m.row, m.col, newValue);
    const next = [...matches];
    next.splice(currentMatch, 1);
    setMatches(next);
    if (currentMatch >= next.length) setCurrentMatch(0);
  };

  const replaceAllTable = () => {
    if (!onReplace) return;
    for (const m of matches) {
      const newValue = m.value.replaceAll(
        new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        replace
      );
      onReplace(m.tableIndex, m.row, m.col, newValue);
    }
    setMatches([]);
  };

  // ---- テキストモード ----
  const doSearchText = () => {
    if (!search || textContent === undefined) { setTextMatchCount(0); return; }
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    setTextMatchCount([...textContent.matchAll(regex)].length);
  };

  const replaceOneText = () => {
    if (textContent === undefined || !onTextReplace || textMatchCount === 0) return;
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const newText = textContent.replace(regex, replace);
    onTextReplace(newText);
    const regex2 = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    setTextMatchCount([...newText.matchAll(regex2)].length);
  };

  const replaceAllText = () => {
    if (textContent === undefined || !onTextReplace || textMatchCount === 0) return;
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    onTextReplace(textContent.replaceAll(regex, replace));
    setTextMatchCount(0);
  };

  // モードに応じてハンドラを切り替え
  const doSearch   = isTextMode ? doSearchText   : doSearchTable;
  const replaceOne = isTextMode ? replaceOneText : replaceOneTable;
  const replaceAll = isTextMode ? replaceAllText : replaceAllTable;
  const matchCount = isTextMode ? textMatchCount : matches.length;

  return (
    <div className="search-replace">
      <div className="sr-row">
        <input
          type="text"
          placeholder={isTextMode ? "テキスト検索..." : "検索..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          autoFocus
        />
        <button onClick={doSearch}>検索</button>
        <span className="sr-count">
          {matchCount > 0
            ? isTextMode
              ? `${matchCount}件`
              : `${currentMatch + 1}/${matchCount}`
            : "0件"}
        </span>
        {!isTextMode && (
          <button
            onClick={() =>
              setCurrentMatch((currentMatch + 1) % Math.max(matches.length, 1))
            }
            disabled={matches.length === 0}
          >
            次
          </button>
        )}
      </div>
      <div className="sr-row">
        <input
          type="text"
          placeholder="置換..."
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && replaceOne()}
        />
        <button onClick={replaceOne} disabled={matchCount === 0}>
          置換
        </button>
        <button onClick={replaceAll} disabled={matchCount === 0}>
          全置換
        </button>
        <button className="sr-close" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
};

export default SearchReplace;

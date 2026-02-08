import { type FC, useState } from "react";
import type { MarkdownTable } from "../types";
import "./SearchReplace.css";

interface Props {
  tables: MarkdownTable[];
  onReplace: (
    tableIndex: number,
    row: number,
    col: number,
    newValue: string
  ) => void;
  onClose: () => void;
}

interface Match {
  tableIndex: number;
  row: number; // -1 = header
  col: number;
  value: string;
}

const SearchReplace: FC<Props> = ({ tables, onReplace, onClose }) => {
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentMatch, setCurrentMatch] = useState(0);

  const doSearch = () => {
    if (!search) {
      setMatches([]);
      return;
    }
    const found: Match[] = [];
    const query = search.toLowerCase();
    tables.forEach((table, ti) => {
      table.headers.forEach((h, ci) => {
        if (h.toLowerCase().includes(query)) {
          found.push({ tableIndex: ti, row: -1, col: ci, value: h });
        }
      });
      table.rows.forEach((row, ri) => {
        row.forEach((cell, ci) => {
          if (cell.toLowerCase().includes(query)) {
            found.push({ tableIndex: ti, row: ri, col: ci, value: cell });
          }
        });
      });
    });
    setMatches(found);
    setCurrentMatch(0);
  };

  const replaceOne = () => {
    if (matches.length === 0) return;
    const m = matches[currentMatch];
    const newValue = m.value.replaceAll(
      new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
      replace
    );
    onReplace(m.tableIndex, m.row, m.col, newValue);
    // 次へ
    const next = [...matches];
    next.splice(currentMatch, 1);
    setMatches(next);
    if (currentMatch >= next.length) setCurrentMatch(0);
  };

  const replaceAll = () => {
    for (const m of matches) {
      const newValue = m.value.replaceAll(
        new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
        replace
      );
      onReplace(m.tableIndex, m.row, m.col, newValue);
    }
    setMatches([]);
  };

  return (
    <div className="search-replace">
      <div className="sr-row">
        <input
          type="text"
          placeholder="検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          autoFocus
        />
        <button onClick={doSearch}>検索</button>
        <span className="sr-count">
          {matches.length > 0
            ? `${currentMatch + 1}/${matches.length}`
            : "0件"}
        </span>
        <button
          onClick={() =>
            setCurrentMatch((currentMatch + 1) % Math.max(matches.length, 1))
          }
          disabled={matches.length === 0}
        >
          次
        </button>
      </div>
      <div className="sr-row">
        <input
          type="text"
          placeholder="置換..."
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
        />
        <button onClick={replaceOne} disabled={matches.length === 0}>
          置換
        </button>
        <button onClick={replaceAll} disabled={matches.length === 0}>
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

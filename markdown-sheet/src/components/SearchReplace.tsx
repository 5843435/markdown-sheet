import { type FC, useState } from "react";
import "./SearchReplace.css";

interface Props {
  textContent: string;
  onTextReplace: (newContent: string) => void;
  onClose: () => void;
}

const SearchReplace: FC<Props> = ({
  textContent,
  onTextReplace,
  onClose,
}) => {
  const [search, setSearch] = useState("");
  const [replace, setReplace] = useState("");
  const [matchCount, setMatchCount] = useState(0);

  const doSearch = () => {
    if (!search) { setMatchCount(0); return; }
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    setMatchCount([...textContent.matchAll(regex)].length);
  };

  const replaceOne = () => {
    if (matchCount === 0) return;
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const newText = textContent.replace(regex, replace);
    onTextReplace(newText);
    const regex2 = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    setMatchCount([...newText.matchAll(regex2)].length);
  };

  const replaceAll = () => {
    if (matchCount === 0) return;
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    onTextReplace(textContent.replaceAll(regex, replace));
    setMatchCount(0);
  };

  return (
    <div className="search-replace">
      <div className="sr-row">
        <input
          type="text"
          placeholder="テキスト検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          autoFocus
        />
        <button onClick={doSearch}>検索</button>
        <span className="sr-count">
          {matchCount > 0 ? `${matchCount}件` : "0件"}
        </span>
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

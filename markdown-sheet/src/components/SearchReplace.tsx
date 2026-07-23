import { type FC, useState } from "react";
import { useT } from "../i18n";
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
  const t = useT();
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
          placeholder={t("search.placeholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          autoFocus
        />
        <button onClick={doSearch}>{t("search.search")}</button>
        <span className="sr-count">
          {t("search.matches", { n: matchCount })}
        </span>
      </div>
      <div className="sr-row">
        <input
          type="text"
          placeholder={t("search.replacePlaceholder")}
          value={replace}
          onChange={(e) => setReplace(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && replaceOne()}
        />
        <button onClick={replaceOne} disabled={matchCount === 0}>
          {t("search.replace")}
        </button>
        <button onClick={replaceAll} disabled={matchCount === 0}>
          {t("search.replaceAll")}
        </button>
        <button className="sr-close" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
};

export default SearchReplace;

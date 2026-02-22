import { type FC, useMemo } from "react";
import { makeHeadingId } from "../lib/headingId";
import "./OutlinePanel.css";

interface Heading {
  depth: number;
  text: string;
  id: string;
}

interface Props {
  content: string;
  onHeadingClick: (id: string) => void;
}

function parseHeadings(content: string): Heading[] {
  // フロントマターをスキップ
  let body = content;
  if (content.startsWith("---\n") || content.startsWith("---\r\n")) {
    const end = content.indexOf("\n---", 4);
    if (end !== -1) body = content.slice(end + 4).replace(/^\r?\n/, "");
  }

  const regex = /^(#{1,4})\s+(.+)/gm;
  const headings: Heading[] = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    const depth = match[1].length;
    const text = match[2].trim();
    headings.push({ depth, text, id: makeHeadingId(text) });
  }
  return headings;
}

const OutlinePanel: FC<Props> = ({ content, onHeadingClick }) => {
  const headings = useMemo(() => parseHeadings(content), [content]);

  if (headings.length === 0) {
    return (
      <div className="outline-panel">
        <div className="outline-empty">見出しがありません</div>
      </div>
    );
  }

  const minDepth = Math.min(...headings.map((h) => h.depth));

  return (
    <div className="outline-panel">
      {headings.map((h, i) => (
        <div
          key={i}
          className={`outline-item outline-h${h.depth}`}
          style={{ paddingLeft: (h.depth - minDepth) * 12 + 8 }}
          onClick={() => onHeadingClick(h.id)}
          title={h.text}
        >
          {h.text}
        </div>
      ))}
    </div>
  );
};

export default OutlinePanel;

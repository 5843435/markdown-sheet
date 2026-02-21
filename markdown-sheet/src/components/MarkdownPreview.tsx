import { type FC, useEffect, useRef, useState } from "react";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import mermaid from "mermaid";
import "./MarkdownPreview.css";

// mermaid 初期化
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  flowchart: { htmlLabels: false },
  sequence: { useMaxWidth: false },
});

let mermaidCounter = 0;

// marked 設定
marked.use({
  async: false,
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }: { text: string; lang?: string | null }) {
      if (lang === "mermaid") {
        const id = `mermaid-placeholder-${mermaidCounter++}`;
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<div class="mermaid-placeholder" data-mermaid-id="${id}" data-mermaid-source="${encodeURIComponent(text)}"><pre class="mermaid-source-fallback"><code>${escaped}</code></pre></div>`;
      }
      const language = lang || "plaintext";
      try {
        const highlighted = hljs.highlight(text, {
          language,
          ignoreIllegals: true,
        });
        return `<pre><code class="hljs language-${language}">${highlighted.value}</code></pre>`;
      } catch {
        const escaped = text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        return `<pre><code>${escaped}</code></pre>`;
      }
    },
  },
});

/**
 * テーブル行間の余分な空行を除去する（GFM テーブル認識のため）
 * | row | の連続する行の間にある空行を詰める
 */
function normalizeTableLines(content: string): string {
  const lines = content.split("\n");
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    result.push(lines[i]);
    if (lines[i].trim().startsWith("|")) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") j++;
      // 次の非空行もテーブル行なら空行をスキップ
      if (j < lines.length && lines[j].trim().startsWith("|") && j > i + 1) {
        i = j;
        continue;
      }
    }
    i++;
  }
  return result.join("\n");
}

const FONT_MAP: Record<string, string> = {
  system:   '"Segoe UI", "Meiryo", sans-serif',
  meiryo:   '"Meiryo", "メイリオ", sans-serif',
  pgothic:  '"MS PGothic", "ＭＳ Ｐゴシック", sans-serif',
  yugothic: '"Yu Gothic", "游ゴシック", "YuGothic", sans-serif',
  yumin:    '"Yu Mincho", "游明朝", "YuMincho", serif',
  msmin:    '"MS PMincho", "ＭＳ Ｐ明朝", serif',
  serif:    '"Georgia", serif',
  mono:     '"Consolas", "Monaco", monospace',
};

interface Props {
  content: string;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}

const MarkdownPreview: FC<Props> = ({ content, previewRef: externalRef }) => {
  const [html, setHtml] = useState("");
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = externalRef || internalRef;

  // 表示設定（localStorage 永続化）
  const [previewFont, setPreviewFont] = useState(
    () => localStorage.getItem("md-preview-font") || "meiryo"
  );
  const [previewSize, setPreviewSize] = useState(
    () => parseInt(localStorage.getItem("md-preview-size") || "14")
  );
  const [previewLineH, setPreviewLineH] = useState(
    () => parseFloat(localStorage.getItem("md-preview-lh") || "1.8")
  );

  useEffect(() => { localStorage.setItem("md-preview-font", previewFont); }, [previewFont]);
  useEffect(() => { localStorage.setItem("md-preview-size", String(previewSize)); }, [previewSize]);
  useEffect(() => { localStorage.setItem("md-preview-lh", String(previewLineH)); }, [previewLineH]);

  // Markdown レンダリング（テーブル空行を正規化してから）
  useEffect(() => {
    mermaidCounter = 0;
    try {
      const normalized = normalizeTableLines(content);
      const result = marked(normalized) as string;
      setHtml(result);
    } catch (error) {
      console.error("Markdown rendering error:", error);
      setHtml("<p>Markdownのレンダリングに失敗しました</p>");
    }
  }, [content]);

  // Mermaid ブロックをレンダリング
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const placeholders = container.querySelectorAll(".mermaid-placeholder");
    if (placeholders.length === 0) return;

    const renderMermaidBlocks = async () => {
      for (const placeholder of Array.from(placeholders)) {
        const id = placeholder.getAttribute("data-mermaid-id");
        const source = decodeURIComponent(
          placeholder.getAttribute("data-mermaid-source") || ""
        );
        if (!id || !source) continue;
        if (placeholder.querySelector(".mermaid-rendered")) continue;

        try {
          const enhancedSource = source.includes("%%{init:")
            ? source
            : `%%{init: {"flowchart": {"htmlLabels": false}} }%%\n${source}`;

          const { svg } = await mermaid.render(id, enhancedSource);
          const processedSvg = processSvgForPowerPoint(svg);

          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-container";
          wrapper.innerHTML = `
            <div class="mermaid-rendered">${processedSvg}</div>
            <div class="mermaid-actions">
              <button class="mermaid-btn mermaid-copy-svg" title="SVGをコピー">SVGコピー</button>
              <button class="mermaid-btn mermaid-save-svg" title="SVGを保存">SVG保存</button>
            </div>
          `;

          wrapper.querySelector(".mermaid-copy-svg")?.addEventListener("click", () => {
            navigator.clipboard.writeText(processedSvg);
          });

          wrapper.querySelector(".mermaid-save-svg")?.addEventListener("click", async () => {
            try {
              const { save } = await import("@tauri-apps/plugin-dialog");
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              const path = await save({
                filters: [{ name: "SVG", extensions: ["svg"] }],
                defaultPath: `diagram-${id}.svg`,
              });
              if (path) await writeTextFile(path, processedSvg);
            } catch (err) {
              console.error("SVG save error:", err);
            }
          });

          placeholder.innerHTML = "";
          placeholder.appendChild(wrapper);
        } catch (err) {
          console.error(`Mermaid render error for ${id}:`, err);
        }
      }
    };

    renderMermaidBlocks();
  }, [html, ref]);

  const previewStyle = {
    fontFamily: FONT_MAP[previewFont] || FONT_MAP.system,
    fontSize: `${previewSize}px`,
    lineHeight: previewLineH,
  };

  return (
    <div className="preview-panel">
      <div className="preview-controls-bar">
        <span className="preview-controls-label">表示</span>
        <select
          value={previewFont}
          onChange={(e) => setPreviewFont(e.target.value)}
          title="フォント"
          className="preview-select"
        >
          <option value="system">サンセリフ</option>
          <option value="meiryo">メイリオ</option>
          <option value="pgothic">MSPゴシック</option>
          <option value="yugothic">游ゴシック</option>
          <option value="yumin">游明朝</option>
          <option value="msmin">MS P明朝</option>
          <option value="serif">Georgia</option>
          <option value="mono">等幅</option>
        </select>
        <select
          value={previewSize}
          onChange={(e) => setPreviewSize(Number(e.target.value))}
          title="フォントサイズ"
          className="preview-select"
        >
          <option value={12}>12px</option>
          <option value={13}>13px</option>
          <option value={14}>14px</option>
          <option value={16}>16px</option>
          <option value={18}>18px</option>
        </select>
        <select
          value={previewLineH}
          onChange={(e) => setPreviewLineH(Number(e.target.value))}
          title="行間"
          className="preview-select"
        >
          <option value={1.4}>行間 1.4</option>
          <option value={1.6}>行間 1.6</option>
          <option value={1.8}>行間 1.8</option>
          <option value={2.0}>行間 2.0</option>
          <option value={2.4}>行間 2.4</option>
        </select>
      </div>
      <div
        ref={ref}
        className="md-preview"
        style={previewStyle}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

/** SVG をパワポ互換にする */
function processSvgForPowerPoint(svg: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) return svg;

  svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svgEl.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const viewBox = svgEl.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4) {
      svgEl.setAttribute("width", `${parts[2]}px`);
      svgEl.setAttribute("height", `${parts[3]}px`);
    }
  }

  let defs = svgEl.querySelector("defs");
  if (!defs) {
    defs = doc.createElementNS("http://www.w3.org/2000/svg", "defs");
    svgEl.prepend(defs);
  }

  const existingStyle = defs.querySelector("style");
  const fontStyle = `
    text, .label, .nodeLabel, .edgeLabel, .cluster-label, tspan {
      font-family: "Segoe UI", "Meiryo", "Yu Gothic", Arial, sans-serif !important;
    }
  `;
  if (existingStyle) {
    existingStyle.textContent += fontStyle;
  } else {
    const styleEl = doc.createElementNS("http://www.w3.org/2000/svg", "style");
    styleEl.textContent = fontStyle;
    defs.appendChild(styleEl);
  }

  return new XMLSerializer().serializeToString(svgEl);
}

export default MarkdownPreview;

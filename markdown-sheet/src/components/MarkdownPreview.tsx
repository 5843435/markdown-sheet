import { type FC, useCallback, useEffect, useRef, useState } from "react";
import type { AiSettings } from "../types";
import { callAI } from "../lib/callAI";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import mermaid from "mermaid";
import katex from "katex";
import "katex/dist/katex.min.css";
import { makeHeadingId } from "../lib/headingId";
import { preprocessMath } from "../lib/mathPreprocess";
import {
  computeSourceMappings,
  computeListItemMappings,
  computeTableMappings,
  countFrontMatterLines,
  type SourceMapping,
  type ListItemMapping,
  type TableMapping,
} from "../lib/sourceMapping";
import { reconstructBlock } from "../lib/htmlToMarkdown";
import { parseMarkdown, serializeTable } from "../lib/markdownParser";
import {
  addRowToTable,
  deleteRowFromTable,
  addColumnToTable,
  deleteColumnFromTable,
  tableToCsv,
} from "../lib/tableOperations";
import TableContextMenu from "./TableContextMenu";
import "./MarkdownPreview.css";

// mermaid 初期化
mermaid.initialize({
  startOnLoad: false,
  theme: "default",
  flowchart: { htmlLabels: false },
  sequence: { useMaxWidth: false },
});

let mermaidCounter = 0;

// ソースマッピング用モジュールスコープ変数（mermaidCounter と同パターン）
let currentHeadingMappings: SourceMapping[] = [];
let currentParagraphMappings: SourceMapping[] = [];
let currentListItemMappings: ListItemMapping[] = [];
let currentTableMappings: TableMapping[] = [];
let headingIdx = 0;
let paragraphIdx = 0;
let listItemIdx = 0;
let tableIdx = 0;
let fmLineCount = 0; // frontmatter の行数オフセット

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
      if (lang === "math") {
        try {
          return `<div class="math-block-display">${katex.renderToString(text, { displayMode: true, throwOnError: false })}</div>`;
        } catch {
          return `<pre><code>${text}</code></pre>`;
        }
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
    heading({ text, depth }: { text: string; depth: number }) {
      const id = makeHeadingId(text);
      const m = currentHeadingMappings[headingIdx++];
      const attrs = m
        ? ` data-source-start="${fmLineCount + m.startLine}" data-source-end="${fmLineCount + m.endLine}" data-editable="true"`
        : "";
      return `<h${depth} id="${id}"${attrs}>${text}</h${depth}>`;
    },
    paragraph({ text }: { text: string }) {
      // math-block のみのパラグラフは編集不可
      const m = currentParagraphMappings[paragraphIdx++];
      if (/^<div class="math-block"/.test(text)) {
        return `<p>${text}</p>`;
      }
      const attrs = m
        ? ` data-source-start="${fmLineCount + m.startLine}" data-source-end="${fmLineCount + m.endLine}" data-editable="true"`
        : "";
      return `<p${attrs}>${text}</p>`;
    },
    listitem({ text, task, checked }: { text: string; task: boolean; checked?: boolean }) {
      const m = currentListItemMappings[listItemIdx++];
      const attrs = m
        ? ` data-source-start="${fmLineCount + m.startLine}" data-source-end="${fmLineCount + m.endLine}" data-editable="true"`
        : "";
      const checkbox = task
        ? `<input type="checkbox"${checked ? " checked" : ""} disabled> `
        : "";
      return `<li${attrs}>${checkbox}${text}</li>\n`;
    },
    table(token: { header: Array<{ text: string; align: string | null }>; rows: Array<Array<{ text: string; align: string | null }>> }) {
      const m = currentTableMappings[tableIdx];
      const ti = tableIdx++;
      const tAttrs = m
        ? ` data-source-start="${fmLineCount + m.startLine}" data-source-end="${fmLineCount + m.endLine}" data-table-index="${ti}"`
        : "";
      let html = `<table${tAttrs}><thead><tr>`;
      for (let ci = 0; ci < token.header.length; ci++) {
        const cell = token.header[ci];
        const align = cell.align ? ` style="text-align:${cell.align}"` : "";
        html += `<th data-table-index="${ti}" data-cell-row="-1" data-cell-col="${ci}" data-editable="true"${align}>${marked.parseInline(cell.text)}</th>`;
      }
      html += "</tr></thead><tbody>";
      for (let ri = 0; ri < token.rows.length; ri++) {
        html += "<tr>";
        for (let ci = 0; ci < token.rows[ri].length; ci++) {
          const cell = token.rows[ri][ci];
          const align = cell.align ? ` style="text-align:${cell.align}"` : "";
          html += `<td data-table-index="${ti}" data-cell-row="${ri}" data-cell-col="${ci}" data-editable="true"${align}>${marked.parseInline(cell.text)}</td>`;
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
      return html;
    },
  },
});

/**
 * テーブル行間の余分な空行を除去する（GFM テーブル認識のため）
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
      if (j < lines.length && lines[j].trim().startsWith("|") && j > i + 1) {
        i = j;
        continue;
      }
    }
    i++;
  }
  return result.join("\n");
}

/**
 * YAML フロントマターを抽出して本文と分離する
 */
function extractFrontMatter(content: string): {
  meta: Record<string, string> | null;
  body: string;
} {
  if (!content.startsWith("---\n") && !content.startsWith("---\r\n")) {
    return { meta: null, body: content };
  }
  const end = content.indexOf("\n---", 4);
  if (end === -1) return { meta: null, body: content };

  const yaml = content.slice(4, end).trim();
  const body = content.slice(end + 4).replace(/^\r?\n/, "");
  const meta: Record<string, string> = {};

  for (const line of yaml.split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      const value = line
        .slice(colon + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key) meta[key] = value;
    }
  }
  return { meta: Object.keys(meta).length > 0 ? meta : null, body };
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
  aiSettings?: AiSettings;
  onUpdateMermaidBlock?: (blockIndex: number, newSource: string) => void;
  onInlineEdit?: (startLine: number, endLine: number, newMarkdown: string) => void;
}

const MarkdownPreview: FC<Props> = ({
  content,
  previewRef: externalRef,
  aiSettings,
  onUpdateMermaidBlock,
  onInlineEdit,
}) => {
  const [html, setHtml] = useState("");
  const [frontMatter, setFrontMatter] = useState<Record<string, string> | null>(null);
  const internalRef = useRef<HTMLDivElement>(null);
  const ref = externalRef || internalRef;
  // AI 設定と更新コールバックの最新値を ref で保持（useEffect 内の stale closure 回避）
  const aiSettingsRef = useRef(aiSettings);
  aiSettingsRef.current = aiSettings;
  const onUpdateMermaidBlockRef = useRef(onUpdateMermaidBlock);
  const onInlineEditRef = useRef(onInlineEdit);
  onInlineEditRef.current = onInlineEdit;

  // インライン編集用 refs
  const editingElementRef = useRef<HTMLElement | null>(null);
  const editingOriginalHtmlRef = useRef("");
  const isInlineEditingRef = useRef(false);
  const contentRef = useRef(content);
  contentRef.current = content;
  onUpdateMermaidBlockRef.current = onUpdateMermaidBlock;

  // テーブル右クリックメニュー state
  const [tableCtxMenu, setTableCtxMenu] = useState<{
    visible: boolean; x: number; y: number;
    tableIndex: number; row: number; col: number;
  }>({ visible: false, x: 0, y: 0, tableIndex: -1, row: 0, col: 0 });

  // dangerouslySetInnerHTML の代わりに手動で innerHTML を管理する ref。
  // React 19 StrictMode は true unmount/remount を行うため、
  // dangerouslySetInnerHTML を使うと remount 時に innerHTML がリセットされ
  // 挿入済みの mermaid SVG が消えてしまう。
  const mdContentRef = useRef<HTMLDivElement>(null);

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

  // Markdown レンダリング（YAML front matter → 数式前処理 → テーブル正規化 → marked）
  useEffect(() => {
    try {
      const { meta, body } = extractFrontMatter(content);
      setFrontMatter(meta);
      const preprocessed = preprocessMath(body);
      const normalized = normalizeTableLines(preprocessed);

      // ソースマッピングを計算（前処理前の body に対して lexer を実行）
      const allMappings = computeSourceMappings(body);
      currentHeadingMappings = allMappings.filter((m) => m.type === "heading");
      currentParagraphMappings = allMappings.filter((m) => m.type === "paragraph");
      currentListItemMappings = computeListItemMappings(body);
      currentTableMappings = computeTableMappings(body);
      fmLineCount = countFrontMatterLines(content);

      // カウンターをリセットしてから marked を呼ぶ。
      // こうすることで同じ content なら毎回同じ HTML 文字列が生成され、
      // React StrictMode の 2 重発火時に setHtml が同一値なら再レンダーが
      // スキップされる（Object.is で同じ文字列 → bail out）。
      mermaidCounter = 0;
      headingIdx = 0;
      paragraphIdx = 0;
      listItemIdx = 0;
      tableIdx = 0;
      const result = marked(normalized) as string;
      setHtml(result);
    } catch (error) {
      console.error("Markdown rendering error:", error);
      setHtml("<p>Markdownのレンダリングに失敗しました</p>");
    }
  }, [content]);

  // HTML 書き込み → Mermaid/KaTeX レンダリングを単一 effect で実行。
  // innerHTML 設定と placeholder 探索の間に別 effect が挟まる問題を防ぐ。
  useEffect(() => {
    // 1) innerHTML を設定（インライン編集中はスキップして編集状態を保持）
    const div = mdContentRef.current;
    if (div && !isInlineEditingRef.current) {
      div.innerHTML = html;
      // 全 [data-editable] 要素を常時 contentEditable にして WYSIWYG 感を出す
      div.querySelectorAll<HTMLElement>("[data-editable='true']").forEach((el) => {
        el.contentEditable = "true";
      });
    }

    // 2) Mermaid / KaTeX をレンダリング
    const container = ref.current;
    if (!container) return;

    let cancelled = false;

    // setTimeout(0) で 1 tick 遅延させることで React StrictMode の
    // 「cleanup → 再発火」サイクルを安全に処理する。
    // cleanup で clearTimeout されるため、古い effect のタイマーは発火しない。
    const timerId = setTimeout(async () => {
      if (cancelled) return;

      // --- Mermaid ---
      // data-rendered 属性でレンダリング状態を管理する。
      // 非同期 await 中に placeholder が付け替えられても整合性を保てる。
      const placeholders = container.querySelectorAll<HTMLElement>(
        ".mermaid-placeholder:not([data-rendered='done'])"
      );
      for (const placeholder of Array.from(placeholders)) {
        if (cancelled) return;
        // 別の非同期ループがすでに処理中ならスキップ
        if (placeholder.getAttribute("data-rendered") === "pending") continue;

        const source = decodeURIComponent(
          placeholder.getAttribute("data-mermaid-source") || ""
        );
        if (!source) continue;

        // 処理中フラグを立てる（二重レンダリング防止）
        placeholder.setAttribute("data-rendered", "pending");

        try {
          const renderId = `mmrd-${Date.now().toString(36)}-${((Math.random() * 0xffffff) | 0).toString(36)}`;
          const { svg } = await mermaid.render(renderId, source);

          if (cancelled) {
            placeholder.removeAttribute("data-rendered");
            return;
          }

          // tempDiv で HTML としてパースして svg ノードを移動する。
          // これにより HTML 文書の文脈で SVG が正しく扱われる。
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = svg;
          const svgNode = tempDiv.querySelector("svg");
          if (!svgNode) throw new Error("No SVG element in mermaid output");

          const rendered = document.createElement("div");
          rendered.className = "mermaid-rendered";
          rendered.appendChild(svgNode);

          // このブロックの index（AI 編集でエディタ上の何番目のコードブロックかを特定するため）
          const allPlaceholders = Array.from(container.querySelectorAll(".mermaid-placeholder"));
          const blockIndex = allPlaceholders.indexOf(placeholder);

          const actionsDiv = document.createElement("div");
          actionsDiv.className = "mermaid-actions";
          actionsDiv.innerHTML = `
            <button class="mermaid-btn mermaid-zoom-out" title="縮小">−</button>
            <span class="mermaid-zoom-label">--</span>
            <button class="mermaid-btn mermaid-zoom-in" title="拡大">+</button>
            <button class="mermaid-btn mermaid-zoom-reset" title="全体表示にリセット">全体表示</button>
            <div class="mermaid-actions-spacer"></div>
            <button class="mermaid-btn mermaid-copy-svg" title="SVGをコピー">SVGコピー</button>
            <button class="mermaid-btn mermaid-save-svg" title="SVGを保存">SVG保存</button>
            <button class="mermaid-btn mermaid-ai-toggle" title="AIでダイアグラムを編集">✦ AI編集</button>
          `;

          // AI 編集パネル
          const aiPanel = document.createElement("div");
          aiPanel.className = "mermaid-ai-panel";
          aiPanel.style.display = "none";
          aiPanel.innerHTML = `
            <textarea class="mermaid-ai-input" placeholder="指示を入力（例: 左から右に変えて）" rows="2"></textarea>
            <div class="mermaid-ai-row">
              <button class="mermaid-btn mermaid-ai-submit">送信</button>
              <span class="mermaid-ai-status"></span>
            </div>
          `;

          const wrapper = document.createElement("div");
          wrapper.className = "mermaid-container";
          wrapper.appendChild(rendered);
          wrapper.appendChild(actionsDiv);
          wrapper.appendChild(aiPanel);

          // SVG の固有サイズを取得する。
          // width="100%" のようなパーセント値は実ピクセル数ではないため無視し、
          // viewBox を優先的に参照する。
          const svgEl = svgNode as SVGSVGElement;
          const getSize = (attr: string, vbIdx: number) => {
            // viewBox が存在する場合は最優先
            const vb = svgEl.getAttribute("viewBox")?.split(/\s+/).map(Number);
            if (vb && vb.length === 4 && vb[vbIdx] > 0) return vb[vbIdx];
            // パーセント値は無視
            const val = svgEl.getAttribute(attr) || "";
            if (!val.includes("%")) {
              const n = parseFloat(val);
              if (n > 0) return n;
            }
            return 0;
          };
          const intrinsicW = getSize("width", 2);
          const intrinsicH = getSize("height", 3);

          const getInitialZoom = () => {
            const containerW = container.clientWidth - 48;
            if (intrinsicW <= 0 || containerW <= 0) return 1;
            return Math.min(1, containerW / intrinsicW);
          };
          let currentZoom = getInitialZoom();

          const applyZoom = (zoom: number) => {
            currentZoom = Math.max(0.25, Math.min(4, zoom));
            if (intrinsicW > 0) {
              svgEl.style.width = `${intrinsicW * currentZoom}px`;
              svgEl.style.height = `${intrinsicH * currentZoom}px`;
              svgEl.style.maxWidth = "none";
            }
            const label = actionsDiv.querySelector<HTMLElement>(".mermaid-zoom-label");
            if (label) label.textContent = `${Math.round(currentZoom * 100)}%`;
          };
          applyZoom(currentZoom);

          actionsDiv.querySelector(".mermaid-zoom-out")?.addEventListener("click", () => applyZoom(currentZoom - 0.25));
          actionsDiv.querySelector(".mermaid-zoom-in")?.addEventListener("click", () => applyZoom(currentZoom + 0.25));
          actionsDiv.querySelector(".mermaid-zoom-reset")?.addEventListener("click", () => applyZoom(getInitialZoom()));

          // DOM に挿入（先に挿入してブラウザが CSS を適用した状態にする）
          placeholder.innerHTML = "";
          placeholder.appendChild(wrapper);
          placeholder.setAttribute("data-rendered", "done");

          // DOM 挿入後に getComputedStyle でスタイルを読み取り PowerPoint 互換 SVG を生成。
          // 挿入前だと <style> の CSS が未適用のまま処理されてテキスト色が失われる。
          const processedSvg = processSvgForPowerPoint(svgEl);

          actionsDiv.querySelector(".mermaid-copy-svg")?.addEventListener("click", () => {
            navigator.clipboard.writeText(processedSvg);
          });
          actionsDiv.querySelector(".mermaid-save-svg")?.addEventListener("click", async () => {
            try {
              const { save } = await import("@tauri-apps/plugin-dialog");
              const { writeTextFile } = await import("@tauri-apps/plugin-fs");
              const path = await save({
                filters: [{ name: "SVG", extensions: ["svg"] }],
                defaultPath: `diagram.svg`,
              });
              if (path) await writeTextFile(path, processedSvg);
            } catch (err) {
              console.error("SVG save error:", err);
            }
          });

          // AI 編集パネルの開閉
          actionsDiv.querySelector(".mermaid-ai-toggle")?.addEventListener("click", () => {
            const open = aiPanel.style.display === "none";
            aiPanel.style.display = open ? "block" : "none";
            if (open) aiPanel.querySelector<HTMLTextAreaElement>(".mermaid-ai-input")?.focus();
          });

          // AI 送信
          const handleAiSubmit = async () => {
            const settings = aiSettingsRef.current;
            const statusEl = aiPanel.querySelector<HTMLElement>(".mermaid-ai-status");
            if (!settings?.apiKey) {
              if (statusEl) statusEl.textContent = "⚙ ツールバーの設定でAPIキーを入力してください";
              return;
            }
            const inputEl = aiPanel.querySelector<HTMLTextAreaElement>(".mermaid-ai-input");
            const instruction = inputEl?.value.trim() ?? "";
            if (!instruction) return;

            const submitBtn = aiPanel.querySelector<HTMLButtonElement>(".mermaid-ai-submit");
            if (submitBtn) submitBtn.disabled = true;
            if (statusEl) statusEl.textContent = "処理中...";

            try {
              let newSource = await callAI(
                settings,
                SYSTEM_PROMPT,
                `Mermaid source:\n${source}\n\nInstruction: ${instruction}`
              );
              // AI がコードフェンスを付けた場合でも除去する
              newSource = newSource.replace(/^```(?:mermaid)?\r?\n?/, "").replace(/\r?\n?```$/, "").trim();
              onUpdateMermaidBlockRef.current?.(blockIndex, newSource);
              if (statusEl) statusEl.textContent = "✓ 更新しました";
              if (inputEl) inputEl.value = "";
              setTimeout(() => { aiPanel.style.display = "none"; }, 1200);
            } catch (err) {
              if (statusEl) statusEl.textContent = `⚠ ${err instanceof Error ? err.message : String(err)}`;
            } finally {
              if (submitBtn) submitBtn.disabled = false;
            }
          };

          aiPanel.querySelector(".mermaid-ai-submit")?.addEventListener("click", handleAiSubmit);
          // Enter キーで送信（Shift+Enter で改行）
          aiPanel.querySelector(".mermaid-ai-input")?.addEventListener("keydown", (e) => {
            if ((e as KeyboardEvent).key === "Enter" && !(e as KeyboardEvent).shiftKey) {
              e.preventDefault();
              handleAiSubmit();
            }
          });

        } catch (err) {
          console.error("Mermaid render error:", err);
          // エラーを UI に表示して原因を把握しやすくする
          placeholder.removeAttribute("data-rendered");
          const errDiv = document.createElement("div");
          errDiv.className = "mermaid-error";
          errDiv.textContent = `⚠ Mermaid: ${err instanceof Error ? err.message : String(err)}`;
          placeholder.innerHTML = "";
          placeholder.appendChild(errDiv);
        }
      }

      // --- KaTeX (インライン/ブロック) ---
      if (cancelled) return;
      const mathBlocks = container.querySelectorAll<HTMLElement>(".math-block[data-math]");
      for (const el of Array.from(mathBlocks)) {
        const encoded = el.getAttribute("data-math") || "";
        try {
          const math = decodeURIComponent(escape(atob(encoded)));
          katex.render(math, el, { displayMode: true, throwOnError: false });
        } catch { /* skip */ }
      }
      const mathInlines = container.querySelectorAll<HTMLElement>(".math-inline[data-math]");
      for (const el of Array.from(mathInlines)) {
        const encoded = el.getAttribute("data-math") || "";
        try {
          const math = decodeURIComponent(escape(atob(encoded)));
          katex.render(math, el, { displayMode: false, throwOnError: false });
        } catch { /* skip */ }
      }
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timerId);
    };
  }, [html, ref]);

  // --- インライン編集 ---
  const cancelInlineEdit = useCallback(() => {
    const element = editingElementRef.current;
    if (!element) return;
    element.innerHTML = editingOriginalHtmlRef.current;
    editingElementRef.current = null;
    isInlineEditingRef.current = false;
  }, []);

  const commitInlineEdit = useCallback(
    (element: HTMLElement) => {
      // --- テーブルセルの場合 ---
      const tiAttr = element.getAttribute("data-table-index");
      if (tiAttr !== null) {
        const ti = parseInt(tiAttr);
        const row = parseInt(element.getAttribute("data-cell-row") || "0");
        const col = parseInt(element.getAttribute("data-cell-col") || "0");

        editingElementRef.current = null;
        isInlineEditingRef.current = false;

        const doc = parseMarkdown(contentRef.current);
        const table = doc.tables[ti];
        if (!table) return;

        const newValue = (element.textContent || "").trim();
        const oldValue = row === -1 ? (table.headers[col] ?? "") : (table.rows[row]?.[col] ?? "");
        if (newValue === oldValue) return;

        if (row === -1) {
          table.headers[col] = newValue;
        } else {
          table.rows[row][col] = newValue;
        }

        const serialized = serializeTable(table).replace(/\n$/, "");
        onInlineEditRef.current?.(table.start_line, table.end_line, serialized);
        return;
      }

      // --- 見出し・段落・リストの場合 ---
      const startLine = parseInt(element.getAttribute("data-source-start") || "-1");
      const endLine = parseInt(element.getAttribute("data-source-end") || "-1");
      if (startLine < 0 || endLine < 0) {
        editingElementRef.current = null;
        isInlineEditingRef.current = false;
        return;
      }

      const lines = contentRef.current.split("\n");
      const originalLines = lines.slice(startLine, endLine + 1);
      const newMarkdown = reconstructBlock(element.tagName, element.innerHTML, originalLines);

      if (newMarkdown === originalLines.join("\n")) {
        editingElementRef.current = null;
        isInlineEditingRef.current = false;
        return;
      }

      editingElementRef.current = null;
      isInlineEditingRef.current = false;

      onInlineEditRef.current?.(startLine, endLine, newMarkdown);
    },
    [cancelInlineEdit]
  );

  // テーブル右クリック操作
  const handleTableOperation = useCallback((
    operation: (table: import("../types").MarkdownTable) => import("../types").MarkdownTable
  ) => {
    const { tableIndex } = tableCtxMenu;
    setTableCtxMenu((m) => ({ ...m, visible: false }));

    const doc = parseMarkdown(contentRef.current);
    const table = doc.tables[tableIndex];
    if (!table) return;

    const startLine = table.start_line;
    const endLine = table.end_line;
    const modified = operation(table);
    const serialized = serializeTable(modified).replace(/\n$/, "");
    onInlineEditRef.current?.(startLine, endLine, serialized);
  }, [tableCtxMenu]);

  const handleTableCsvExport = useCallback(async () => {
    const { tableIndex } = tableCtxMenu;
    setTableCtxMenu((m) => ({ ...m, visible: false }));

    const doc = parseMarkdown(contentRef.current);
    const table = doc.tables[tableIndex];
    if (!table) return;

    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: `${table.heading || "table"}.csv`,
      });
      if (path) await writeTextFile(path, tableToCsv(table));
    } catch (err) {
      console.error("CSV export error:", err);
    }
  }, [tableCtxMenu]);

  // WYSIWYG: focusin/focusout/keydown/dblclick(テーブル)/contextmenu イベントリスナー
  useEffect(() => {
    const container = mdContentRef.current;
    if (!container) return;

    // --- 見出し・段落・リスト: focusin で編集開始（常時 contentEditable なのでクリックだけでカーソルが立つ） ---
    const handleFocusIn = (e: FocusEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-editable='true']"
      );
      if (!target) return;
      // 既に同じ要素をトラッキング中ならスキップ
      if (editingElementRef.current === target) return;
      // 別の要素に移動 → 前の要素をコミット
      if (editingElementRef.current) {
        commitInlineEdit(editingElementRef.current);
      }
      editingElementRef.current = target;
      editingOriginalHtmlRef.current = target.innerHTML;
      isInlineEditingRef.current = true;
    };

    const handleFocusOut = (e: FocusEvent) => {
      const element = editingElementRef.current;
      if (!element) return;
      // フォーカス先が同じ要素内 or 別の editable 要素なら focusIn 側で処理
      const related = e.relatedTarget as HTMLElement | null;
      if (element.contains(related)) return;
      if (related?.closest?.("[data-editable='true']")) return;
      commitInlineEdit(element);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const element = editingElementRef.current;
      if (!element) return;
      if (e.key === "Escape") {
        e.preventDefault();
        cancelInlineEdit();
        element.blur();
      }
      // 見出しは Enter で確定
      if (e.key === "Enter" && /^H[1-6]$/.test(element.tagName)) {
        e.preventDefault();
        commitInlineEdit(element);
        element.blur();
      }
      // テーブルセルで Tab → 次/前のセルに移動
      if (e.key === "Tab" && element.hasAttribute("data-table-index")) {
        e.preventDefault();
        commitInlineEdit(element);
        const ti = parseInt(element.getAttribute("data-table-index") || "-1");
        const row = parseInt(element.getAttribute("data-cell-row") || "0");
        const col = parseInt(element.getAttribute("data-cell-col") || "0");
        const doc = parseMarkdown(contentRef.current);
        const t = doc.tables[ti];
        if (!t) return;
        const maxCol = t.headers.length - 1;
        const maxRow = t.rows.length - 1;
        let nextRow = row, nextCol = col;
        if (e.shiftKey) {
          if (col > 0) nextCol = col - 1;
          else if (row > -1) { nextRow = row === 0 ? -1 : row - 1; nextCol = maxCol; }
        } else {
          if (col < maxCol) nextCol = col + 1;
          else if (row < maxRow) { nextRow = row === -1 ? 0 : row + 1; nextCol = 0; }
        }
        setTimeout(() => {
          const next = mdContentRef.current?.querySelector<HTMLElement>(
            `[data-table-index="${ti}"][data-cell-row="${nextRow}"][data-cell-col="${nextCol}"]`
          );
          next?.focus();
        }, 50);
      }
    };

    // --- テーブルセル: 右クリックメニュー ---
    const handleContextMenu = (e: MouseEvent) => {
      const cellTarget = (e.target as HTMLElement).closest<HTMLElement>(
        "td[data-table-index], th[data-table-index]"
      );
      if (!cellTarget) return;
      e.preventDefault();
      const ti = parseInt(cellTarget.getAttribute("data-table-index") || "-1");
      const row = parseInt(cellTarget.getAttribute("data-cell-row") || "0");
      const col = parseInt(cellTarget.getAttribute("data-cell-col") || "0");
      setTableCtxMenu({ visible: true, x: e.clientX, y: e.clientY, tableIndex: ti, row, col });
    };

    container.addEventListener("focusin", handleFocusIn);
    container.addEventListener("focusout", handleFocusOut);
    container.addEventListener("keydown", handleKeyDown);
    container.addEventListener("contextmenu", handleContextMenu);

    return () => {
      container.removeEventListener("focusin", handleFocusIn);
      container.removeEventListener("focusout", handleFocusOut);
      container.removeEventListener("keydown", handleKeyDown);
      container.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [commitInlineEdit, cancelInlineEdit]);

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
      >
        {frontMatter && (
          <div key="yaml" className="yaml-front-matter">
            {Object.entries(frontMatter).map(([k, v]) => (
              <div key={k} className="yaml-entry">
                <span className="yaml-key">{k}</span>
                <span className="yaml-value">{v}</span>
              </div>
            ))}
          </div>
        )}
        {/* key を固定することで frontMatter の出現/消滅で div が再作成されるのを防ぐ。
            innerHTML は dangerouslySetInnerHTML を使わず useEffect で手動管理する。 */}
        <div key="md-content" ref={mdContentRef} />
      </div>

      {/* テーブル右クリックメニュー */}
      <TableContextMenu
        menu={tableCtxMenu}
        onClose={() => setTableCtxMenu((m) => ({ ...m, visible: false }))}
        onAddRowAbove={() => handleTableOperation((t) => addRowToTable(t, tableCtxMenu.row === -1 ? 0 : tableCtxMenu.row, "above"))}
        onAddRowBelow={() => handleTableOperation((t) => addRowToTable(t, tableCtxMenu.row === -1 ? 0 : tableCtxMenu.row, "below"))}
        onDeleteRow={() => handleTableOperation((t) => deleteRowFromTable(t, tableCtxMenu.row))}
        onAddColumnLeft={() => handleTableOperation((t) => addColumnToTable(t, tableCtxMenu.col, "left"))}
        onAddColumnRight={() => handleTableOperation((t) => addColumnToTable(t, tableCtxMenu.col, "right"))}
        onDeleteColumn={() => handleTableOperation((t) => deleteColumnFromTable(t, tableCtxMenu.col))}
        onExportCsv={handleTableCsvExport}
      />
    </div>
  );
};

/**
 * SVG を PowerPoint 互換にする。
 *
 * PowerPoint は以下を無視する:
 *   1. <style> タグ / CSS クラス
 *   2. <foreignObject> 要素（HTML ラベルが消える根本原因）
 *
 * 対策:
 *   A. ライブ DOM 要素に getComputedStyle を呼び出し、fill/stroke 等を
 *      プレゼンテーション属性としてインライン化
 *   B. <foreignObject> を SVG <text> 要素に変換（mermaid v11 がフローチャート以外で
 *      htmlLabels を無視して foreignObject を使う場合に対応）
 */
function processSvgForPowerPoint(liveSvgEl: SVGSVGElement): string {
  const SVG_NS = "http://www.w3.org/2000/svg";
  const SAFE_FONT = "Meiryo, Yu Gothic, Segoe UI, Arial, sans-serif";

  const clone = liveSvgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", SVG_NS);
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // viewBox からサイズを確定（width="100%" のような相対指定を上書き）
  const viewBox = clone.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      clone.setAttribute("width", `${parts[2]}px`);
      clone.setAttribute("height", `${parts[3]}px`);
    }
  }

  // ライブ要素とクローン要素を 1:1 で対応付けし、computed style を属性にインライン化。
  // foreignObject の内側は HTML 要素（SVGElement ではない）なのでスキップする。
  const liveEls = Array.from(liveSvgEl.querySelectorAll("*"));
  const cloneEls = Array.from(clone.querySelectorAll("*"));

  const PROPS = [
    "fill", "fill-opacity",
    "stroke", "stroke-width", "stroke-opacity",
    "font-size", "font-weight", "font-style",
    "opacity",
  ];

  for (let i = 0; i < liveEls.length && i < cloneEls.length; i++) {
    const liveEl = liveEls[i];
    const cloneEl = cloneEls[i];
    // foreignObject 内の HTML 要素は SVGElement ではないのでスキップ
    if (!(liveEl instanceof SVGElement)) continue;
    try {
      const computed = getComputedStyle(liveEl);
      for (const prop of PROPS) {
        const val = computed.getPropertyValue(prop);
        if (!val || val === "initial" || val === "inherit") continue;
        cloneEl.setAttribute(prop, val.startsWith("url(") ? val : rgbToHex(val));
      }
    } catch {
      // getComputedStyle が失敗した場合はスキップ（foreignObject 近傍で発生しうる）
    }
  }

  // <style> はすでに属性にインライン化済みなので削除
  for (const el of Array.from(clone.querySelectorAll("style"))) {
    el.remove();
  }

  // ---- <foreignObject> → SVG <text> 変換 ----
  // PowerPoint は <foreignObject>（および内部の HTML）を完全に無視する。
  // mermaid v11 はシーケンス図・クラス図等で htmlLabels 設定を無視して
  // <foreignObject> を使うことがあるため、SVG <text> に変換して可視化する。
  for (const fo of Array.from(clone.querySelectorAll("foreignObject"))) {
    const rawText = fo.textContent?.trim() ?? "";
    if (!rawText) {
      fo.remove();
      continue;
    }

    const x = parseFloat(fo.getAttribute("x") || "0");
    const y = parseFloat(fo.getAttribute("y") || "0");
    const w = parseFloat(fo.getAttribute("width") || "0");
    const h = parseFloat(fo.getAttribute("height") || "0");

    // 改行または複数スペースで分割（HTML 内の <br> は textContent では \n になる）
    const lines = rawText.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const fontSize = 14;
    const lineHeight = fontSize * 1.4;

    const textEl = document.createElementNS(SVG_NS, "text");
    textEl.setAttribute("font-family", SAFE_FONT);
    textEl.setAttribute("font-size", String(fontSize));
    textEl.setAttribute("fill", "#333333");
    textEl.setAttribute("text-anchor", "middle");

    if (lines.length === 1) {
      textEl.setAttribute("x", String(x + w / 2));
      textEl.setAttribute("y", String(y + h / 2));
      textEl.setAttribute("dominant-baseline", "middle");
      textEl.textContent = lines[0];
    } else {
      // 複数行: 最初の行の y を中央揃えになるよう調整し、以後 dy で改行
      const totalH = (lines.length - 1) * lineHeight;
      const startY = y + h / 2 - totalH / 2;
      textEl.setAttribute("x", String(x + w / 2));
      textEl.setAttribute("y", String(startY));
      for (let li = 0; li < lines.length; li++) {
        const tspan = document.createElementNS(SVG_NS, "tspan");
        tspan.setAttribute("x", String(x + w / 2));
        if (li > 0) tspan.setAttribute("dy", String(lineHeight));
        tspan.textContent = lines[li];
        textEl.appendChild(tspan);
      }
    }

    fo.parentNode?.replaceChild(textEl, fo);
  }

  // font-family を全 text/tspan 要素に設定（foreignObject 変換後も含む）
  for (const el of Array.from(clone.querySelectorAll("text, tspan"))) {
    el.setAttribute("font-family", SAFE_FONT);
  }

  return new XMLSerializer().serializeToString(clone);
}

const SYSTEM_PROMPT =
  "You are a Mermaid diagram editor. " +
  "Given a Mermaid diagram source and an instruction, " +
  "return ONLY the modified Mermaid source code. " +
  "Do NOT include any explanation, markdown code fences, or extra text.";


/** "rgb(r,g,b)" / "rgba(r,g,b,a)" → "#rrggbb" に変換する */
function rgbToHex(val: string): string {
  const m = val.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return val;
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => parseInt(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

export default MarkdownPreview;

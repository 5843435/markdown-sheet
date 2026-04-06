/**
 * HTML → docx 変換
 * プレビューの innerHTML を docx の段落・テーブル・画像に変換する。
 */
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  ImageRun,
  AlignmentType,
  BorderStyle,
  ExternalHyperlink,
  type IParagraphOptions,
  type ITableCellBorders,
} from "docx";

/** localStorage のフォントキー → Word で使えるフォント名 */
const DOCX_FONT_MAP: Record<string, string> = {
  system:   "Segoe UI",
  meiryo:   "Meiryo",
  pgothic:  "MS PGothic",
  yugothic: "Yu Gothic",
  yumin:    "Yu Mincho",
  msmin:    "MS PMincho",
  serif:    "Georgia",
  mono:     "Consolas",
};

/** モジュール内でフォント名を共有する変数 */
let docxFont = "Meiryo";
let docxFontSize = 22; // half-points (11pt = 22)

const HEADING_MAP: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

const CELL_BORDERS: ITableCellBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
};

/** インラインHTML → TextRun[] に変換（docxFont / docxFontSize を自動適用） */
function parseInlineRuns(el: Element | ChildNode): TextRun[] {
  const runs: TextRun[] = [];

  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) runs.push(new TextRun({ text, font: docxFont, size: docxFontSize }));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as Element;
      const tag = elem.tagName;

      if (tag === "STRONG" || tag === "B") {
        for (const child of Array.from(elem.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            runs.push(new TextRun({ text: child.textContent || "", bold: true, font: docxFont, size: docxFontSize }));
          } else {
            runs.push(...parseInlineRuns(child));
          }
        }
      } else if (tag === "EM" || tag === "I") {
        for (const child of Array.from(elem.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            runs.push(new TextRun({ text: child.textContent || "", italics: true, font: docxFont, size: docxFontSize }));
          } else {
            runs.push(...parseInlineRuns(child));
          }
        }
      } else if (tag === "CODE") {
        runs.push(new TextRun({
          text: elem.textContent || "",
          font: "Consolas",
          size: 18,
          shading: { fill: "F0F0F0", type: "clear", color: "auto" },
        }));
      } else if (tag === "A") {
        const text = elem.textContent || elem.getAttribute("href") || "";
        runs.push(new TextRun({ text, font: docxFont, size: docxFontSize, color: "0563C1", underline: { type: "single" } }));
      } else if (tag === "BR") {
        runs.push(new TextRun({ break: 1 }));
      } else {
        runs.push(...parseInlineRuns(elem));
      }
    }
  }
  return runs;
}

/** <table> → docx Table */
function convertTable(tableEl: Element): Table {
  const rows: TableRow[] = [];
  const allRows = tableEl.querySelectorAll("tr");

  for (const tr of Array.from(allRows)) {
    const cells: TableCell[] = [];
    const tds = tr.querySelectorAll("th, td");

    for (const td of Array.from(tds)) {
      const isHeader = td.tagName === "TH";
      cells.push(
        new TableCell({
          children: [new Paragraph({
            children: parseInlineRuns(td),
            spacing: { after: 0 },
          })],
          borders: CELL_BORDERS,
          shading: isHeader ? { fill: "F6F8FA", type: "clear", color: "auto" } : undefined,
          width: { size: 0, type: WidthType.AUTO },
        })
      );
    }
    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }));
    }
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/** <pre><code> → コードブロック段落群 */
function convertCodeBlock(preEl: Element): Paragraph[] {
  const code = preEl.textContent || "";
  return code.split("\n").map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line || " ", font: "Consolas", size: 18 })],
        shading: { fill: "F6F8FA", type: "clear", color: "auto" },
        spacing: { after: 0, line: 276 },
      })
  );
}

/** <li> → Paragraph（箇条書き） */
function convertListItem(li: Element, ordered: boolean, _index: number): Paragraph {
  const runs = parseInlineRuns(li);
  const bullet = ordered ? `${_index}. ` : "- ";
  return new Paragraph({
    children: [new TextRun({ text: bullet }), ...runs],
    spacing: { after: 40 },
    indent: { left: 360 },
  });
}

/** 画像を読み込んで ImageRun を作る（同期不可なので事前に読み込む） */
async function tryLoadImage(
  imgEl: HTMLImageElement
): Promise<Paragraph | null> {
  try {
    let blob: Blob;
    const src = imgEl.src;

    if (src.startsWith("blob:")) {
      const resp = await fetch(src);
      blob = await resp.blob();
    } else if (src.startsWith("data:")) {
      const resp = await fetch(src);
      blob = await resp.blob();
    } else {
      return null; // ローカルファイルパスの場合はスキップ
    }

    const arrayBuffer = await blob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    // 画像サイズを推定（最大幅 600px）
    const naturalW = imgEl.naturalWidth || 400;
    const naturalH = imgEl.naturalHeight || 300;
    const maxWidth = 600;
    const scale = Math.min(1, maxWidth / naturalW);

    return new Paragraph({
      children: [
        new ImageRun({
          data: uint8,
          transformation: {
            width: Math.round(naturalW * scale),
            height: Math.round(naturalH * scale),
          },
          type: "png",
        }),
      ],
      spacing: { after: 200 },
    });
  } catch {
    return null;
  }
}

/**
 * previewRef.current の DOM を docx Document に変換する。
 * 画像読み込みが非同期なので async。
 */
export async function htmlToDocx(
  container: HTMLElement,
  options?: { fontKey?: string; fontSize?: number }
): Promise<Document> {
  // プレビューのフォント設定を反映
  const fontKey = options?.fontKey || localStorage.getItem("md-preview-font") || "meiryo";
  const sizePx = options?.fontSize || parseInt(localStorage.getItem("md-preview-size") || "14");
  docxFont = DOCX_FONT_MAP[fontKey] || "Meiryo";
  docxFontSize = sizePx * 2; // px → half-points (概算: 14px ≈ 28 half-points = 14pt)

  const children: (Paragraph | Table)[] = [];

  // トップレベルのノードを走査
  const topNodes = container.querySelectorAll(
    ":scope > *"
  );

  // 内部 div（md-content）がある場合はそちらを使う
  let nodes: Element[] = Array.from(topNodes);
  const mdContent = container.querySelector("[class=''] , div:not([class])");
  if (mdContent && mdContent.children.length > 0) {
    nodes = Array.from(mdContent.children);
  }
  // fallback: container 直下に要素がなければ全子要素
  if (nodes.length === 0) {
    nodes = Array.from(container.children);
  }

  for (const el of nodes) {
    const tag = el.tagName;

    // 見出し
    if (HEADING_MAP[tag]) {
      children.push(
        new Paragraph({
          heading: HEADING_MAP[tag],
          children: parseInlineRuns(el),
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // 段落
    if (tag === "P") {
      // 画像を含む段落
      const img = el.querySelector("img");
      if (img) {
        const imgPara = await tryLoadImage(img as HTMLImageElement);
        if (imgPara) children.push(imgPara);
        // 画像以外のテキストもあれば別段落で
        const textContent = el.textContent?.trim();
        if (textContent) {
          children.push(new Paragraph({ children: parseInlineRuns(el) }));
        }
        continue;
      }
      children.push(new Paragraph({
        children: parseInlineRuns(el),
        spacing: { after: 120 },
      }));
      continue;
    }

    // テーブル
    if (tag === "TABLE") {
      children.push(convertTable(el));
      children.push(new Paragraph({ spacing: { after: 120 } })); // 後に空行
      continue;
    }

    // コードブロック
    if (tag === "PRE") {
      children.push(...convertCodeBlock(el));
      children.push(new Paragraph({ spacing: { after: 200 } }));
      continue;
    }

    // リスト
    if (tag === "UL" || tag === "OL") {
      const items = el.querySelectorAll(":scope > li");
      let idx = 1;
      for (const li of Array.from(items)) {
        children.push(convertListItem(li, tag === "OL", idx++));
      }
      children.push(new Paragraph({ spacing: { after: 120 } }));
      continue;
    }

    // blockquote
    if (tag === "BLOCKQUOTE") {
      const text = el.textContent || "";
      children.push(
        new Paragraph({
          children: [new TextRun({ text, italics: true, color: "6A737D", font: docxFont, size: docxFontSize })],
          indent: { left: 720 },
          border: { left: { style: BorderStyle.SINGLE, size: 6, color: "DFE2E5", space: 10 } },
          spacing: { after: 120 },
        })
      );
      continue;
    }

    // hr
    if (tag === "HR") {
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" } },
          spacing: { after: 200 },
        })
      );
      continue;
    }

    // Mermaid コンテナ（SVG画像として）
    if (el.classList.contains("mermaid-placeholder") || el.classList.contains("mermaid-container")) {
      const svg = el.querySelector("svg");
      if (svg) {
        try {
          const svgStr = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgStr], { type: "image/svg+xml" });
          const url = URL.createObjectURL(svgBlob);

          // Canvas でPNGに変換
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
            img.src = url;
          });

          const canvas = document.createElement("canvas");
          const w = svg.getBoundingClientRect().width || 800;
          const h = svg.getBoundingClientRect().height || 400;
          canvas.width = w * 2;
          canvas.height = h * 2;
          const ctx = canvas.getContext("2d")!;
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(url);

          const pngBlob = await new Promise<Blob>((res) =>
            canvas.toBlob((b) => res(b!), "image/png")
          );
          const pngBuf = new Uint8Array(await pngBlob.arrayBuffer());

          const maxW = 580;
          const scale = Math.min(1, maxW / w);
          children.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: pngBuf,
                  transformation: { width: Math.round(w * scale), height: Math.round(h * scale) },
                  type: "png",
                }),
              ],
              spacing: { after: 200 },
            })
          );
        } catch {
          // SVG変換失敗 → テキストとして
          children.push(new Paragraph({ children: [new TextRun({ text: "[Mermaid diagram]" })] }));
        }
      }
      continue;
    }

    // その他 → テキストとして
    const fallbackText = el.textContent?.trim();
    if (fallbackText) {
      children.push(new Paragraph({ children: [new TextRun({ text: fallbackText, font: docxFont, size: docxFontSize })] }));
    }
  }

  // 空の場合はダミー段落
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: {
            font: docxFont,
            size: docxFontSize,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });
}

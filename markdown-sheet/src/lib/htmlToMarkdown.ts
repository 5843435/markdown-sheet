/**
 * contentEditable 要素の innerHTML を Markdown に逆変換する。
 * インライン書式（bold, italic, code, link 等）を保持する。
 */

function nodeToMarkdown(node: Node): string {
  // テキストノード
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return node.textContent || "";
  }

  const el = node as HTMLElement;
  const tag = el.tagName;

  // インライン数式: <span class="math-inline" data-math="...">
  if (
    tag === "SPAN" &&
    el.classList.contains("math-inline") &&
    el.hasAttribute("data-math")
  ) {
    try {
      const encoded = el.getAttribute("data-math") || "";
      const math = decodeURIComponent(escape(atob(encoded)));
      return `$${math}$`;
    } catch {
      return el.textContent || "";
    }
  }

  // ブロック数式: <div class="math-block" data-math="...">
  if (
    tag === "DIV" &&
    el.classList.contains("math-block") &&
    el.hasAttribute("data-math")
  ) {
    try {
      const encoded = el.getAttribute("data-math") || "";
      const math = decodeURIComponent(escape(atob(encoded)));
      return `$$${math}$$`;
    } catch {
      return el.textContent || "";
    }
  }

  // 子ノードを再帰的に変換
  const childMd = Array.from(el.childNodes).map(nodeToMarkdown).join("");

  switch (tag) {
    case "STRONG":
    case "B":
      return `**${childMd}**`;
    case "EM":
    case "I":
      return `*${childMd}*`;
    case "DEL":
    case "S":
      return `~~${childMd}~~`;
    case "CODE":
      return `\`${childMd}\``;
    case "A": {
      const href = el.getAttribute("href") || "";
      return `[${childMd}](${href})`;
    }
    case "BR":
      return "\n";
    case "IMG": {
      const alt = el.getAttribute("alt") || "";
      const src = el.getAttribute("src") || "";
      return `![${alt}](${src})`;
    }
    // contentEditable が改行を <div> で囲むケース
    case "DIV":
      return childMd + "\n";
    // チェックボックス input は無視（LI プレフィックスで処理）
    case "INPUT":
      return "";
    default:
      return childMd;
  }
}

/**
 * innerHTML 文字列を Markdown テキストに変換する。
 */
export function htmlToMarkdown(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return nodeToMarkdown(div)
    .replace(/\n$/, ""); // 末尾の余分な改行を除去
}

/**
 * 編集された要素の tagName と innerHTML から、Markdown ソースブロックを再構築する。
 * originalLines は元のソース行（startLine〜endLine の範囲）。
 */
export function reconstructBlock(
  tagName: string,
  innerHTML: string,
  originalLines: string[]
): string {
  const md = htmlToMarkdown(innerHTML);
  const tag = tagName.toUpperCase();

  // 見出し: # prefix を付ける
  if (/^H[1-6]$/.test(tag)) {
    const depth = parseInt(tag.charAt(1));
    const prefix = "#".repeat(depth) + " ";
    // 見出しは単一行に
    return prefix + md.replace(/\n/g, " ");
  }

  // リストアイテム: 元の行からプレフィックスを抽出して保持
  if (tag === "LI") {
    const firstLine = originalLines[0] || "";
    // タスクリスト: "- [x] " or "- [ ] "
    const taskMatch = firstLine.match(
      /^(\s*(?:[-*+]|\d+\.)\s+)\[[ xX]\]\s*/
    );
    if (taskMatch) {
      return taskMatch[0] + md;
    }
    // 通常リスト: "- ", "* ", "1. " 等
    const prefixMatch = firstLine.match(/^(\s*(?:[-*+]|\d+\.)\s+)/);
    const prefix = prefixMatch ? prefixMatch[1] : "- ";
    return prefix + md;
  }

  // 段落: そのまま
  return md;
}

/**
 * Markdown テキスト中の数式記法をプレースホルダーに変換する。
 * コードフェンス / インラインコード内の $ は処理しない。
 */
export function preprocessMath(text: string): string {
  // コードフェンスとインラインコードを奇数インデックスに分離
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/);
  return parts
    .map((part, i) => {
      if (i % 2 === 1) return part; // コードブロック — そのまま返す

      // ブロック数式: $$...$$ (先に処理)
      part = part.replace(/\$\$([^$]+?)\$\$/gs, (_, math) => {
        const encoded = btoa(unescape(encodeURIComponent(math.trim())));
        return `<div class="math-block" data-math="${encoded}"></div>`;
      });

      // インライン数式: $...$
      part = part.replace(/\$([^$\n]+?)\$/g, (_, math) => {
        const encoded = btoa(unescape(encodeURIComponent(math.trim())));
        return `<span class="math-inline" data-math="${encoded}"></span>`;
      });

      return part;
    })
    .join("");
}

/**
 * 見出しテキストから anchor ID を生成する。
 * MarkdownPreview と OutlinePanel で同一ロジックを使用するため共通化。
 */
export function makeHeadingId(text: string): string {
  return (
    "heading-" +
    text
      .toLowerCase()
      .replace(/[^\w\s\u3040-\u9fff-]/g, "")
      .replace(/\s+/g, "-")
  );
}

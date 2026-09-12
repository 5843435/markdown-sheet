import { parseDocument } from "yaml";

export function splitFrontMatter(content: string) {
  const match = /^(?:\uFEFF)?---\r?\n([\s\S]*?)^---[\t ]*(?:\r?\n|$)/m.exec(content);
  if (!match || match.index !== 0) return null;
  return { yaml: match[1], body: content.slice(match[0].length),
    lineCount: (match[0].match(/\n/g) || []).length + (match[0].endsWith("\n") ? 0 : 1) };
}

export function extractFrontMatter(content: string): {
  meta: Record<string, unknown> | null; body: string;
} {
  const block = splitFrontMatter(content);
  if (!block) return { meta: null, body: content };
  try {
    const doc = parseDocument(block.yaml);
    if (doc.errors.length) throw new Error("Invalid YAML");
    const value: unknown = doc.toJS({ maxAliasCount: 0 });
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { meta: value as Record<string, unknown>, body: block.body };
    }
  } catch { /* Preserve unparseable metadata verbatim. */ }
  return { meta: { YAML: block.yaml.trimEnd() }, body: block.body };
}

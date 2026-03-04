/**
 * DOCX Exporter for markdown-sheet (Tauri)
 * Simplified async function version of the original class-based exporter.
 * No plugin system, no globalThis.platform dependencies.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
  type FileChild,
  type ParagraphChild,
  type IStylesOptions,
  type IBaseParagraphStyleOptions,
  type IDocumentDefaultsOptions,
  type IParagraphStylePropertiesOptions,
} from 'docx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { visit } from 'unist-util-visit';
import { loadThemeForDOCX } from './theme-loader';
import { mathJaxReady, convertLatex2Math } from './docx-math-converter';
import { createCodeHighlighter, type CodeHighlighter } from './docx-code-highlighter';
import { createTableConverter, type TableConverter } from './docx-table-converter';
import { createBlockquoteConverter, type BlockquoteConverter } from './docx-blockquote-converter';
import { createListConverter, createNumberingLevels, type ListConverter } from './docx-list-converter';
import { createInlineConverter, type InlineConverter, type InlineNode } from './docx-inline-converter';
import type {
  DOCXThemeStyles,
  DOCXHeadingStyle,
  DOCXASTNode,
  DOCXListNode,
  DOCXBlockquoteNode,
  DOCXTableNode,
  LinkDefinition,
  ImageBufferResult,
} from './types';

// ============================================================================
// Options
// ============================================================================

export interface ExportDocxOptions {
  /** Base directory for resolving relative image paths */
  baseDir?: string;
}

// ============================================================================
// Image fetching
// ============================================================================

const imageCache = new Map<string, ImageBufferResult>();

function guessContentType(url: string): string {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0] || '';
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp', svg: 'image/svg+xml',
  };
  return map[ext] || 'image/png';
}

async function fetchImageAsBuffer(url: string, baseDir?: string): Promise<ImageBufferResult> {
  if (imageCache.has(url)) return imageCache.get(url)!;

  // data: URL
  if (url.startsWith('data:')) {
    const match = url.match(/^data:([^;,]+)[^,]*,(.+)$/);
    if (!match) throw new Error('Invalid data URL format');
    const contentType = match[1];
    const binaryString = atob(match[2]);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const result: ImageBufferResult = { buffer: bytes, contentType };
    imageCache.set(url, result);
    return result;
  }

  const isNetworkUrl = url.startsWith('http://') || url.startsWith('https://');

  if (isNetworkUrl) {
    const resp = await fetch(url);
    const ab = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || guessContentType(url);
    const result: ImageBufferResult = { buffer: new Uint8Array(ab), contentType };
    imageCache.set(url, result);
    return result;
  }

  // Local file — use Tauri plugin-fs readFile
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs');
    let resolvedPath = url;
    // Resolve relative path against baseDir
    if (baseDir && !url.startsWith('/') && !url.match(/^[A-Za-z]:\\/)) {
      resolvedPath = baseDir.replace(/\\/g, '/').replace(/\/[^/]*$/, '') + '/' + url;
    }
    const bytes = await readFile(resolvedPath);
    const contentType = guessContentType(url);
    const result: ImageBufferResult = { buffer: bytes, contentType };
    imageCache.set(url, result);
    return result;
  } catch (error) {
    throw new Error(`Failed to read local image: ${url} - ${(error as Error).message}`);
  }
}

// ============================================================================
// Markdown parsing
// ============================================================================

function parseMarkdown(markdown: string): { ast: DOCXASTNode; linkDefinitions: Map<string, LinkDefinition> } {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMath);

  const ast = processor.parse(markdown);
  const transformed = processor.runSync(ast);

  const linkDefinitions = new Map<string, LinkDefinition>();
  visit(transformed, 'definition', (node) => {
    const defNode = node as { identifier?: string; url?: string; title?: string };
    if (defNode.identifier) {
      linkDefinitions.set(defNode.identifier.toLowerCase(), {
        url: defNode.url || '',
        title: defNode.title ?? null,
      });
    }
  });

  return { ast: transformed as DOCXASTNode, linkDefinitions };
}

// ============================================================================
// Alignment helper
// ============================================================================

function toAlignmentType(alignment?: string): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  if (!alignment) return undefined;
  const map: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
    left: AlignmentType.LEFT, center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED,
  };
  return map[alignment.trim().toLowerCase()];
}

function toDocumentDefaults(defaults: DOCXThemeStyles['default']): IDocumentDefaultsOptions {
  return {
    run: defaults.run,
    paragraph: defaults.paragraph
      ? { spacing: defaults.paragraph.spacing, alignment: toAlignmentType(defaults.paragraph.alignment) }
      : undefined,
  };
}

function toHeadingStyle(style: DOCXHeadingStyle): IBaseParagraphStyleOptions {
  return {
    name: style.name,
    basedOn: style.basedOn,
    next: style.next,
    run: style.run,
    paragraph: {
      spacing: style.paragraph.spacing,
      alignment: toAlignmentType(style.paragraph.alignment),
    },
  };
}

// ============================================================================
// Main export function
// ============================================================================

/**
 * Export Markdown content to DOCX format
 * @param markdown - Markdown source text
 * @param options - Export options
 * @returns Uint8Array of the DOCX file
 */
export async function exportMarkdownToDocx(
  markdown: string,
  options: ExportDocxOptions = {}
): Promise<Uint8Array> {
  // Load theme
  const themeStyles = await loadThemeForDOCX('default');

  // Initialize MathJax
  await mathJaxReady();

  // Parse markdown
  const { ast, linkDefinitions } = parseMarkdown(markdown);

  // Create code highlighter
  const codeHighlighter = createCodeHighlighter(themeStyles);

  // Mutable counters
  let listInstanceCounter = 0;

  // Create converters
  const inlineConverter = createInlineConverter({
    themeStyles,
    fetchImageAsBuffer: (url: string) => fetchImageAsBuffer(url, options.baseDir),
    reportResourceProgress: () => {},
    linkDefinitions,
    renderer: null,
    emojiStyle: 'system',
    linkColor: themeStyles.linkColor,
  });

  const tableConverter = createTableConverter({
    themeStyles,
    convertInlineNodes: (nodes, style) => inlineConverter.convertInlineNodes(nodes, style),
    mergeEmptyCells: true,
    tableLayout: 'center',
  });

  const blockquoteConverter = createBlockquoteConverter({
    themeStyles,
    convertInlineNodes: (nodes, style) => inlineConverter.convertInlineNodes(nodes, style),
  });

  const listConverter = createListConverter({
    themeStyles,
    convertInlineNodes: (nodes, style) => inlineConverter.convertInlineNodes(nodes, style),
    getListInstanceCounter: () => listInstanceCounter,
    incrementListInstanceCounter: () => listInstanceCounter++,
  });

  // ---- Recursive node converter ----

  async function convertNode(
    node: DOCXASTNode,
    parentStyle: Record<string, unknown> = {},
    listLevel = 0,
    blockquoteNestLevel = 0
  ): Promise<FileChild | FileChild[] | null> {
    switch (node.type) {
      case 'heading':
        return await convertHeading(node);
      case 'paragraph':
        return await convertParagraph(node, parentStyle);
      case 'list':
        return await listConverter.convertList(node as unknown as DOCXListNode);
      case 'code':
        return convertCodeBlock(node, listLevel, blockquoteNestLevel);
      case 'blockquote':
        return await blockquoteConverter.convertBlockquote(node as unknown as DOCXBlockquoteNode, listLevel);
      case 'table':
        return await tableConverter.convertTable(node as unknown as DOCXTableNode, listLevel);
      case 'thematicBreak':
        return convertThematicBreak();
      case 'html':
        return convertHtml();
      case 'math':
        return convertMathBlock(node);
      default:
        return null;
    }
  }

  // Wire up circular dependencies
  blockquoteConverter.setConvertChildNode((node, bqNest) => convertNode(node, {}, 0, bqNest));
  listConverter.setConvertChildNode((node, ll) => convertNode(node, {}, ll));

  // ---- Node converters ----

  async function convertHeading(node: DOCXASTNode): Promise<Paragraph> {
    const levels: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3, 4: HeadingLevel.HEADING_4,
      5: HeadingLevel.HEADING_5, 6: HeadingLevel.HEADING_6,
    };
    const depth = node.depth || 1;
    const headingStyle = themeStyles.paragraphStyles?.[`heading${depth}`];
    const children = await inlineConverter.convertInlineNodes(
      (node.children || []) as unknown as InlineNode[], {}
    );
    const config: {
      children?: ParagraphChild[]; text?: string;
      heading: (typeof HeadingLevel)[keyof typeof HeadingLevel];
      alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    } = { heading: levels[depth] || HeadingLevel.HEADING_1 };
    if (children.length > 0) config.children = children;
    else config.text = '';
    if (headingStyle?.paragraph?.alignment === 'center') config.alignment = AlignmentType.CENTER;
    return new Paragraph(config);
  }

  async function convertParagraph(node: DOCXASTNode, parentStyle: Record<string, unknown>): Promise<Paragraph> {
    const children = await inlineConverter.convertInlineNodes(
      (node.children || []) as unknown as InlineNode[], parentStyle
    );
    const spacing = themeStyles.default?.paragraph?.spacing || { before: 0, after: 200, line: 276 };
    return new Paragraph({
      children: children.length > 0 ? children : undefined,
      text: children.length === 0 ? '' : undefined,
      spacing: { before: spacing.before, after: spacing.after, line: spacing.line },
      alignment: AlignmentType.LEFT,
    });
  }

  function convertCodeBlock(node: DOCXASTNode, listLevel = 0, blockquoteNestLevel = 0): Paragraph {
    const runs = codeHighlighter.getHighlightedRunsForCode(node.value ?? '', node.lang);
    const codeBackground = themeStyles.characterStyles?.code?.background || 'F6F8FA';
    const borderSpace = 200;
    const baseIndent = listLevel > 0 ? convertInchesToTwip(0.5 * listLevel) : 0;
    const indentLeft = baseIndent + borderSpace;
    const blockquoteCompensation = blockquoteNestLevel > 0 ? 300 * blockquoteNestLevel : 0;
    const indentRight = borderSpace + blockquoteCompensation;
    return new Paragraph({
      children: runs,
      wordWrap: true,
      alignment: AlignmentType.LEFT,
      spacing: { before: 200, after: 200, line: 276 },
      shading: { fill: codeBackground },
      indent: { left: indentLeft, right: indentRight },
      border: {
        top: { color: 'E1E4E8', space: 10, style: BorderStyle.SINGLE, size: 6 },
        bottom: { color: 'E1E4E8', space: 10, style: BorderStyle.SINGLE, size: 6 },
        left: { color: 'E1E4E8', space: 10, style: BorderStyle.SINGLE, size: 6 },
        right: { color: 'E1E4E8', space: 10, style: BorderStyle.SINGLE, size: 6 },
      },
    });
  }

  function convertHtml(): Paragraph {
    return new Paragraph({
      children: [new TextRun({ text: '[HTML Content]', italics: true, color: '666666' })],
      alignment: AlignmentType.LEFT,
      spacing: { before: 120, after: 120 },
    });
  }

  function convertThematicBreak(): Paragraph {
    const spacing = themeStyles.default?.paragraph?.spacing || { before: 0, after: 200, line: 276 };
    return new Paragraph({
      text: '',
      alignment: AlignmentType.LEFT,
      spacing: { before: spacing.before, after: spacing.after, line: spacing.line },
    });
  }

  function convertMathBlock(node: DOCXASTNode): Paragraph {
    try {
      const math = convertLatex2Math(node.value || '');
      return new Paragraph({
        children: [math],
        spacing: { before: 120, after: 120 },
        alignment: AlignmentType.CENTER,
      });
    } catch (error) {
      console.warn('Math conversion error:', error);
      const codeStyle = themeStyles.characterStyles?.code || { font: 'Consolas', size: 20 };
      return new Paragraph({
        children: [new TextRun({ text: node.value || '', font: codeStyle.font, size: codeStyle.size })],
        alignment: AlignmentType.LEFT,
        spacing: { before: 120, after: 120 },
      });
    }
  }

  // ---- Build document ----

  const elements: FileChild[] = [];
  let lastNodeType: string | null = null;

  if (ast.children) {
    for (const node of ast.children) {
      // Spacing between consecutive tables / blockquotes
      if (node.type === 'table' && lastNodeType === 'table') {
        elements.push(new Paragraph({ text: '', spacing: { before: 120, after: 120, line: 240 } }));
      }
      if (node.type === 'blockquote' && lastNodeType === 'blockquote') {
        elements.push(new Paragraph({ text: '', spacing: { before: 120, after: 120, line: 240 } }));
      }

      const converted = await convertNode(node);
      if (converted) {
        if (Array.isArray(converted)) elements.push(...converted);
        else elements.push(converted);
      }
      lastNodeType = node.type;
    }
  }

  // Styles
  const paragraphStyles = Object.entries(themeStyles.paragraphStyles).map(([id, style]) => ({
    id,
    ...toHeadingStyle(style),
  }));

  const styles: IStylesOptions = {
    default: { document: toDocumentDefaults(themeStyles.default) },
    paragraphStyles,
  };

  const doc = new Document({
    creator: 'Markdown Sheet',
    lastModifiedBy: 'Markdown Sheet',
    numbering: {
      config: [{ reference: 'default-ordered-list', levels: createNumberingLevels() }],
    },
    styles,
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1), right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1), left: convertInchesToTwip(1),
          },
        },
      },
      children: elements,
    }],
  });

  // Pack to Uint8Array
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  imageCache.clear();
  return new Uint8Array(arrayBuffer);
}

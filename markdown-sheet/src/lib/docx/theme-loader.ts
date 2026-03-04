/**
 * Theme Loader for DOCX Export (Tauri environment)
 * Simplified version combining theme-to-docx.ts + theme-manager.ts
 * Loads theme JSON files via fetch() from public/themes/
 */

import { BorderStyle } from 'docx';
import type {
  DOCXThemeStyles,
  DOCXRunStyle,
  DOCXParagraphStyle,
  DOCXParagraphSpacing,
  DOCXHeadingStyle,
  DOCXCharacterStyle,
  DOCXTableStyle,
  DOCXTableBorders,
  DOCXBorder,
  DOCXCodeColors,
  BorderStyleValue,
} from './types';

// ============================================================================
// Type Definitions
// ============================================================================

interface HeadingConfig {
  fontFamily?: string;
  fontWeight?: string;
}

interface FontScheme {
  body: { fontFamily: string };
  headings: {
    fontFamily: string;
    fontWeight?: string;
    [key: string]: string | HeadingConfig | undefined;
  };
  code: { fontFamily: string };
}

interface ThemeConfig {
  fontScheme: FontScheme;
  layoutScheme: string;
  colorScheme: string;
  tableStyle: string;
  codeTheme: string;
}

interface LayoutHeadingConfig {
  fontSize: string;
  spacingBefore: string;
  spacingAfter: string;
  alignment?: 'left' | 'center' | 'right';
}

interface LayoutBlockConfig {
  spacingBefore?: string;
  spacingAfter?: string;
}

interface LayoutScheme {
  body: { fontSize: string; lineHeight: number };
  headings: Record<string, LayoutHeadingConfig>;
  code: { fontSize: string };
  blocks: {
    paragraph: LayoutBlockConfig;
  };
}

interface ColorScheme {
  text: { primary: string };
  headings?: Record<string, string>;
  background: { code: string };
  accent: { link: string };
  blockquote: { border: string };
  table: {
    border: string;
    headerBackground: string;
    headerText: string;
    zebraEven: string;
    zebraOdd: string;
  };
}

interface BorderConfig {
  style: string;
  width: string;
}

interface TableStyleConfig {
  border?: {
    all?: BorderConfig;
    headerTop?: BorderConfig;
    headerBottom?: BorderConfig;
    rowBottom?: BorderConfig;
    lastRowBottom?: BorderConfig;
  };
  header: { fontWeight?: string };
  cell: { padding: string };
  zebra?: { enabled: boolean };
}

interface CodeThemeConfig {
  colors: Record<string, string>;
  foreground?: string;
}

interface FontConfig {
  webFallback: string;
  docx?: { ascii: string; eastAsia: string };
}

interface FontConfigFile {
  fonts: Record<string, FontConfig>;
}

interface DocxFont {
  ascii: string;
  eastAsia: string;
  hAnsi: string;
  cs: string;
}

// ============================================================================
// Local utility functions (replaces themeManager.ptToHalfPt etc.)
// ============================================================================

function ptToHalfPt(ptSize: string): number {
  return parseFloat(ptSize) * 2;
}

function ptToTwips(ptSize: string | number): number {
  const pt = typeof ptSize === 'number' ? ptSize : parseFloat(String(ptSize));
  return Math.round(pt * 20);
}

let cachedFontConfig: FontConfigFile | null = null;

async function loadFontConfig(): Promise<FontConfigFile> {
  if (cachedFontConfig) return cachedFontConfig;
  const resp = await fetch('/themes/font-config.json');
  cachedFontConfig = await resp.json();
  return cachedFontConfig!;
}

function getDocxFont(fontName: string, fontConfig: FontConfigFile): DocxFont {
  const font = fontConfig.fonts[fontName];
  if (!font || !font.docx) {
    return { ascii: fontName, eastAsia: fontName, hAnsi: fontName, cs: fontName };
  }
  return {
    ascii: font.docx.ascii,
    eastAsia: font.docx.eastAsia,
    hAnsi: font.docx.ascii,
    cs: font.docx.ascii,
  };
}

// ============================================================================
// Style generation (from theme-to-docx.ts)
// ============================================================================

function generateDefaultStyle(
  fontScheme: FontScheme,
  layoutScheme: LayoutScheme,
  fontConfig: FontConfigFile
): { run: DOCXRunStyle; paragraph: DOCXParagraphStyle } {
  const bodyFont = fontScheme.body.fontFamily;
  const fontSize = ptToHalfPt(layoutScheme.body.fontSize);
  const lineSpacing = Math.round(layoutScheme.body.lineHeight * 240);
  const lineSpacingExtra = lineSpacing - 240;

  const paragraphBlock = layoutScheme.blocks.paragraph;
  const spacingBeforePt = parseFloat(paragraphBlock.spacingBefore || '0');
  const spacingAfterPt = parseFloat(paragraphBlock.spacingAfter || '0');

  const beforeSpacing = ptToTwips(spacingBeforePt) + Math.round(lineSpacingExtra / 2);
  const afterSpacing = Math.max(0, ptToTwips(spacingAfterPt) - Math.round(lineSpacingExtra / 2));

  const docxFont = getDocxFont(bodyFont, fontConfig);

  return {
    run: { font: docxFont, size: fontSize },
    paragraph: {
      spacing: { line: lineSpacing, before: beforeSpacing, after: afterSpacing },
    },
  };
}

function generateParagraphStyles(
  fontScheme: FontScheme,
  layoutScheme: LayoutScheme,
  colorScheme: ColorScheme,
  fontConfig: FontConfigFile
): Record<string, DOCXHeadingStyle> {
  const styles: Record<string, DOCXHeadingStyle> = {};
  const headingLevels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

  headingLevels.forEach((level, index) => {
    const headingLevel = index + 1;
    const fontHeading = fontScheme.headings[level] as HeadingConfig | undefined;
    const layoutHeading = layoutScheme.headings[level];

    const font = fontHeading?.fontFamily || fontScheme.headings.fontFamily || fontScheme.body.fontFamily;
    const docxFont = getDocxFont(font, fontConfig);
    const headingFontWeight = fontHeading?.fontWeight ?? fontScheme.headings.fontWeight ?? 'bold';
    const isBold = headingFontWeight === 'bold';

    const headingBeforePt = parseFloat(layoutHeading.spacingBefore || '0');
    const headingAfterPt = parseFloat(layoutHeading.spacingAfter || '0');
    const lineSpacingExtra = 360 - 240;

    const totalBefore = ptToTwips(headingBeforePt) + Math.round(lineSpacingExtra / 2);
    const totalAfter = Math.max(0, ptToTwips(headingAfterPt) - Math.round(lineSpacingExtra / 2));

    const headingColor = colorScheme.headings?.[level] || colorScheme.text.primary;

    styles[`heading${headingLevel}`] = {
      id: `Heading${headingLevel}`,
      name: `Heading ${headingLevel}`,
      basedOn: 'Normal',
      next: 'Normal',
      run: {
        size: ptToHalfPt(layoutHeading.fontSize),
        bold: isBold,
        font: docxFont,
        color: headingColor.replace('#', ''),
      },
      paragraph: {
        spacing: { before: totalBefore, after: totalAfter, line: 360 },
        alignment: layoutHeading.alignment || 'left',
      },
    };
  });

  return styles;
}

function generateCharacterStyles(
  fontScheme: FontScheme,
  layoutScheme: LayoutScheme,
  colorScheme: ColorScheme,
  fontConfig: FontConfigFile
): { code: DOCXCharacterStyle } {
  const codeFont = fontScheme.code.fontFamily;
  const codeBackground = colorScheme.background.code.replace('#', '');
  const docxFont = getDocxFont(codeFont, fontConfig);

  return {
    code: {
      font: docxFont,
      size: ptToHalfPt(layoutScheme.code.fontSize),
      background: codeBackground,
    },
  };
}

function convertBorderStyle(cssStyle: string): BorderStyleValue {
  const styleMap: Record<string, BorderStyleValue> = {
    none: BorderStyle.NONE,
    solid: BorderStyle.SINGLE,
    dashed: BorderStyle.DASHED,
    dotted: BorderStyle.DOTTED,
    double: BorderStyle.DOUBLE,
  };
  return styleMap[cssStyle] || BorderStyle.SINGLE;
}

function parseBorderWidth(width: string): number {
  const match = width.match(/^(\d+\.?\d*)(pt|px)$/);
  if (!match) return 8;
  const value = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'pt') return Math.round(value * 8);
  if (unit === 'px') return Math.round(value * 0.75 * 8);
  return 8;
}

function generateTableStyles(tableStyle: TableStyleConfig, colorScheme: ColorScheme): DOCXTableStyle {
  const docxTableStyle: DOCXTableStyle = {
    borders: {},
    header: {},
    cell: {},
    zebra: tableStyle.zebra?.enabled || false,
  };

  const borderColor = colorScheme.table.border.replace('#', '');
  const border = tableStyle.border || {};

  if (border.all) {
    docxTableStyle.borders.all = {
      style: convertBorderStyle(border.all.style),
      size: parseBorderWidth(border.all.width),
      color: borderColor,
    };
  }
  if (border.headerTop) {
    docxTableStyle.borders.headerTop = {
      style: convertBorderStyle(border.headerTop.style),
      size: parseBorderWidth(border.headerTop.width),
      color: borderColor,
    };
  }
  if (border.headerBottom) {
    docxTableStyle.borders.headerBottom = {
      style: convertBorderStyle(border.headerBottom.style),
      size: parseBorderWidth(border.headerBottom.width),
      color: borderColor,
    };
  }
  if (border.rowBottom) {
    docxTableStyle.borders.insideHorizontal = {
      style: convertBorderStyle(border.rowBottom.style),
      size: parseBorderWidth(border.rowBottom.width),
      color: borderColor,
    };
  }
  if (border.lastRowBottom) {
    docxTableStyle.borders.lastRowBottom = {
      style: convertBorderStyle(border.lastRowBottom.style),
      size: parseBorderWidth(border.lastRowBottom.width),
      color: borderColor,
    };
  }

  docxTableStyle.header.shading = { fill: colorScheme.table.headerBackground.replace('#', '') };
  docxTableStyle.header.color = colorScheme.table.headerText.replace('#', '');
  if (tableStyle.header.fontWeight) {
    docxTableStyle.header.bold = tableStyle.header.fontWeight === 'bold';
  }

  const paddingTwips = ptToTwips(tableStyle.cell.padding);
  docxTableStyle.cell.margins = {
    top: paddingTwips,
    bottom: paddingTwips,
    left: paddingTwips,
    right: paddingTwips,
  };

  if (tableStyle.zebra?.enabled) {
    docxTableStyle.zebra = {
      even: colorScheme.table.zebraEven.replace('#', ''),
      odd: colorScheme.table.zebraOdd.replace('#', ''),
    };
  }

  return docxTableStyle;
}

function generateCodeColors(codeTheme: CodeThemeConfig, colorScheme: ColorScheme): DOCXCodeColors {
  const colorMap: Record<string, string> = {};
  Object.keys(codeTheme.colors).forEach((token) => {
    colorMap[token] = codeTheme.colors[token];
  });

  return {
    background: colorScheme.background.code.replace('#', ''),
    foreground: codeTheme.foreground?.replace('#', '') || '24292e',
    colors: colorMap,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load theme and generate DOCX styles
 * Uses fetch() to load theme JSON files from public/themes/
 * @param themeId - Theme preset ID (default: 'default')
 * @returns Complete DOCX theme styles
 */
export async function loadThemeForDOCX(themeId = 'default'): Promise<DOCXThemeStyles> {
  const fontConfig = await loadFontConfig();

  // Load theme preset
  const themeResp = await fetch(`/themes/presets/${themeId}.json`);
  const theme: ThemeConfig = await themeResp.json();

  // Load sub-resources in parallel
  const [layoutScheme, colorScheme, tableStyle, codeTheme] = await Promise.all([
    fetch(`/themes/layout-schemes/${theme.layoutScheme}.json`).then((r) => r.json()) as Promise<LayoutScheme>,
    fetch(`/themes/color-schemes/${theme.colorScheme}.json`).then((r) => r.json()) as Promise<ColorScheme>,
    fetch(`/themes/table-styles/${theme.tableStyle}.json`).then((r) => r.json()) as Promise<TableStyleConfig>,
    fetch(`/themes/code-themes/${theme.codeTheme}.json`).then((r) => r.json()) as Promise<CodeThemeConfig>,
  ]);

  return {
    default: generateDefaultStyle(theme.fontScheme, layoutScheme, fontConfig),
    paragraphStyles: generateParagraphStyles(theme.fontScheme, layoutScheme, colorScheme, fontConfig),
    characterStyles: generateCharacterStyles(theme.fontScheme, layoutScheme, colorScheme, fontConfig),
    tableStyles: generateTableStyles(tableStyle, colorScheme),
    codeColors: generateCodeColors(codeTheme, colorScheme),
    linkColor: colorScheme.accent.link.replace('#', ''),
    blockquoteColor: colorScheme.blockquote.border.replace('#', ''),
  };
}

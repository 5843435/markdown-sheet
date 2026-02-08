use serde::{Deserialize, Serialize};

/// Markdown ドキュメント内の1つのテーブルを表す構造体
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarkdownTable {
    /// テーブル直前の見出しテキスト（あれば）
    pub heading: Option<String>,
    /// ヘッダー行のセル値
    pub headers: Vec<String>,
    /// アライメント情報 (left / center / right / none)
    pub alignments: Vec<String>,
    /// ボディ行: 各行はセル値の配列
    pub rows: Vec<Vec<String>>,
    /// ドキュメント内でのテーブル開始行番号
    pub start_line: usize,
    /// ドキュメント内でのテーブル終了行番号
    pub end_line: usize,
}

/// Markdown ドキュメント全体のパース結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedDocument {
    /// 元のファイル全文（行単位）
    pub lines: Vec<String>,
    /// 抽出されたテーブル群
    pub tables: Vec<MarkdownTable>,
}

/// パイプ区切り行をセル値の配列にパースする
fn parse_row(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    // 先頭・末尾のパイプを除去してからスプリット
    let inner = trimmed
        .strip_prefix('|')
        .unwrap_or(trimmed)
        .strip_suffix('|')
        .unwrap_or(trimmed);
    inner.split('|').map(|s| s.trim().to_string()).collect()
}

/// セパレーター行かどうかを判定する (例: |---|:---:|---:|)
fn is_separator_line(line: &str) -> bool {
    let trimmed = line.trim();
    if !trimmed.contains('|') {
        return false;
    }
    let inner = trimmed
        .strip_prefix('|')
        .unwrap_or(trimmed)
        .strip_suffix('|')
        .unwrap_or(trimmed);
    inner.split('|').all(|cell| {
        let c = cell.trim();
        if c.is_empty() {
            return false;
        }
        c.chars().all(|ch| ch == '-' || ch == ':')
    })
}

/// セパレーター行からアライメント情報を抽出する
fn parse_alignments(line: &str) -> Vec<String> {
    let trimmed = line.trim();
    let inner = trimmed
        .strip_prefix('|')
        .unwrap_or(trimmed)
        .strip_suffix('|')
        .unwrap_or(trimmed);
    inner
        .split('|')
        .map(|cell| {
            let c = cell.trim();
            let left = c.starts_with(':');
            let right = c.ends_with(':');
            match (left, right) {
                (true, true) => "center".to_string(),
                (false, true) => "right".to_string(),
                (true, false) => "left".to_string(),
                _ => "none".to_string(),
            }
        })
        .collect()
}

/// テーブル行かどうか（パイプを含む非空行）
fn is_table_line(line: &str) -> bool {
    let trimmed = line.trim();
    !trimmed.is_empty() && trimmed.contains('|')
}

/// Markdown テキスト全文をパースし、テーブル群を抽出する
pub fn parse_markdown(content: &str) -> ParsedDocument {
    let lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();
    let mut tables: Vec<MarkdownTable> = Vec::new();
    let mut i = 0;
    let len = lines.len();
    let mut last_heading: Option<String> = None;

    while i < len {
        let trimmed = lines[i].trim();

        // 見出しを追跡
        if trimmed.starts_with('#') {
            last_heading = Some(trimmed.trim_start_matches('#').trim().to_string());
            i += 1;
            continue;
        }

        // テーブルの開始を検出: ヘッダー行 + セパレーター行
        if i + 1 < len && is_table_line(&lines[i]) && is_separator_line(&lines[i + 1]) {
            let start_line = i;
            let headers = parse_row(&lines[i]);
            let alignments = parse_alignments(&lines[i + 1]);
            let mut rows: Vec<Vec<String>> = Vec::new();

            let mut j = i + 2;
            while j < len && is_table_line(&lines[j]) && !is_separator_line(&lines[j]) {
                let mut row = parse_row(&lines[j]);
                // 列数をヘッダーに合わせる
                row.resize(headers.len(), String::new());
                row.truncate(headers.len());
                rows.push(row);
                j += 1;
            }

            tables.push(MarkdownTable {
                heading: last_heading.clone(),
                headers,
                alignments,
                rows,
                start_line,
                end_line: j - 1,
            });

            i = j;
            continue;
        }

        i += 1;
    }

    ParsedDocument { lines, tables }
}

/// テーブルを Markdown テキストに変換する
pub fn serialize_table(table: &MarkdownTable) -> String {
    let col_count = table.headers.len();

    // 各列の最大幅を計算
    let mut widths: Vec<usize> = table.headers.iter().map(|h| h.len().max(3)).collect();
    for row in &table.rows {
        for (ci, cell) in row.iter().enumerate() {
            if ci < col_count {
                widths[ci] = widths[ci].max(cell.len());
            }
        }
    }

    let mut out = String::new();

    // ヘッダー行
    out.push('|');
    for (ci, header) in table.headers.iter().enumerate() {
        let w = widths.get(ci).copied().unwrap_or(3);
        out.push_str(&format!(" {:<width$} |", header, width = w));
    }
    out.push('\n');

    // セパレーター行
    out.push('|');
    for ci in 0..col_count {
        let w = widths.get(ci).copied().unwrap_or(3);
        let align = table
            .alignments
            .get(ci)
            .map(|s| s.as_str())
            .unwrap_or("none");
        let sep = match align {
            "left" => format!(":{}-|", "-".repeat(w)),
            "right" => format!(" {}:|", "-".repeat(w)),
            "center" => format!(":{}:|", "-".repeat(w)),
            _ => format!(" {}-|", "-".repeat(w)),
        };
        out.push_str(&sep);
    }
    out.push('\n');

    // データ行
    for row in &table.rows {
        out.push('|');
        for ci in 0..col_count {
            let w = widths.get(ci).copied().unwrap_or(3);
            let cell = row.get(ci).map(|s| s.as_str()).unwrap_or("");
            out.push_str(&format!(" {:<width$} |", cell, width = w));
        }
        out.push('\n');
    }

    out
}

/// ドキュメント全体を再構築する（テーブル部分を更新済みテーブルで置換）
pub fn rebuild_document(original_lines: &[String], tables: &[MarkdownTable]) -> String {
    if tables.is_empty() {
        return original_lines.join("\n");
    }

    let mut result = String::new();
    let mut cursor = 0;

    for table in tables {
        // テーブル前のテキストをそのまま出力
        for line in &original_lines[cursor..table.start_line] {
            result.push_str(line);
            result.push('\n');
        }
        // 更新されたテーブルを出力
        result.push_str(&serialize_table(table));
        cursor = table.end_line + 1;
    }

    // 最後のテーブル以降のテキスト
    for line in &original_lines[cursor..] {
        result.push_str(line);
        result.push('\n');
    }

    // 末尾の余分な改行を除去
    if result.ends_with('\n') && !original_lines.last().map_or(false, |l| l.is_empty()) {
        result.pop();
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_table() {
        let md = "# Test\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n";
        let doc = parse_markdown(md);
        assert_eq!(doc.tables.len(), 1);
        assert_eq!(doc.tables[0].headers, vec!["A", "B"]);
        assert_eq!(doc.tables[0].rows.len(), 2);
    }

    #[test]
    fn test_roundtrip() {
        let md = "# Heading\n\n| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |\n";
        let doc = parse_markdown(md);
        let rebuilt = rebuild_document(&doc.lines, &doc.tables);
        // パースし直して同じテーブルが取れることを確認
        let doc2 = parse_markdown(&rebuilt);
        assert_eq!(doc2.tables[0].headers, doc.tables[0].headers);
        assert_eq!(doc2.tables[0].rows, doc.tables[0].rows);
    }
}

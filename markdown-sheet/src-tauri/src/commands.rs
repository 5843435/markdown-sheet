use crate::markdown_parser::{parse_markdown, rebuild_document, MarkdownTable, ParsedDocument};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// ファイルツリーのエントリ
#[derive(Debug, Serialize, Deserialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}

/// ディレクトリを再帰的に読み取り、.md ファイルとフォルダのみ返す
fn read_dir_recursive(dir: &Path, depth: u32) -> Vec<FileEntry> {
    if depth > 5 {
        return Vec::new();
    }
    let mut entries = Vec::new();
    let Ok(read_dir) = fs::read_dir(dir) else {
        return entries;
    };

    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by_key(|e| e.file_name());

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // 隠しフォルダ/ファイルをスキップ
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let children = read_dir_recursive(&path, depth + 1);
            // .md を含むフォルダのみ表示
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                });
            }
        } else if name.ends_with(".md") {
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }
    entries
}

/// ディレクトリのファイルツリーを取得する Tauri コマンド
#[tauri::command]
pub fn get_file_tree(dir_path: String) -> Result<Vec<FileEntry>, String> {
    let path = Path::new(&dir_path);
    if !path.exists() || !path.is_dir() {
        return Err("ディレクトリが存在しません".to_string());
    }
    Ok(read_dir_recursive(path, 0))
}

/// Markdown ファイルを読み込んでパースする Tauri コマンド
#[tauri::command]
pub fn read_markdown_file(file_path: String) -> Result<ParsedDocument, String> {
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    Ok(parse_markdown(&content))
}

/// テーブルを更新して Markdown ファイルに書き戻す Tauri コマンド
#[tauri::command]
pub fn save_markdown_file(
    file_path: String,
    original_lines: Vec<String>,
    tables: Vec<MarkdownTable>,
) -> Result<(), String> {
    let content = rebuild_document(&original_lines, &tables);
    fs::write(&file_path, content).map_err(|e| e.to_string())
}

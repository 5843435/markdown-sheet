pub mod commands;
pub mod markdown_parser;

use commands::{get_file_tree, get_initial_file, read_markdown_file, save_markdown_file};
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // 2回目以降の起動時: ファイルパスを既存ウィンドウに送る
            if let Some(file_path) = args.get(1) {
                if file_path.to_lowercase().ends_with(".md")
                    || file_path.to_lowercase().ends_with(".markdown")
                {
                    let _ = app.emit("open-file", file_path.clone());
                }
            }
            // 既存ウィンドウを前面に
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![
            get_file_tree,
            get_initial_file,
            read_markdown_file,
            save_markdown_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

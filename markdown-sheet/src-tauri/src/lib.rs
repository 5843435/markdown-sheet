pub mod commands;
pub mod markdown_parser;

use commands::{get_file_tree, read_markdown_file, save_markdown_file};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_file_tree,
            read_markdown_file,
            save_markdown_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

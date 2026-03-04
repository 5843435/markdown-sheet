pub mod commands;
pub mod file_watcher;
pub mod markdown_parser;
pub mod pty_manager;

use commands::{get_file_tree, read_markdown_file, save_markdown_file};
use file_watcher::{watch_file, unwatch_file, FileWatcherState};
use pty_manager::{kill_pty, resize_pty, spawn_pty, write_to_pty, PtyManager};
use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Arc::new(Mutex::new(PtyManager::new())))
        .manage(Arc::new(Mutex::new(FileWatcherState::new())))
        .invoke_handler(tauri::generate_handler![
            get_file_tree,
            read_markdown_file,
            save_markdown_file,
            spawn_pty,
            write_to_pty,
            resize_pty,
            kill_pty,
            watch_file,
            unwatch_file,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let mgr: Arc<Mutex<PtyManager>> = {
                    let state: tauri::State<'_, Arc<Mutex<PtyManager>>> = window.state();
                    Arc::clone(&state)
                };
                let guard = mgr.lock();
                if let Ok(mut m) = guard {
                    m.kill_all();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

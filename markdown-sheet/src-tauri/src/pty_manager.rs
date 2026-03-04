use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

static NEXT_SESSION_ID: AtomicU64 = AtomicU64::new(1);

pub struct PtySession {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

pub struct PtyManager {
    sessions: HashMap<String, PtySession>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn kill_all(&mut self) {
        self.sessions.clear();
    }
}

#[tauri::command]
pub fn spawn_pty(
    app: AppHandle,
    state: State<'_, Arc<Mutex<PtyManager>>>,
    cwd: String,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new("powershell.exe");
    cmd.arg("-NoLogo");
    cmd.cwd(&cwd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    drop(pair.slave);

    let session_id = format!("pty-{}", NEXT_SESSION_ID.fetch_add(1, Ordering::Relaxed));
    let id_clone = session_id.clone();

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Reader thread: read PTY output and emit events
    let app_clone = app.clone();
    let id_for_reader = session_id.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let encoded = BASE64.encode(&buf[..n]);
                    let event_name = format!("pty-output-{}", id_for_reader);
                    let _ = app_clone.emit(&event_name, encoded);
                }
                Err(_) => break,
            }
        }
        let exit_event = format!("pty-exit-{}", id_for_reader);
        let _ = app_clone.emit(&exit_event, ());
    });

    // Child wait thread (just to reap the process)
    std::thread::spawn(move || {
        let mut child = child;
        let _ = child.wait();
    });

    let session = PtySession {
        master: pair.master,
        writer,
    };

    {
        let mut mgr = state.lock().map_err(|e| e.to_string())?;
        mgr.sessions.insert(session_id.clone(), session);
    }

    Ok(id_clone)
}

#[tauri::command]
pub fn write_to_pty(
    state: State<'_, Arc<Mutex<PtyManager>>>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| e.to_string())?;
    let session = mgr
        .sessions
        .get_mut(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    session.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, Arc<Mutex<PtyManager>>>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let mgr = state.lock().map_err(|e| e.to_string())?;
    let session = mgr
        .sessions
        .get(&session_id)
        .ok_or_else(|| "Session not found".to_string())?;
    session
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn kill_pty(
    state: State<'_, Arc<Mutex<PtyManager>>>,
    session_id: String,
) -> Result<(), String> {
    let mut mgr = state.lock().map_err(|e| e.to_string())?;
    mgr.sessions.remove(&session_id);
    Ok(())
}

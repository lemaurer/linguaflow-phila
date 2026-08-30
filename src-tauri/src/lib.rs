use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde_json::{json, Value};
use std::{
    fs,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Default)]
struct AudioControl {
    generation: u64,
    active: Option<(Child, PathBuf)>,
}

#[derive(Default)]
struct AudioState(Mutex<AudioControl>);

fn stop_native_audio(control: &mut AudioControl) {
    if let Some((mut child, path)) = control.active.take() {
        let _ = child.kill();
        let _ = child.wait();
        let _ = fs::remove_file(path);
    }
}

#[tauri::command]
fn stop_audio(state: tauri::State<'_, AudioState>, request: u64) {
    if let Ok(mut control) = state.0.lock() {
        if request >= control.generation {
            control.generation = request;
            stop_native_audio(&mut control);
        }
    }
}

#[tauri::command]
fn open_feedback_email(url: String) -> Result<(), String> {
    if !url.starts_with("mailto:leif.maurer@gmail.com?") {
        return Err("Ungültige Feedback-Adresse.".to_string());
    }
    Command::new("/usr/bin/open")
        .arg(url)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|error| format!("E-Mail-Programm konnte nicht geöffnet werden: {error}"))
}

#[tauri::command]
fn play_audio(
    state: tauri::State<'_, AudioState>,
    filename: String,
    base64_data: String,
    request: u64,
) -> Result<(), String> {
    let extension = PathBuf::from(&filename)
        .extension()
        .and_then(|value| value.to_str())
        .filter(|value| matches!(value.to_ascii_lowercase().as_str(), "mp3" | "m4a" | "wav" | "ogg" | "aac"))
        .unwrap_or("m4a")
        .to_string();
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let path = std::env::temp_dir().join(format!("linguaflow-audio-{}-{unique}.{extension}", std::process::id()));
    let bytes = BASE64.decode(base64_data).map_err(|error| format!("Audio konnte nicht dekodiert werden: {error}"))?;
    fs::write(&path, bytes).map_err(|error| format!("Audio konnte nicht vorbereitet werden: {error}"))?;
    let mut control = state.0.lock().map_err(|_| "Audio-Player ist blockiert.".to_string())?;
    if request < control.generation {
        let _ = fs::remove_file(path);
        return Ok(());
    }
    stop_native_audio(&mut control);
    let child = Command::new("/usr/bin/afplay")
        .arg(&path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Audio konnte nicht gestartet werden: {error}"))?;
    control.generation = request;
    control.active = Some((child, path));
    Ok(())
}

#[tauri::command]
async fn anki_invoke(window: tauri::WebviewWindow, action: String, params: Option<Value>) -> Result<Value, String> {
    let should_refocus = matches!(action.as_str(), "guiDeckReview" | "guiShowAnswer" | "guiAnswerCard" | "guiCurrentCard" | "guiStartCardTimer");
    let timeout = if action == "sync" { Duration::from_secs(180) } else { Duration::from_secs(15) };
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("Anki-Verbindung konnte nicht vorbereitet werden: {error}"))?;

    let response = client
        .post("http://127.0.0.1:8765")
        .json(&json!({
            "action": action,
            "version": 6,
            "params": params.unwrap_or_else(|| json!({}))
        }))
        .send()
        .await
        .map_err(|_| "Anki ist nicht erreichbar. Bitte Anki öffnen und AnkiConnect aktivieren.".to_string())?;

    let payload: Value = response
        .json()
        .await
        .map_err(|error| format!("Ungültige Antwort von Anki: {error}"))?;

    if let Some(error) = payload.get("error").and_then(Value::as_str) {
        return Err(error.to_string());
    }

    if should_refocus {
        let _ = window.show();
        let _ = window.set_focus();
    }

    Ok(payload.get("result").cloned().unwrap_or(Value::Null))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AudioState::default())
        .invoke_handler(tauri::generate_handler![anki_invoke, play_audio, stop_audio, open_feedback_email])
        .run(tauri::generate_context!())
        .expect("error while running LinguaFlow");
}

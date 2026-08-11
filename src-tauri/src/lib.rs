use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, TitleBarStyle, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

const DEFAULT_PORT: &str = "4737";
// Bundler source path is `binaries/broadcast-server` in tauri.conf.json, but Tauri
// copies the binary next to the app executable as just `broadcast-server`.
const SIDECAR_NAME: &str = "broadcast-server";

struct SidecarState(Mutex<Option<CommandChild>>);

fn project_root() -> PathBuf {
  let mut dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
  if dir.ends_with("src-tauri") {
    dir.pop();
  }
  dir
}

fn resolve_app_root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  if cfg!(debug_assertions) {
    return Ok(project_root());
  }

  app
    .path()
    .resource_dir()
    .map_err(|e| format!("resource dir: {e}"))
}

fn parse_ready_url(line: &str) -> Option<String> {
  let trimmed = line.trim();
  let rest = trimmed.strip_prefix("READY ")?;
  if rest.starts_with("http://") || rest.starts_with("https://") {
    Some(rest.to_string())
  } else {
    None
  }
}

fn navigate_main(app: &tauri::AppHandle, origin: &str) {
  let home_url = format!("{origin}/");
  match Url::parse(&home_url) {
    Ok(url) => {
      if let Some(window) = app.get_webview_window("main") {
        if let Err(err) = window.navigate(url) {
          log::error!("navigate failed: {err}");
        } else {
          log::info!("navigated to {home_url}");
        }
      } else {
        log::error!("main window missing; cannot navigate to {home_url}");
      }
    }
    Err(err) => log::error!("invalid home url {home_url}: {err}"),
  }
}

fn health_ok(port: &str) -> bool {
  let Ok(mut stream) = TcpStream::connect(format!("127.0.0.1:{port}")) else {
    return false;
  };
  let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
  let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
  let request = format!(
    "GET /api/control/health HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
  );
  if stream.write_all(request.as_bytes()).is_err() {
    return false;
  }
  let mut buf = [0_u8; 128];
  let Ok(n) = stream.read(&mut buf) else {
    return false;
  };
  let body = String::from_utf8_lossy(&buf[..n]);
  body.contains("200")
}

fn spawn_sidecar(app: &tauri::AppHandle) -> Result<(), String> {
  let app_root = resolve_app_root(app)?;
  let app_data = app
    .path()
    .app_data_dir()
    .map_err(|e| format!("app data dir: {e}"))?;
  std::fs::create_dir_all(&app_data).map_err(|e| format!("create app data: {e}"))?;

  let db_path = app_data.join("controller.db");
  let port = std::env::var("PORT").unwrap_or_else(|_| DEFAULT_PORT.to_string());

  log::info!("sidecar APP_ROOT={}", app_root.display());
  log::info!("sidecar CONTROLLER_DB={}", db_path.display());
  log::info!("sidecar PORT={port}");

  let sidecar = app
    .shell()
    .sidecar(SIDECAR_NAME)
    .map_err(|e| format!("resolve sidecar: {e}"))?
    .current_dir(&app_root)
    .env("APP_ROOT", app_root.as_os_str())
    .env("CONTROLLER_DB", db_path.as_os_str())
    .env("PORT", &port);

  let (mut rx, child) = sidecar.spawn().map_err(|e| format!("spawn sidecar: {e}"))?;

  {
    let state = app.state::<SidecarState>();
    let mut guard = state.0.lock().map_err(|_| "sidecar state lock poisoned")?;
    *guard = Some(child);
  }

  let navigated = std::sync::Arc::new(AtomicBool::new(false));

  let handle = app.clone();
  let navigated_stdout = navigated.clone();
  tauri::async_runtime::spawn(async move {
    while let Some(event) = rx.recv().await {
      match event {
        CommandEvent::Stdout(line_bytes) => {
          let line = String::from_utf8_lossy(&line_bytes);
          for part in line.split('\n') {
            if part.trim().is_empty() {
              continue;
            }
            log::info!("[sidecar] {part}");
            if !navigated_stdout.load(Ordering::SeqCst) {
              if let Some(origin) = parse_ready_url(part) {
                navigate_main(&handle, &origin);
                navigated_stdout.store(true, Ordering::SeqCst);
              }
            }
          }
        }
        CommandEvent::Stderr(line_bytes) => {
          let line = String::from_utf8_lossy(&line_bytes);
          for part in line.split('\n') {
            if !part.trim().is_empty() {
              log::warn!("[sidecar:err] {part}");
            }
          }
        }
        CommandEvent::Terminated(payload) => {
          log::warn!("sidecar terminated: {payload:?}");
          break;
        }
        CommandEvent::Error(err) => {
          log::error!("sidecar error: {err}");
          break;
        }
        _ => {}
      }
    }
  });

  // Fallback if READY line is missed (buffered/merged stdout).
  let handle = app.clone();
  let health_port = port.clone();
  let navigated_health = navigated.clone();
  tauri::async_runtime::spawn(async move {
    for _ in 0..80 {
      if navigated_health.load(Ordering::SeqCst) {
        break;
      }
      let port = health_port.clone();
      let ok = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(Duration::from_millis(250));
        health_ok(&port)
      })
      .await
      .unwrap_or(false);
      if ok && !navigated_health.swap(true, Ordering::SeqCst) {
        navigate_main(&handle, &format!("http://127.0.0.1:{health_port}"));
        break;
      }
    }
  });

  Ok(())
}

fn kill_sidecar(app: &tauri::AppHandle) {
  if let Some(state) = app.try_state::<SidecarState>() {
    if let Ok(mut guard) = state.0.lock() {
      if let Some(child) = guard.take() {
        let _ = child.kill();
      }
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(SidecarState(Mutex::new(None)))
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let win_builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
        .title("HYDRA // GFX")
        .inner_size(1440.0, 900.0)
        .resizable(true);

      // Transparent title bar only on macOS (content draws under the traffic lights).
      #[cfg(target_os = "macos")]
      let win_builder = win_builder.title_bar_style(TitleBarStyle::Transparent);

      let window = win_builder.build()?;

      // Match the loading / control surface so the titlebar area isn't white.
      #[cfg(target_os = "macos")]
      {
        use objc2_app_kit::{NSColor, NSWindow};

        let ns_window_ptr = window.ns_window().unwrap() as *mut NSWindow;
        let ns_window = unsafe { &*ns_window_ptr };
        // #0b1220 — same as loading/index.html
        let bg_color =
          NSColor::colorWithRed_green_blue_alpha(11.0 / 255.0, 18.0 / 255.0, 32.0 / 255.0, 1.0);
        ns_window.setBackgroundColor(Some(&bg_color));
      }

      #[cfg(not(target_os = "macos"))]
      let _ = window;

      if let Err(err) = spawn_sidecar(app.handle()) {
        log::error!("failed to start sidecar: {err}");
      }

      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| {
      if let RunEvent::Exit = event {
        kill_sidecar(app_handle);
      }
    });
}

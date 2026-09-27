//! Guards on the app's Tauri config. These catch edits that compile and run
//! fine but quietly break security or startup.

use serde_json::Value;

fn read_json(path: &str) -> Value {
    let full = format!("{}/{path}", env!("CARGO_MANIFEST_DIR"));
    let text = std::fs::read_to_string(&full).unwrap_or_else(|e| panic!("{full}: {e}"));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{full}: {e}"))
}

/// Paths allowed by each scoped permission whose identifier contains `needle`.
fn scoped_paths(capability: &Value, needle: &str) -> Vec<String> {
    capability["permissions"]
        .as_array()
        .expect("permissions array")
        .iter()
        .filter(|p| {
            p["identifier"]
                .as_str()
                .is_some_and(|id| id.contains(needle))
        })
        .flat_map(|p| p["allow"].as_array().cloned().unwrap_or_default())
        .map(|a| a["path"].as_str().expect("allow path").to_owned())
        .collect()
}

fn product_name() -> String {
    read_json("tauri.conf.json")["productName"]
        .as_str()
        .expect("productName")
        .to_owned()
}

#[test]
fn frontend_can_only_write_inside_the_settings_folder() {
    let capability = read_json("capabilities/default.json");
    // The folder is the lowercase app name; productName is its display title.
    let settings_dir = format!("$HOME/.{}", product_name().to_lowercase());
    for needle in ["write", "mkdir", "remove", "rename", "copy", "truncate"] {
        for path in scoped_paths(&capability, needle) {
            assert!(
                path == settings_dir || path.starts_with(&format!("{settings_dir}/")),
                "fs permission matching {needle:?} allows {path:?}, outside {settings_dir}"
            );
        }
    }
}

#[test]
fn no_unscoped_fs_write_permissions() {
    // A bare string like "fs:allow-write-text-file" has no scope and would
    // fall back to whatever global scope exists; writes must always be scoped.
    let capability = read_json("capabilities/default.json");
    for permission in capability["permissions"].as_array().unwrap() {
        if let Some(id) = permission.as_str() {
            assert!(
                !(id.starts_with("fs:") && (id.contains("write") || id.contains("remove"))),
                "unscoped fs permission {id:?}"
            );
        }
    }
}

#[test]
fn main_window_starts_hidden_with_overlay_title_bar() {
    // The frontend sizes the window to the screen, then shows it; a visible
    // window would flash at the wrong size first.
    let window = &read_json("tauri.conf.json")["app"]["windows"][0];
    assert_eq!(window["visible"], false);
    assert_eq!(window["titleBarStyle"], "Overlay");
    assert_eq!(window["hiddenTitle"], true);
}

#[test]
fn capability_applies_to_every_window() {
    // Extra windows get labels like "window-<timestamp>"; a capability scoped
    // to "main" alone would leave them without any permissions.
    let capability = read_json("capabilities/default.json");
    assert_eq!(capability["windows"], serde_json::json!(["*"]));
}

#[test]
fn frontend_can_only_start_the_pi_sidecar() {
    // Spawning processes from the web view is the riskiest permission we
    // grant: it must name one command with one fixed script argument.
    let capability = read_json("capabilities/default.json");
    let permissions = capability["permissions"].as_array().unwrap();

    for id in ["shell:default", "shell:allow-execute", "shell:allow-open"] {
        assert!(
            !permissions.iter().any(|p| p.as_str() == Some(id)),
            "{id} must not be granted"
        );
    }

    let spawn: Vec<&Value> = permissions
        .iter()
        .filter(|p| p["identifier"] == "shell:allow-spawn")
        .flat_map(|p| p["allow"].as_array().unwrap())
        .collect();
    assert_eq!(spawn.len(), 1, "exactly one spawnable command");
    assert_eq!(spawn[0]["cmd"], "node");
    let args = spawn[0]["args"].as_array().expect("fixed argument list");
    assert_eq!(args.len(), 1);
    let validator = args[0]["validator"].as_str().expect("argument validator");
    assert!(validator.ends_with("/sidecar/main\\.ts$"), "{validator}");
}

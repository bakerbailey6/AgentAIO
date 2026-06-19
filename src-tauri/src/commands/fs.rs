//! Filesystem commands for the built-in `file_read` / `file_write` tools (§8.2).
//!
//! The front-end tools ([`src/lib/tools/built-in/file-read.ts`],
//! [`file-write.ts`]) already enforce the agent's `PermissionScope.allowedPaths`
//! before invoking these commands, but the renderer is untrusted: a compromised
//! or buggy caller could ask to read `/etc/passwd`. So the allow-list is passed
//! down and **re-checked here** (defense in depth) via [`is_within_allowed`],
//! which compares *lexically normalized* paths so `..` traversal can't escape an
//! allowed root. The AppHandle-free helpers (`read_text`, `write_text`,
//! `is_within_allowed`, `normalize_lexical`) are unit-tested against temp dirs;
//! the `#[command]`s are thin wrappers. The TS bridge lives in `src/lib/fs.ts`.
use std::path::{Component, Path, PathBuf};
use tauri::command;

/// Collapse `.` and `..` segments without touching the filesystem.
///
/// Purely lexical so it works for not-yet-existing write targets (unlike
/// `canonicalize`, which requires the path to exist). `a/b/../c` → `a/c`;
/// `C:\root\..\etc` → `C:\etc`. A leading prefix/root (e.g. `C:\`) is preserved.
fn normalize_lexical(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in path.components() {
        match comp {
            Component::ParentDir => {
                out.pop();
            }
            Component::CurDir => {}
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// True if `path` resolves inside one of the `allowed` roots.
///
/// Both sides are lexically normalized first, and containment is checked
/// component-wise via [`Path::starts_with`] (so `/srv/data` does **not** match
/// the root `/srv/dat`). An empty allow-list denies everything.
fn is_within_allowed(path: &Path, allowed: &[String]) -> bool {
    let norm = normalize_lexical(path);
    allowed.iter().any(|root| {
        let root_norm = normalize_lexical(Path::new(root));
        !root_norm.as_os_str().is_empty() && norm.starts_with(&root_norm)
    })
}

/// Read a UTF-8 text file, but only if it lies within an allowed root.
fn read_text(path: &str, allowed: &[String]) -> Result<String, String> {
    let p = Path::new(path);
    if !is_within_allowed(p, allowed) {
        return Err(format!("Path \"{path}\" is outside this agent's allowed paths."));
    }
    std::fs::read_to_string(p).map_err(|e| e.to_string())
}

/// Write a UTF-8 text file (creating parent dirs), but only within an allowed root.
fn write_text(path: &str, content: &str, allowed: &[String]) -> Result<(), String> {
    let p = Path::new(path);
    if !is_within_allowed(p, allowed) {
        return Err(format!("Path \"{path}\" is outside this agent's allowed paths."));
    }
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, content).map_err(|e| e.to_string())
}

/// Read a text file on behalf of the `file_read` tool.
///
/// `allowed_paths` mirrors the agent's `PermissionScope.allowedPaths`; the call
/// is rejected if `path` is not inside one of them.
#[command]
pub fn fs_read_text(path: String, allowed_paths: Vec<String>) -> Result<String, String> {
    read_text(&path, &allowed_paths)
}

/// Write a text file on behalf of the `file_write` tool (overwrites existing).
#[command]
pub fn fs_write_text(path: String, content: String, allowed_paths: Vec<String>) -> Result<(), String> {
    write_text(&path, &content, &allowed_paths)
}

// All tests exercise the AppHandle-free helpers against temp directories, so
// they run on any host (no Tauri runtime needed). Per the project's Windows
// gotcha, no `MockRuntime` tests are added here.
#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    /// A unique, freshly-created temp directory to act as an allowed root.
    fn temp_root() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("acc-fs-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir should be creatable");
        dir
    }

    #[test]
    fn normalize_collapses_parent_and_current() {
        assert_eq!(normalize_lexical(Path::new("a/b/../c")), PathBuf::from("a/c"));
        assert_eq!(normalize_lexical(Path::new("a/./b")), PathBuf::from("a/b"));
    }

    #[test]
    fn within_allowed_accepts_paths_under_a_root() {
        let root = temp_root();
        let inside = root.join("sub").join("file.txt");
        let roots = vec![root.to_string_lossy().into_owned()];
        assert!(is_within_allowed(&inside, &roots));
        assert!(is_within_allowed(&root, &roots), "the root itself is allowed");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn within_allowed_rejects_traversal_siblings_and_empty_list() {
        let root = Path::new("/srv/data");
        let roots = vec!["/srv/data".to_string()];
        // `..` escape that would string-prefix-match naively.
        assert!(!is_within_allowed(Path::new("/srv/data/../secret"), &roots));
        // Sibling whose string starts with the root but is a different dir.
        assert!(!is_within_allowed(Path::new("/srv/database/x"), &roots));
        // Unrelated path.
        assert!(!is_within_allowed(Path::new("/etc/passwd"), &roots));
        // Empty allow-list denies everything.
        assert!(!is_within_allowed(root, &[]));
    }

    #[test]
    fn write_then_read_round_trips_within_a_root() {
        let root = temp_root();
        let roots = vec![root.to_string_lossy().into_owned()];
        let target = root.join("nested").join("hello.txt");
        let target_s = target.to_string_lossy().into_owned();
        write_text(&target_s, "hi there", &roots).expect("write within root should succeed");
        let got = read_text(&target_s, &roots).expect("read within root should succeed");
        assert_eq!(got, "hi there");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn read_outside_allowed_is_rejected() {
        let root = temp_root();
        let roots = vec![root.to_string_lossy().into_owned()];
        let res = read_text("/etc/passwd", &roots);
        assert!(res.is_err(), "reading outside the allow-list must be rejected");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn write_outside_allowed_is_rejected() {
        let root = temp_root();
        let roots = vec![root.to_string_lossy().into_owned()];
        let escape = root.join("..").join("escape.txt");
        let res = write_text(&escape.to_string_lossy(), "x", &roots);
        assert!(res.is_err(), "writing outside the allow-list must be rejected");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn read_missing_file_within_root_errors() {
        let root = temp_root();
        let roots = vec![root.to_string_lossy().into_owned()];
        let missing = root.join("nope.txt");
        assert!(read_text(&missing.to_string_lossy(), &roots).is_err());
        let _ = std::fs::remove_dir_all(&root);
    }
}

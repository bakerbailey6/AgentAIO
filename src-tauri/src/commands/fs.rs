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
use regex::Regex;
use serde::Serialize;
use std::path::{Component, Path, PathBuf};
use tauri::command;
use walkdir::WalkDir;

/// Directories never descended into by `glob`/`grep` (and skipped by
/// `list_directory`'s recursive callers). Keeps repo searches fast and sane.
const IGNORED_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "dist",
    ".next",
    "out",
    "build",
    ".venv",
    "venv",
    "__pycache__",
    ".turbo",
    ".cache",
];

/// One entry returned by [`list_directory`].
#[derive(Serialize)]
pub struct DirEntryInfo {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

/// One match returned by [`grep`].
#[derive(Serialize)]
pub struct GrepMatch {
    path: String,
    line: usize,
    text: String,
}

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

/// True if any path component is an ignored directory name.
fn is_ignored(rel: &Path) -> bool {
    rel.components().any(|c| {
        matches!(c, Component::Normal(name) if IGNORED_DIRS.iter().any(|d| name == *d))
    })
}

/// Translate a shell glob (`**`, `*`, `?`) into an anchored regex matched against
/// a path relative to the search root (with `/` separators).
fn glob_to_regex(pattern: &str) -> String {
    let chars: Vec<char> = pattern.chars().collect();
    let mut re = String::from("^");
    let mut i = 0;
    while i < chars.len() {
        match chars[i] {
            '*' => {
                if i + 1 < chars.len() && chars[i + 1] == '*' {
                    i += 1;
                    if i + 1 < chars.len() && chars[i + 1] == '/' {
                        re.push_str("(?:.*/)?"); // `**/` — zero or more directories
                        i += 1;
                    } else {
                        re.push_str(".*"); // `**` — anything, including `/`
                    }
                } else {
                    re.push_str("[^/]*"); // `*` — anything but a separator
                }
            }
            '?' => re.push_str("[^/]"),
            c @ ('.' | '+' | '(' | ')' | '|' | '^' | '$' | '{' | '}' | '[' | ']' | '\\') => {
                re.push('\\');
                re.push(c);
            }
            c => re.push(c),
        }
        i += 1;
    }
    re.push('$');
    re
}

/// List the immediate entries of a directory (non-recursive), within an allowed root.
fn list_dir(path: &str, allowed: &[String]) -> Result<Vec<DirEntryInfo>, String> {
    let p = Path::new(path);
    if !is_within_allowed(p, allowed) {
        return Err(format!("Path \"{path}\" is outside this agent's allowed paths."));
    }
    let mut out = Vec::new();
    for entry in std::fs::read_dir(p).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        out.push(DirEntryInfo {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().to_string_lossy().into_owned(),
            is_dir: meta.is_dir(),
            size: meta.len(),
        });
    }
    // Directories first, then alphabetical.
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then_with(|| a.name.cmp(&b.name)));
    Ok(out)
}

/// Find files under `root` whose root-relative path matches `pattern` (glob).
fn glob_files(root: &str, pattern: &str, allowed: &[String]) -> Result<Vec<String>, String> {
    let root_p = Path::new(root);
    if !is_within_allowed(root_p, allowed) {
        return Err(format!("Path \"{root}\" is outside this agent's allowed paths."));
    }
    let re = Regex::new(&glob_to_regex(pattern)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for entry in WalkDir::new(root_p).into_iter().filter_map(|e| e.ok()) {
        let rel = match entry.path().strip_prefix(root_p) {
            Ok(r) => r,
            Err(_) => continue,
        };
        if is_ignored(rel) {
            continue;
        }
        if entry.file_type().is_file() {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            if re.is_match(&rel_str) {
                out.push(entry.path().to_string_lossy().into_owned());
                if out.len() >= 1000 {
                    break;
                }
            }
        }
    }
    out.sort();
    Ok(out)
}

/// Search file contents under `root` for `pattern` (regex), within an allowed root.
fn grep(root: &str, pattern: &str, allowed: &[String]) -> Result<Vec<GrepMatch>, String> {
    let root_p = Path::new(root);
    if !is_within_allowed(root_p, allowed) {
        return Err(format!("Path \"{root}\" is outside this agent's allowed paths."));
    }
    let re = Regex::new(pattern).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    'walk: for entry in WalkDir::new(root_p).into_iter().filter_map(|e| e.ok()) {
        let rel = match entry.path().strip_prefix(root_p) {
            Ok(r) => r,
            Err(_) => continue,
        };
        if is_ignored(rel) || !entry.file_type().is_file() {
            continue;
        }
        // Skip very large files; read lossily so binary files don't error out.
        if entry.metadata().map(|m| m.len()).unwrap_or(0) > 2_000_000 {
            continue;
        }
        let content = match std::fs::read(entry.path()) {
            Ok(bytes) => String::from_utf8_lossy(&bytes).into_owned(),
            Err(_) => continue,
        };
        for (i, line) in content.lines().enumerate() {
            if re.is_match(line) {
                let text: String = line.chars().take(400).collect();
                out.push(GrepMatch {
                    path: entry.path().to_string_lossy().into_owned(),
                    line: i + 1,
                    text,
                });
                if out.len() >= 500 {
                    break 'walk;
                }
            }
        }
    }
    Ok(out)
}

/// List a directory's entries on behalf of the `list_directory` tool.
#[command]
pub fn fs_list_directory(path: String, allowed_paths: Vec<String>) -> Result<Vec<DirEntryInfo>, String> {
    list_dir(&path, &allowed_paths)
}

/// Glob for files on behalf of the `glob` tool.
#[command]
pub fn fs_glob(root: String, pattern: String, allowed_paths: Vec<String>) -> Result<Vec<String>, String> {
    glob_files(&root, &pattern, &allowed_paths)
}

/// Search file contents on behalf of the `grep` tool.
#[command]
pub fn fs_grep(root: String, pattern: String, allowed_paths: Vec<String>) -> Result<Vec<GrepMatch>, String> {
    grep(&root, &pattern, &allowed_paths)
}

// All tests exercise the AppHandle-free helpers against temp directories, so
// they run on any host (no Tauri runtime needed). Per the project's Windows
// gotcha, no `MockRuntime` tests are added here.
#[cfg(test)]
mod tests {
    use super::*;
    use regex::Regex;
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

    #[test]
    fn glob_to_regex_translates_common_patterns() {
        let re = Regex::new(&glob_to_regex("**/*.ts")).unwrap();
        assert!(re.is_match("src/a/b.ts"));
        assert!(re.is_match("x.ts"));
        assert!(!re.is_match("x.tsx"));
        let re2 = Regex::new(&glob_to_regex("*.md")).unwrap();
        assert!(re2.is_match("README.md"));
        assert!(!re2.is_match("docs/README.md")); // `*` does not cross `/`
    }

    #[test]
    fn list_dir_returns_entries_dirs_first() {
        let root = temp_root();
        std::fs::create_dir_all(root.join("zdir")).unwrap();
        std::fs::write(root.join("a.txt"), "x").unwrap();
        let roots = vec![root.to_string_lossy().into_owned()];
        let entries = list_dir(&root.to_string_lossy(), &roots).unwrap();
        assert_eq!(entries.len(), 2);
        assert!(entries[0].is_dir && entries[0].name == "zdir"); // dirs sort first
        assert_eq!(entries[1].name, "a.txt");
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn glob_finds_matching_files_and_skips_ignored_dirs() {
        let root = temp_root();
        std::fs::create_dir_all(root.join("src")).unwrap();
        std::fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        std::fs::write(root.join("src/main.rs"), "fn main(){}").unwrap();
        std::fs::write(root.join("README.md"), "hi").unwrap();
        std::fs::write(root.join("node_modules/pkg/index.rs"), "ignored").unwrap();
        let roots = vec![root.to_string_lossy().into_owned()];
        let hits = glob_files(&root.to_string_lossy(), "**/*.rs", &roots).unwrap();
        assert_eq!(hits.len(), 1, "node_modules must be skipped");
        assert!(hits[0].ends_with("main.rs"));
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn grep_finds_matches_with_line_numbers() {
        let root = temp_root();
        std::fs::write(root.join("f.txt"), "alpha\nneedle here\nbeta\nNEEDLE again").unwrap();
        let roots = vec![root.to_string_lossy().into_owned()];
        let hits = grep(&root.to_string_lossy(), "(?i)needle", &roots).unwrap();
        assert_eq!(hits.len(), 2);
        assert_eq!(hits[0].line, 2);
        assert!(hits[0].text.contains("needle here"));
        assert_eq!(hits[1].line, 4);
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn glob_and_grep_reject_paths_outside_allowed() {
        let root = temp_root();
        let roots = vec![root.to_string_lossy().into_owned()];
        assert!(glob_files("/etc", "*.conf", &roots).is_err());
        assert!(grep("/etc", "root", &roots).is_err());
        assert!(list_dir("/etc", &roots).is_err());
        let _ = std::fs::remove_dir_all(&root);
    }
}

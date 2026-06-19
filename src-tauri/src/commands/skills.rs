//! Skill-file commands.
//!
//! Skills are Markdown files with YAML frontmatter stored in `~/.acc/skills`
//! (§8.3). These commands let the front end list, read, and write them; the
//! front-end wrapper lives in `src/lib/skills.ts`.
//!
//! Every path is resolved through [`safe_skill_path`], which rejects anything
//! that would escape the skills directory (`..`, absolute paths, nested
//! segments) — a malicious or buggy `name` can never reach a file outside
//! `~/.acc/skills`. The AppHandle-free helpers (`*_skill_file`, `safe_skill_path`)
//! are unit-tested against a temp directory; the `#[command]`s are thin wrappers
//! that resolve the real root via [`skills_root`].
use std::path::{Path, PathBuf};
use tauri::command;

/// Resolve `~/.acc/skills`, creating it if it doesn't exist yet.
fn skills_root() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or_else(|| "could not resolve home directory".to_string())?;
    let dir = home.join(".acc").join("skills");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Resolve a skill file name to a path *inside* `base`, rejecting traversal.
///
/// `name` must be a single, normal path component ending in `.md` — no parent
/// references, no absolute paths, no nested directories. This is the security
/// boundary for the skills commands.
fn safe_skill_path(base: &Path, name: &str) -> Result<PathBuf, String> {
    use std::path::Component;
    if !name.ends_with(".md") {
        return Err(format!("skill name must end with .md: {name}"));
    }
    let mut comps = Path::new(name).components();
    match (comps.next(), comps.next()) {
        // Exactly one normal component (e.g. `my-skill.md`) is allowed.
        (Some(Component::Normal(seg)), None) => Ok(base.join(seg)),
        _ => Err(format!("invalid skill name: {name}")),
    }
}

/// List the `.md` skill files directly inside `base`, sorted by name.
fn list_skill_files(base: &Path) -> Result<Vec<String>, String> {
    if !base.exists() {
        return Ok(Vec::new());
    }
    let mut names = Vec::new();
    for entry in std::fs::read_dir(base).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.ends_with(".md") {
                    names.push(name.to_string());
                }
            }
        }
    }
    names.sort();
    Ok(names)
}

/// Read one skill file's contents.
fn read_skill_file(base: &Path, name: &str) -> Result<String, String> {
    let path = safe_skill_path(base, name)?;
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Write (creating or overwriting) one skill file.
fn write_skill_file(base: &Path, name: &str, content: &str) -> Result<(), String> {
    let path = safe_skill_path(base, name)?;
    std::fs::create_dir_all(base).map_err(|e| e.to_string())?;
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

/// List the names of every skill file in `~/.acc/skills`.
#[command]
pub fn list_skills() -> Result<Vec<String>, String> {
    list_skill_files(&skills_root()?)
}

/// Read the raw Markdown of one skill file by name (e.g. `code-review.md`).
#[command]
pub fn read_skill(name: String) -> Result<String, String> {
    read_skill_file(&skills_root()?, &name)
}

/// Write a skill file by name, creating `~/.acc/skills` if needed.
#[command]
pub fn write_skill(name: String, content: String) -> Result<(), String> {
    write_skill_file(&skills_root()?, &name, &content)
}

// All tests exercise the AppHandle-free helpers against a temp directory, so
// they run on any host (no Tauri runtime, no real home directory needed).
#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    /// A unique, freshly-created temp directory to act as a skills root.
    fn temp_root() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("acc-skills-test-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).expect("temp dir should be creatable");
        dir
    }

    #[test]
    fn safe_skill_path_accepts_a_plain_md_name() {
        let base = Path::new("/base");
        let p = safe_skill_path(base, "my-skill.md").expect("a plain .md name should be allowed");
        assert_eq!(p, base.join("my-skill.md"));
    }

    #[test]
    fn safe_skill_path_rejects_traversal_absolute_and_nested() {
        let base = Path::new("/base");
        for bad in [
            "../escape.md",
            "../../etc/passwd.md",
            "sub/skill.md",
            "/abs.md",
            "a/../b.md",
        ] {
            assert!(
                safe_skill_path(base, bad).is_err(),
                "expected {bad} to be rejected",
            );
        }
    }

    #[test]
    fn safe_skill_path_rejects_non_md_and_empty() {
        let base = Path::new("/base");
        assert!(safe_skill_path(base, "skill.txt").is_err());
        assert!(safe_skill_path(base, "").is_err());
        assert!(safe_skill_path(base, "noext").is_err());
    }

    #[test]
    fn write_then_read_round_trips() {
        let base = temp_root();
        write_skill_file(&base, "hello.md", "# Hello\n").expect("write should succeed");
        let got = read_skill_file(&base, "hello.md").expect("read should succeed");
        assert_eq!(got, "# Hello\n");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn list_returns_only_md_files_sorted() {
        let base = temp_root();
        write_skill_file(&base, "b.md", "b").unwrap();
        write_skill_file(&base, "a.md", "a").unwrap();
        std::fs::write(base.join("notes.txt"), "ignore me").unwrap();
        std::fs::create_dir_all(base.join("nested")).unwrap();

        let names = list_skill_files(&base).expect("list should succeed");
        assert_eq!(names, vec!["a.md".to_string(), "b.md".to_string()]);
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn list_on_missing_dir_is_empty() {
        let base = std::env::temp_dir().join(format!("acc-skills-missing-{}", Uuid::new_v4()));
        let names = list_skill_files(&base).expect("listing a missing dir should be Ok(empty)");
        assert!(names.is_empty());
    }

    #[test]
    fn read_missing_file_errors() {
        let base = temp_root();
        assert!(read_skill_file(&base, "nope.md").is_err());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn write_rejects_traversal_name() {
        let base = temp_root();
        assert!(write_skill_file(&base, "../escape.md", "x").is_err());
        let _ = std::fs::remove_dir_all(&base);
    }
}

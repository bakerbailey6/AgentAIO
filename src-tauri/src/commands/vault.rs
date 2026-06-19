//! Encrypted-at-rest SQLite vault (SQLCipher) commands.
//!
//! The app database is opened through a SQLCipher-keyed `rusqlite` connection
//! instead of `tauri-plugin-sql`. The plugin (sqlx) opens a bare URL with no
//! hook to run `PRAGMA key` *before* the file is touched, so a SQLCipher file
//! could neither be created encrypted nor reopened through it. This module owns
//! a single keyed connection and exposes `vault_select`/`vault_execute` whose
//! shapes match the plugin's `select`/`execute`, so the TS repositories are
//! unchanged (`src/lib/storage/db.ts` is the only caller that switched).
//!
//! The passphrase lives ONLY in the OS keychain (`src/lib/keychain.ts`, ref
//! `vault-passphrase`); the front end keys the DB **before** any migration.
//!
//! AppHandle-free logic (`open_keyed`, `run_execute`, `run_select`, the JSON
//! converters) is factored into free functions so it is unit-testable without a
//! Tauri runtime — the `MockRuntime` test feature is unusable on this Windows
//! host (see `Cargo.toml`).
use rusqlite::types::Value as SqlValue;
use rusqlite::{params_from_iter, Connection};
use serde::Serialize;
use serde_json::Value as JsonValue;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tauri::{command, AppHandle, Manager, Runtime};

/// The app's single keyed connection, registered as Tauri managed state.
/// `None` until `vault_open` succeeds.
pub type VaultState = Arc<Mutex<Option<Connection>>>;

/// Mirror of the SQL plugin's execute result (camelCase for the JS side).
#[derive(Serialize)]
pub struct ExecuteResult {
    #[serde(rename = "rowsAffected")]
    pub rows_affected: u64,
    #[serde(rename = "lastInsertId")]
    pub last_insert_id: i64,
}

/// Convert one positional bind value from JSON to a SQLite value.
///
/// Mirrors the plugin's binding rules closely enough for the repositories:
/// booleans collapse to `0/1` integers (repos already store bools that way),
/// integral numbers bind as INTEGER, the rest as REAL. Arrays/objects are not
/// valid bind params (JSON columns are stringified by the repositories).
fn json_to_sql(value: &JsonValue) -> Result<SqlValue, String> {
    Ok(match value {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(b) => SqlValue::Integer(if *b { 1 } else { 0 }),
        JsonValue::Number(n) => {
            if let Some(i) = n.as_i64() {
                SqlValue::Integer(i)
            } else {
                SqlValue::Real(n.as_f64().unwrap_or_default())
            }
        }
        JsonValue::String(s) => SqlValue::Text(s.clone()),
        other => return Err(format!("unsupported bind value: {other}")),
    })
}

/// Convert a column value back to JSON, matching the plugin's sqlite decoder:
/// INTEGER/REAL → number, TEXT → string, BLOB → array of byte numbers,
/// NULL → null.
fn sql_to_json(value: SqlValue) -> JsonValue {
    match value {
        SqlValue::Null => JsonValue::Null,
        SqlValue::Integer(i) => JsonValue::from(i),
        SqlValue::Real(f) => JsonValue::from(f),
        SqlValue::Text(s) => JsonValue::String(s),
        SqlValue::Blob(b) => JsonValue::Array(b.into_iter().map(JsonValue::from).collect()),
    }
}

/// Open `path`, key it with `passphrase` as the FIRST statement, and verify the
/// key is correct before returning.
///
/// `PRAGMA key` must precede every other statement: on a fresh file it derives
/// the key and the first write encrypts the database; on an existing encrypted
/// file it enables decryption. The `sqlite_master` read forces the key to take
/// effect and fails (`file is not a database`) on a wrong/missing passphrase,
/// turning a bad key into an error instead of silent corruption.
pub fn open_keyed(path: &Path, passphrase: &str) -> Result<Connection, String> {
    let conn = Connection::open(path).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "key", passphrase)
        .map_err(|e| e.to_string())?;
    conn.query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
        .map_err(|e| e.to_string())?;
    Ok(conn)
}

/// Run a non-query statement with positional `$1..$n` params.
pub fn run_execute(
    conn: &Connection,
    query: &str,
    values: &[JsonValue],
) -> Result<ExecuteResult, String> {
    let binds = values
        .iter()
        .map(json_to_sql)
        .collect::<Result<Vec<_>, _>>()?;
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let rows_affected = stmt
        .execute(params_from_iter(binds))
        .map_err(|e| e.to_string())?;
    Ok(ExecuteResult {
        rows_affected: rows_affected as u64,
        last_insert_id: conn.last_insert_rowid(),
    })
}

/// Run a query with positional `$1..$n` params, returning one JSON object per
/// row (column name → value), matching the plugin's `select`.
pub fn run_select(
    conn: &Connection,
    query: &str,
    values: &[JsonValue],
) -> Result<Vec<JsonValue>, String> {
    let binds = values
        .iter()
        .map(json_to_sql)
        .collect::<Result<Vec<_>, _>>()?;
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    // Column names must be collected before `query` mutably borrows the stmt.
    let columns: Vec<String> = stmt.column_names().into_iter().map(String::from).collect();
    let mut rows = stmt.query(params_from_iter(binds)).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut obj = serde_json::Map::with_capacity(columns.len());
        for (i, name) in columns.iter().enumerate() {
            let v: SqlValue = row.get(i).map_err(|e| e.to_string())?;
            obj.insert(name.clone(), sql_to_json(v));
        }
        out.push(JsonValue::Object(obj));
    }
    Ok(out)
}

/// Resolve `<app config dir>/<filename>`, creating the directory if needed.
/// Mirrors the plugin's `path_mapper` so the encrypted DB lives where the
/// plaintext one used to.
fn db_path<R: Runtime>(app: &AppHandle<R>, filename: &str) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(filename))
}

/// Open (and key) the encrypted vault DB, storing the connection in app state.
/// Must be called before `vault_execute`/`vault_select`.
#[command]
pub fn vault_open<R: Runtime>(
    app: AppHandle<R>,
    filename: String,
    passphrase: String,
) -> Result<(), String> {
    let path = db_path(&app, &filename)?;
    let conn = open_keyed(&path, &passphrase)?;
    let state = app.state::<VaultState>();
    *state.lock().map_err(|e| e.to_string())? = Some(conn);
    Ok(())
}

/// Execute a non-query statement against the open vault.
#[command]
pub fn vault_execute<R: Runtime>(
    app: AppHandle<R>,
    query: String,
    values: Vec<JsonValue>,
) -> Result<ExecuteResult, String> {
    let state = app.state::<VaultState>();
    let guard = state.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("vault is not open")?;
    run_execute(conn, &query, &values)
}

/// Run a query against the open vault, returning row objects.
#[command]
pub fn vault_select<R: Runtime>(
    app: AppHandle<R>,
    query: String,
    values: Vec<JsonValue>,
) -> Result<Vec<JsonValue>, String> {
    let state = app.state::<VaultState>();
    let guard = state.lock().map_err(|e| e.to_string())?;
    let conn = guard.as_ref().ok_or("vault is not open")?;
    run_select(conn, &query, &values)
}

// AppHandle-free coverage only: the keying, the JSON<->SQL marshalling, and the
// "unkeyed client can't read it" property. The `#[command]` wrappers add only
// path resolution + state locking, which need a Tauri runtime (MockRuntime is
// broken on this Windows host — see Cargo.toml).
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_db_path(tag: &str) -> std::path::PathBuf {
        let mut p = std::env::temp_dir();
        p.push(format!(
            "acc-vault-test-{}-{}.db",
            tag,
            uuid::Uuid::new_v4()
        ));
        p
    }

    #[test]
    fn open_keyed_round_trips_through_execute_and_select() {
        let path = temp_db_path("roundtrip");
        let conn = open_keyed(&path, "correct horse battery staple").unwrap();

        run_execute(&conn, "CREATE TABLE t (id TEXT, n INTEGER, f REAL)", &[]).unwrap();
        let res = run_execute(
            &conn,
            "INSERT INTO t (id, n, f) VALUES ($1, $2, $3)",
            &[json!("a"), json!(7), json!(1.5)],
        )
        .unwrap();
        assert_eq!(res.rows_affected, 1);

        let rows = run_select(&conn, "SELECT id, n, f FROM t WHERE id = $1", &[json!("a")]).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], json!("a"));
        assert_eq!(rows[0]["n"], json!(7));
        assert_eq!(rows[0]["f"], json!(1.5));

        drop(conn);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn null_binds_and_columns_preserve_null() {
        let path = temp_db_path("nulls");
        let conn = open_keyed(&path, "pw").unwrap();
        run_execute(&conn, "CREATE TABLE t (a TEXT, b TEXT)", &[]).unwrap();
        run_execute(
            &conn,
            "INSERT INTO t (a, b) VALUES ($1, $2)",
            &[json!("x"), JsonValue::Null],
        )
        .unwrap();
        let rows = run_select(&conn, "SELECT a, b FROM t", &[]).unwrap();
        assert_eq!(rows[0]["a"], json!("x"));
        assert_eq!(rows[0]["b"], JsonValue::Null);
        drop(conn);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn encrypted_file_is_unreadable_without_the_key() {
        // The core security property: a fresh DB created with a key must not be
        // readable by an unkeyed connection, nor by a wrong-key one.
        let path = temp_db_path("encrypted");
        {
            let conn = open_keyed(&path, "the-real-passphrase").unwrap();
            run_execute(&conn, "CREATE TABLE secret (v TEXT)", &[]).unwrap();
            run_execute(&conn, "INSERT INTO secret VALUES ($1)", &[json!("classified")]).unwrap();
        }

        // No key at all: any read fails with "file is not a database".
        let unkeyed = Connection::open(&path).unwrap();
        assert!(
            unkeyed
                .query_row("SELECT count(*) FROM sqlite_master", [], |_| Ok(()))
                .is_err(),
            "an unkeyed client must NOT be able to read an encrypted DB"
        );
        drop(unkeyed);

        // Wrong key: open_keyed verifies and must reject it.
        assert!(
            open_keyed(&path, "wrong-passphrase").is_err(),
            "a wrong passphrase must fail rather than open"
        );

        // Right key still works.
        let good = open_keyed(&path, "the-real-passphrase").unwrap();
        let rows = run_select(&good, "SELECT v FROM secret", &[]).unwrap();
        assert_eq!(rows[0]["v"], json!("classified"));
        drop(good);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn raw_file_bytes_do_not_contain_plaintext() {
        // Belt-and-suspenders: the on-disk header is not the SQLite magic and
        // the inserted plaintext does not appear verbatim in the file.
        let path = temp_db_path("bytes");
        {
            let conn = open_keyed(&path, "pw").unwrap();
            run_execute(&conn, "CREATE TABLE t (v TEXT)", &[]).unwrap();
            run_execute(&conn, "INSERT INTO t VALUES ($1)", &[json!("NEEDLE-MARKER")]).unwrap();
        }
        let bytes = std::fs::read(&path).unwrap();
        assert!(
            !bytes.starts_with(b"SQLite format 3\0"),
            "encrypted DB must not start with the plaintext SQLite header"
        );
        assert!(
            !bytes.windows(13).any(|w| w == b"NEEDLE-MARKER"),
            "inserted plaintext must not be present verbatim on disk"
        );
        let _ = std::fs::remove_file(&path);
    }
}

use keyring::Entry;
use tauri::command;

const SERVICE: &str = "agent-command-center";

#[command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    Entry::new(SERVICE, &key)
        .map_err(|e| e.to_string())?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(val) => Ok(Some(val)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
pub fn delete_secret(key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &key).map_err(|e| e.to_string())?;
    match entry.delete_password() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// NOTE: every test in this module talks to the real OS keychain (Windows
// Credential Manager / macOS Keychain / libsecret). They must run on a
// developer host with a session keychain available, NOT in headless CI.
// Each test uses a unique key name so concurrent runs and leftover dev-state
// can't collide.
#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn unique_key(prefix: &str) -> String {
        format!("acc-test-{}-{}", prefix, Uuid::new_v4())
    }

    #[test]
    fn set_get_delete_round_trip() {
        let key = unique_key("roundtrip");
        set_secret(key.clone(), "secret-value".to_string()).unwrap();
        let val = get_secret(key.clone()).unwrap();
        assert_eq!(val, Some("secret-value".to_string()));
        delete_secret(key.clone()).unwrap();
        let val2 = get_secret(key).unwrap();
        assert_eq!(val2, None);
    }

    #[test]
    fn get_secret_returns_none_for_unset_key() {
        // A key that was never set must resolve to Ok(None), not an error
        // (the `NoEntry` arm in `get_secret`).
        let key = unique_key("never-set");
        let val = get_secret(key).unwrap();
        assert_eq!(val, None);
    }

    #[test]
    fn delete_secret_missing_key_is_idempotent() {
        // Deleting a key that doesn't exist is a no-op, not an error
        // (the `NoEntry` arm in `delete_secret`).
        let key = unique_key("missing");
        delete_secret(key).expect("deleting a missing key should be Ok(())");
    }
}

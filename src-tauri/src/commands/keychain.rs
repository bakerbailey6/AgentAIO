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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn set_get_delete_round_trip() {
        let key = "acc-test-key".to_string();
        set_secret(key.clone(), "secret-value".to_string()).unwrap();
        let val = get_secret(key.clone()).unwrap();
        assert_eq!(val, Some("secret-value".to_string()));
        delete_secret(key.clone()).unwrap();
        let val2 = get_secret(key).unwrap();
        assert_eq!(val2, None);
    }
}

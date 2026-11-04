//! Accounts on disk, encrypted with AES-256-GCM.
//!
//! Tokens are too long for some OS keychains (Windows caps secrets at 2.5 KB), so only the
//! 32-byte key lives in the keychain and the tokens live in `accounts.dat`. On macOS the key is
//! in a private file instead (see [`key`]).

use std::path::{Path, PathBuf};

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use serde::{Deserialize, Serialize};

use crate::error::{msg, Result};

const KEYRING_SERVICE: &str = "app.novex.launcher";
const KEYRING_USER: &str = "accounts-key";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AccountKind {
    Microsoft,
    Offline,
}

/// What the UI sees: no tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub uuid: String,
    pub name: String,
    pub kind: AccountKind,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAccount {
    #[serde(flatten)]
    pub account: Account,
    #[serde(default)]
    pub refresh_token: Option<String>,
    #[serde(default)]
    pub mc_token: Option<String>,
    #[serde(default)]
    pub mc_expires_at: u64,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AccountsFile {
    pub active: Option<String>,
    pub accounts: Vec<StoredAccount>,
}

pub struct AccountStore {
    path: PathBuf,
    pub data: AccountsFile,
}

fn keychain_err(e: keyring::Error) -> crate::error::Error {
    msg(format!("Couldn't access the system keychain: {e}"))
}

fn decode_key(b64: &str) -> Result<Key<Aes256Gcm>> {
    let bytes = B64
        .decode(b64.trim())
        .map_err(|_| msg("Stored account key is corrupt."))?;
    if bytes.len() != 32 {
        return Err(msg("Stored account key is corrupt."));
    }
    Ok(*Key::<Aes256Gcm>::from_slice(&bytes))
}

/// The key in the system keychain, if there is one.
fn keychain_key() -> Result<Option<Key<Aes256Gcm>>> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(keychain_err)?;
    match entry.get_password() {
        Ok(b64) => decode_key(&b64).map(Some),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(keychain_err(e)),
    }
}

#[cfg(not(target_os = "macos"))]
fn key(_root: &Path) -> Result<Key<Aes256Gcm>> {
    if let Some(k) = keychain_key()? {
        return Ok(k);
    }
    let k = Aes256Gcm::generate_key(OsRng);
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(keychain_err)?
        .set_password(&B64.encode(k))
        .map_err(keychain_err)?;
    Ok(k)
}

/// macOS ties keychain access to the app's signature, and an app without a Developer ID gets a
/// new one with every build, so the keychain would prompt after each update. The key lives in a
/// file only this user can read instead, and is moved out of the keychain the first time.
#[cfg(target_os = "macos")]
fn key(root: &Path) -> Result<Key<Aes256Gcm>> {
    let accounts_exist = root.join("accounts.dat").exists();
    file_key(root, || {
        if accounts_exist {
            keychain_key()
        } else {
            Ok(None)
        }
    })
}

/// Reads the key file, creating it from `existing` or a new key if it isn't there.
#[cfg(any(target_os = "macos", test))]
fn file_key(
    root: &Path,
    existing: impl FnOnce() -> Result<Option<Key<Aes256Gcm>>>,
) -> Result<Key<Aes256Gcm>> {
    use std::io::Write;

    let path = root.join("accounts.key");
    if let Ok(b64) = std::fs::read_to_string(&path) {
        return decode_key(&b64);
    }
    let k = existing()?.unwrap_or_else(|| Aes256Gcm::generate_key(OsRng));
    std::fs::create_dir_all(root)?;
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options.open(&path)?.write_all(B64.encode(k).as_bytes())?;
    Ok(k)
}

impl AccountStore {
    pub fn load(root: &Path) -> Self {
        let path = root.join("accounts.dat");
        let data = std::fs::read(&path)
            .ok()
            .and_then(|blob| match Self::decrypt(&blob, root) {
                Ok(d) => Some(d),
                Err(e) => {
                    eprintln!("[accounts] could not read accounts.dat: {e}");
                    None
                }
            })
            .unwrap_or_default();
        Self { path, data }
    }

    fn decrypt(blob: &[u8], root: &Path) -> Result<AccountsFile> {
        if blob.len() < 12 {
            return Err(msg("file too short"));
        }
        let (nonce, ct) = blob.split_at(12);
        let plain = Aes256Gcm::new(&key(root)?)
            .decrypt(Nonce::from_slice(nonce), ct)
            .map_err(|_| msg("decryption failed"))?;
        Ok(serde_json::from_slice(&plain)?)
    }

    pub fn save(&self) -> Result<()> {
        let root = self
            .path
            .parent()
            .ok_or_else(|| msg("Invalid accounts path."))?;
        let cipher = Aes256Gcm::new(&key(root)?);
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ct = cipher
            .encrypt(&nonce, serde_json::to_vec(&self.data)?.as_ref())
            .map_err(|_| msg("encryption failed"))?;
        std::fs::create_dir_all(root)?;
        let tmp = self.path.with_extension("tmp");
        std::fs::write(&tmp, [nonce.as_slice(), &ct].concat())?;
        std::fs::rename(tmp, &self.path)?;
        Ok(())
    }

    pub fn public(&self) -> Vec<Account> {
        self.data
            .accounts
            .iter()
            .map(|a| a.account.clone())
            .collect()
    }

    /// Adds or replaces an account (matched by uuid) and makes it active.
    pub fn upsert(&mut self, acc: StoredAccount) {
        let uuid = acc.account.uuid.clone();
        match self
            .data
            .accounts
            .iter_mut()
            .find(|a| a.account.uuid == uuid)
        {
            Some(existing) => *existing = acc,
            None => self.data.accounts.push(acc),
        }
        self.data.active = Some(uuid);
    }

    pub fn remove(&mut self, uuid: &str) {
        self.data.accounts.retain(|a| a.account.uuid != uuid);
        if self.data.active.as_deref() == Some(uuid) {
            self.data.active = self.data.accounts.first().map(|a| a.account.uuid.clone());
        }
    }

    pub fn active_mut(&mut self) -> Option<&mut StoredAccount> {
        let active = self.data.active.clone()?;
        self.data
            .accounts
            .iter_mut()
            .find(|a| a.account.uuid == active)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_file_keeps_an_existing_key_and_stays_private() {
        let root = std::env::temp_dir().join(format!("novex-key-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let old = Aes256Gcm::generate_key(OsRng);

        assert_eq!(file_key(&root, || Ok(Some(old))).unwrap(), old);
        let again = file_key(&root, || panic!("the keychain shouldn't be read again")).unwrap();
        assert_eq!(again, old);

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(root.join("accounts.key"))
                .unwrap()
                .permissions()
                .mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn a_keychain_failure_never_replaces_the_key() {
        let root = std::env::temp_dir().join(format!("novex-denied-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        assert!(file_key(&root, || Err(msg("denied"))).is_err());
        assert!(!root.join("accounts.key").exists());
    }
}

//! Accounts on disk, encrypted with AES-256-GCM.
//!
//! Tokens are too long for some OS keychains (Windows caps secrets at 2.5 KB), so only the
//! 32-byte key lives in the keychain and the tokens live in `accounts.dat`.

use std::path::PathBuf;

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

fn key() -> Result<Key<Aes256Gcm>> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(keychain_err)?;
    match entry.get_password() {
        Ok(b64) => {
            let bytes = B64
                .decode(b64)
                .map_err(|_| msg("Stored account key is corrupt."))?;
            if bytes.len() != 32 {
                return Err(msg("Stored account key is corrupt."));
            }
            Ok(*Key::<Aes256Gcm>::from_slice(&bytes))
        }
        Err(keyring::Error::NoEntry) => {
            let k = Aes256Gcm::generate_key(OsRng);
            entry.set_password(&B64.encode(k)).map_err(keychain_err)?;
            Ok(k)
        }
        Err(e) => Err(keychain_err(e)),
    }
}

impl AccountStore {
    pub fn load(root: &std::path::Path) -> Self {
        let path = root.join("accounts.dat");
        let data = std::fs::read(&path)
            .ok()
            .and_then(|blob| match Self::decrypt(&blob) {
                Ok(d) => Some(d),
                Err(e) => {
                    eprintln!("[accounts] could not read accounts.dat: {e}");
                    None
                }
            })
            .unwrap_or_default();
        Self { path, data }
    }

    fn decrypt(blob: &[u8]) -> Result<AccountsFile> {
        if blob.len() < 12 {
            return Err(msg("file too short"));
        }
        let (nonce, ct) = blob.split_at(12);
        let plain = Aes256Gcm::new(&key()?)
            .decrypt(Nonce::from_slice(nonce), ct)
            .map_err(|_| msg("decryption failed"))?;
        Ok(serde_json::from_slice(&plain)?)
    }

    pub fn save(&self) -> Result<()> {
        let cipher = Aes256Gcm::new(&key()?);
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ct = cipher
            .encrypt(&nonce, serde_json::to_vec(&self.data)?.as_ref())
            .map_err(|_| msg("encryption failed"))?;
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir)?;
        }
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

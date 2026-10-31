//! Accounts: Microsoft sign-in via device code, plus offline accounts in dev builds.

pub mod msa;
pub mod store;

use std::sync::atomic::Ordering;
use std::time::Duration;

use md5::{Digest, Md5};
use serde::Serialize;
use tauri::State;

use crate::error::{msg, Result};
use crate::platform::now_secs;
use crate::AppState;
use store::{Account, AccountKind, StoredAccount};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsView {
    active: Option<String>,
    accounts: Vec<Account>,
}

/// What the game needs from the active account at launch.
pub struct Credentials {
    pub name: String,
    pub uuid: String,
    pub access_token: String,
    pub user_type: &'static str,
}

/// Same UUID the vanilla game derives for an offline name ("OfflinePlayer:<name>", MD5, version 3).
fn offline_uuid(name: &str) -> String {
    let mut b: [u8; 16] = Md5::digest(format!("OfflinePlayer:{name}")).into();
    b[6] = (b[6] & 0x0f) | 0x30;
    b[8] = (b[8] & 0x3f) | 0x80;
    hex::encode(b)
}

fn is_valid_name(name: &str) -> bool {
    (3..=16).contains(&name.len()) && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

#[tauri::command]
pub async fn accounts_list(state: State<'_, AppState>) -> Result<AccountsView> {
    let store = state.accounts.lock().await;
    Ok(AccountsView {
        active: store.data.active.clone(),
        accounts: store.public(),
    })
}

#[tauri::command]
pub async fn account_select(state: State<'_, AppState>, uuid: String) -> Result<()> {
    let mut store = state.accounts.lock().await;
    if !store.data.accounts.iter().any(|a| a.account.uuid == uuid) {
        return Err(msg("Account not found."));
    }
    store.data.active = Some(uuid);
    store.save()
}

#[tauri::command]
pub async fn account_remove(state: State<'_, AppState>, uuid: String) -> Result<()> {
    let mut store = state.accounts.lock().await;
    store.remove(&uuid);
    store.save()
}

#[tauri::command]
pub async fn account_add_offline(state: State<'_, AppState>, name: String) -> Result<Account> {
    if !cfg!(debug_assertions) {
        return Err(msg("Offline accounts are only available in dev builds."));
    }
    let name = name.trim().to_string();
    if !is_valid_name(&name) {
        return Err(msg("Use 3–16 letters, numbers or underscores."));
    }
    let account = Account {
        uuid: offline_uuid(&name),
        name,
        kind: AccountKind::Offline,
    };
    let mut store = state.accounts.lock().await;
    store.upsert(StoredAccount {
        account: account.clone(),
        refresh_token: None,
        mc_token: None,
        mc_expires_at: 0,
    });
    store.save()?;
    Ok(account)
}

#[tauri::command]
pub async fn auth_start(state: State<'_, AppState>) -> Result<msa::DeviceCode> {
    state.auth_cancel.store(false, Ordering::SeqCst);
    msa::device_code(&state.http, &msa::client_id()?).await
}

/// Polls until the user finishes signing in in their browser, then completes the Minecraft login.
#[tauri::command]
pub async fn auth_finish(
    state: State<'_, AppState>,
    device_code: String,
    interval: u64,
    expires_in: u64,
) -> Result<Account> {
    let client_id = msa::client_id()?;
    let deadline = now_secs() + expires_in;
    let mut wait = interval.max(1);
    let tokens = loop {
        tokio::time::sleep(Duration::from_secs(wait)).await;
        if state.auth_cancel.load(Ordering::SeqCst) {
            return Err(msg("Sign-in was cancelled."));
        }
        if now_secs() > deadline {
            return Err(msg("The sign-in code expired. Try again."));
        }
        match msa::poll(&state.http, &client_id, &device_code).await? {
            msa::Poll::Pending => {}
            msa::Poll::SlowDown => wait += 5,
            msa::Poll::Done(t) => break t,
        }
    };

    let session = msa::minecraft_login(&state.http, &tokens.access_token).await?;
    let account = Account {
        uuid: session.uuid,
        name: session.name,
        kind: AccountKind::Microsoft,
    };
    let mut store = state.accounts.lock().await;
    store.upsert(StoredAccount {
        account: account.clone(),
        refresh_token: Some(tokens.refresh_token),
        mc_token: Some(session.access_token),
        mc_expires_at: now_secs() + session.expires_in,
    });
    store.save()?;
    Ok(account)
}

#[tauri::command]
pub fn auth_cancel(state: State<'_, AppState>) {
    state.auth_cancel.store(true, Ordering::SeqCst);
}

/// Returns launch credentials for the active account, refreshing Microsoft tokens when needed.
pub async fn credentials(state: &AppState) -> Result<Credentials> {
    let mut store = state.accounts.lock().await;
    let acc = store
        .active_mut()
        .ok_or_else(|| msg("Sign in to an account before playing."))?;

    if acc.account.kind == AccountKind::Offline {
        return Ok(Credentials {
            name: acc.account.name.clone(),
            uuid: acc.account.uuid.clone(),
            access_token: "0".into(),
            user_type: "legacy",
        });
    }

    let still_valid = acc.mc_token.is_some() && acc.mc_expires_at > now_secs() + 300;
    if !still_valid {
        let refresh_token = acc
            .refresh_token
            .clone()
            .ok_or_else(|| msg("Sign in again to refresh this account."))?;
        let tokens = msa::refresh(&state.http, &msa::client_id()?, &refresh_token).await?;
        let session = msa::minecraft_login(&state.http, &tokens.access_token).await?;
        acc.refresh_token = Some(tokens.refresh_token);
        acc.mc_token = Some(session.access_token);
        acc.mc_expires_at = now_secs() + session.expires_in;
        acc.account.name = session.name;
        store.save()?;
    }

    let acc = store.active_mut().expect("active account exists");
    Ok(Credentials {
        name: acc.account.name.clone(),
        uuid: acc.account.uuid.clone(),
        access_token: acc.mc_token.clone().unwrap_or_default(),
        user_type: "msa",
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offline_uuid_matches_vanilla() {
        // Known value: UUID.nameUUIDFromBytes("OfflinePlayer:Notch")
        assert_eq!(offline_uuid("Notch"), "b50ad385829d3141a2167e7d7539ba7f");
    }
}

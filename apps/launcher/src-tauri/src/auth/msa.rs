//! Microsoft → Xbox Live → XSTS → Minecraft sign-in chain.
//! https://learn.microsoft.com/entra/identity-platform/v2-oauth2-device-code

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::error::{msg, Result};

const DEVICE_CODE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const SCOPE: &str = "XboxLive.signin offline_access";
const XBL_URL: &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_URL: &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
const MC_LOGIN_URL: &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MC_PROFILE_URL: &str = "https://api.minecraftservices.com/minecraft/profile";

/// The Azure app (client) ID. Set NOVEX_MSA_CLIENT_ID at build time, or at runtime in dev.
pub fn client_id() -> Result<String> {
    std::env::var("NOVEX_MSA_CLIENT_ID")
        .ok()
        .or_else(|| option_env!("NOVEX_MSA_CLIENT_ID").map(str::to_string))
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            msg("Microsoft sign-in isn't configured. Set NOVEX_MSA_CLIENT_ID to your Azure app's client ID.")
        })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all(serialize = "camelCase"))]
pub struct DeviceCode {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(Debug, Deserialize)]
pub struct MsTokens {
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Debug, Deserialize)]
struct OAuthError {
    error: String,
    error_description: Option<String>,
}

pub enum Poll {
    Pending,
    SlowDown,
    Done(MsTokens),
}

pub async fn device_code(client: &Client, client_id: &str) -> Result<DeviceCode> {
    let resp = client
        .post(DEVICE_CODE_URL)
        .form(&[("client_id", client_id), ("scope", SCOPE)])
        .send()
        .await?;
    if !resp.status().is_success() {
        let e: OAuthError = resp.json().await?;
        return Err(msg(e.error_description.unwrap_or(e.error)));
    }
    Ok(resp.json().await?)
}

pub async fn poll(client: &Client, client_id: &str, device_code: &str) -> Result<Poll> {
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
            ("client_id", client_id),
            ("device_code", device_code),
        ])
        .send()
        .await?;
    if resp.status().is_success() {
        return Ok(Poll::Done(resp.json().await?));
    }
    let e: OAuthError = resp.json().await?;
    match e.error.as_str() {
        "authorization_pending" => Ok(Poll::Pending),
        "slow_down" => Ok(Poll::SlowDown),
        "expired_token" => Err(msg("The sign-in code expired. Try again.")),
        "authorization_declined" | "access_denied" => Err(msg("Sign-in was cancelled.")),
        _ => Err(msg(e.error_description.unwrap_or(e.error))),
    }
}

pub async fn refresh(client: &Client, client_id: &str, refresh_token: &str) -> Result<MsTokens> {
    let resp = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", client_id),
            ("refresh_token", refresh_token),
            ("scope", SCOPE),
        ])
        .send()
        .await?;
    if !resp.status().is_success() {
        return Err(msg(
            "Your Microsoft session expired. Remove the account and sign in again.",
        ));
    }
    Ok(resp.json().await?)
}

#[derive(Deserialize)]
struct XboxResponse {
    #[serde(rename = "Token")]
    token: String,
    #[serde(rename = "DisplayClaims")]
    display_claims: XboxClaims,
}

#[derive(Deserialize)]
struct XboxClaims {
    xui: Vec<XboxUser>,
}

#[derive(Deserialize)]
struct XboxUser {
    uhs: String,
}

#[derive(Deserialize)]
struct XstsError {
    #[serde(rename = "XErr")]
    xerr: u64,
}

#[derive(Deserialize)]
struct McLogin {
    access_token: String,
    expires_in: u64,
}

#[derive(Deserialize)]
struct McProfile {
    id: String,
    name: String,
}

pub struct McSession {
    pub access_token: String,
    pub expires_in: u64,
    pub uuid: String,
    pub name: String,
}

pub async fn minecraft_login(client: &Client, ms_access_token: &str) -> Result<McSession> {
    let xbl: XboxResponse = client
        .post(XBL_URL)
        .json(&json!({
            "Properties": {
                "AuthMethod": "RPS",
                "SiteName": "user.auth.xboxlive.com",
                "RpsTicket": format!("d={ms_access_token}"),
            },
            "RelyingParty": "http://auth.xboxlive.com",
            "TokenType": "JWT",
        }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let resp = client
        .post(XSTS_URL)
        .json(&json!({
            "Properties": { "SandboxId": "RETAIL", "UserTokens": [xbl.token] },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT",
        }))
        .send()
        .await?;
    if resp.status() == StatusCode::UNAUTHORIZED {
        let e: XstsError = resp.json().await?;
        return Err(msg(match e.xerr {
            2148916233 => "This Microsoft account has no Xbox profile. Sign in at minecraft.net once, then try again.",
            2148916235 => "Xbox Live isn't available in your country.",
            2148916236 | 2148916237 => "This account needs adult verification on xbox.com.",
            2148916238 => "This is a child account. An adult must add it to a Microsoft family first.",
            _ => "Xbox Live sign-in failed.",
        }));
    }
    let xsts: XboxResponse = resp.error_for_status()?.json().await?;
    let uhs = xsts
        .display_claims
        .xui
        .first()
        .map(|u| u.uhs.clone())
        .ok_or_else(|| msg("Xbox Live returned no user hash."))?;

    let mc: McLogin = client
        .post(MC_LOGIN_URL)
        .json(&json!({ "identityToken": format!("XBL3.0 x={uhs};{}", xsts.token) }))
        .send()
        .await?
        .error_for_status()
        .map_err(|_| {
            msg("Minecraft rejected the sign-in. New launchers must be approved by Mojang first.")
        })?
        .json()
        .await?;

    let resp = client
        .get(MC_PROFILE_URL)
        .bearer_auth(&mc.access_token)
        .send()
        .await?;
    if resp.status() == StatusCode::NOT_FOUND {
        return Err(msg(
            "This Microsoft account doesn't own Minecraft: Java Edition.",
        ));
    }
    let profile: McProfile = resp.error_for_status()?.json().await?;

    Ok(McSession {
        access_token: mc.access_token,
        expires_in: mc.expires_in,
        uuid: profile.id,
        name: profile.name,
    })
}

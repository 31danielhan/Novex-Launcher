//! CurseForge API v1. Needs an API key from https://console.curseforge.com, set as
//! NOVEX_CURSEFORGE_API_KEY at build time (or at runtime in dev), or saved in Settings.

use reqwest::{Client, Url};
use serde::de::DeserializeOwned;
use serde::Deserialize;

use super::{
    ContentFile, ContentKind, ContentVersion, ProjectInfo, SearchHit, SearchPage, SearchQuery,
    Source, Target, PAGE_SIZE,
};
use crate::error::{msg, Result};
use crate::loaders::LoaderKind;

const API: &str = "https://api.curseforge.com/v1";
const MINECRAFT: u32 = 432;
/// CurseForge only serves the first 10,000 results of a search.
const MAX_RESULTS: u32 = 10_000;

/// Key entered in Settings; it wins over the environment so users can replace a bad build key.
static SAVED_KEY: std::sync::RwLock<Option<String>> = std::sync::RwLock::new(None);

pub fn set_saved_key(key: Option<String>) {
    *SAVED_KEY.write().unwrap() = key.map(|k| k.trim().to_string()).filter(|k| !k.is_empty());
}

pub fn api_key() -> Option<String> {
    SAVED_KEY
        .read()
        .unwrap()
        .clone()
        .or_else(|| std::env::var("NOVEX_CURSEFORGE_API_KEY").ok())
        .or_else(|| option_env!("NOVEX_CURSEFORGE_API_KEY").map(str::to_string))
        .filter(|k| !k.trim().is_empty())
}

fn class_id(kind: ContentKind) -> u32 {
    match kind {
        ContentKind::Mod => 6,
        ContentKind::Modpack => 4471,
        ContentKind::ResourcePack => 12,
        ContentKind::Shader => 6552,
    }
}

pub fn kind_of_class(class: Option<u32>) -> Option<ContentKind> {
    Some(match class? {
        6 => ContentKind::Mod,
        4471 => ContentKind::Modpack,
        12 => ContentKind::ResourcePack,
        6552 => ContentKind::Shader,
        _ => return None,
    })
}

fn loader_type(l: LoaderKind) -> Option<u32> {
    match l {
        LoaderKind::Forge => Some(1),
        LoaderKind::Fabric => Some(4),
        LoaderKind::Quilt => Some(5),
        LoaderKind::NeoForge => Some(6),
        LoaderKind::Vanilla => None,
    }
}

const LOADER_NAMES: [&str; 4] = ["Forge", "Fabric", "Quilt", "NeoForge"];

fn key() -> Result<String> {
    api_key()
        .ok_or_else(|| msg("CurseForge needs an API key. Add one in Settings → Content sources."))
}

fn check(resp: reqwest::Response) -> Result<reqwest::Response> {
    match resp.status().as_u16() {
        401 | 403 => Err(msg(
            "CurseForge rejected the API key. Check it in Settings → Content sources.",
        )),
        _ => Ok(resp.error_for_status()?),
    }
}

async fn get<T: DeserializeOwned>(
    http: &Client,
    path: &str,
    params: &[(&str, String)],
) -> Result<T> {
    let u =
        Url::parse_with_params(&format!("{API}{path}"), params).map_err(|e| msg(e.to_string()))?;
    let resp = http.get(u).header("x-api-key", key()?).send().await?;
    Ok(check(resp)?.json().await?)
}

async fn post<T: DeserializeOwned>(
    http: &Client,
    path: &str,
    body: serde_json::Value,
) -> Result<T> {
    let resp = http
        .post(format!("{API}{path}"))
        .header("x-api-key", key()?)
        .json(&body)
        .send()
        .await?;
    Ok(check(resp)?.json().await?)
}

fn check_id(id: &str) -> Result<u64> {
    id.parse()
        .map_err(|_| msg("Invalid CurseForge project id."))
}

#[derive(Deserialize)]
struct Data<T> {
    data: T,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mod {
    pub id: u64,
    pub name: String,
    #[serde(default)]
    summary: String,
    #[serde(default)]
    download_count: f64,
    logo: Option<Logo>,
    #[serde(default)]
    authors: Vec<Author>,
    #[serde(default)]
    categories: Vec<Category>,
    links: Option<Links>,
    class_id: Option<u32>,
}

impl Mod {
    pub fn info(&self) -> ProjectInfo {
        ProjectInfo {
            title: self.name.clone(),
            icon_url: self.logo.as_ref().map(|l| l.thumbnail_url.clone()),
            kind: kind_of_class(self.class_id),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Logo {
    thumbnail_url: String,
}

#[derive(Deserialize)]
struct Author {
    name: String,
}

#[derive(Deserialize)]
struct Category {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Links {
    website_url: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Pagination {
    total_count: u64,
}

#[derive(Deserialize)]
struct SearchResponse {
    data: Vec<Mod>,
    pagination: Pagination,
}

pub async fn search(http: &Client, q: &SearchQuery) -> Result<SearchPage> {
    if q.offset + PAGE_SIZE > MAX_RESULTS {
        return Ok(SearchPage {
            hits: vec![],
            total: MAX_RESULTS as u64,
        });
    }
    let mut params = vec![
        ("gameId", MINECRAFT.to_string()),
        ("classId", class_id(q.kind).to_string()),
        ("searchFilter", q.query.trim().to_string()),
        ("sortField", "2".into()), // popularity
        ("sortOrder", "desc".into()),
        ("index", q.offset.to_string()),
        ("pageSize", PAGE_SIZE.to_string()),
    ];
    if let Some(v) = &q.game_version {
        params.push(("gameVersion", v.clone()));
    }
    if matches!(q.kind, ContentKind::Mod | ContentKind::Modpack) {
        if let Some(t) = q.loader.and_then(loader_type) {
            params.push(("modLoaderType", t.to_string()));
        }
    }
    let r: SearchResponse = get(http, "/mods/search", &params).await?;
    Ok(SearchPage {
        total: r.pagination.total_count.min(MAX_RESULTS as u64),
        hits: r
            .data
            .into_iter()
            .map(|m| SearchHit {
                source: Source::CurseForge,
                id: m.id.to_string(),
                author: m
                    .authors
                    .first()
                    .map(|a| a.name.clone())
                    .unwrap_or_default(),
                icon_url: m.logo.map(|l| l.thumbnail_url),
                downloads: m.download_count as u64,
                categories: m.categories.into_iter().map(|c| c.name).take(3).collect(),
                url: m
                    .links
                    .and_then(|l| l.website_url)
                    .unwrap_or_else(|| "https://www.curseforge.com/minecraft".into()),
                title: m.name,
                description: m.summary,
            })
            .collect(),
    })
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct File {
    pub id: u64,
    pub mod_id: u64,
    display_name: String,
    pub file_name: String,
    file_date: String,
    release_type: u8,
    #[serde(default)]
    game_versions: Vec<String>,
    pub download_url: Option<String>,
    file_length: Option<u64>,
    #[serde(default)]
    hashes: Vec<Hash>,
    #[serde(default)]
    dependencies: Vec<FileDependency>,
}

impl File {
    pub fn sha1(&self) -> Option<String> {
        self.hashes
            .iter()
            .find(|h| h.algo == 1)
            .map(|h| h.value.clone())
    }

    pub fn size(&self) -> Option<u64> {
        self.file_length
    }
}

#[derive(Deserialize)]
struct Hash {
    value: String,
    algo: u8,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileDependency {
    mod_id: u64,
    relation_type: u8,
}

fn to_version(f: File) -> ContentVersion {
    let (loaders, game_versions): (Vec<String>, Vec<String>) = f
        .game_versions
        .iter()
        .filter(|v| !matches!(v.as_str(), "Client" | "Server"))
        .cloned()
        .partition(|v| LOADER_NAMES.contains(&v.as_str()));
    ContentVersion {
        id: f.id.to_string(),
        version_number: f.display_name.clone(),
        name: f.display_name,
        game_versions,
        loaders: loaders.into_iter().map(|l| l.to_lowercase()).collect(),
        published: f.file_date,
        channel: match f.release_type {
            1 => "release",
            2 => "beta",
            _ => "alpha",
        }
        .into(),
        file: ContentFile {
            url: f.download_url,
            filename: f.file_name,
            sha1: f
                .hashes
                .iter()
                .find(|h| h.algo == 1)
                .map(|h| h.value.clone()),
            size: f.file_length,
        },
        // Relation type 3 is "required dependency".
        dependencies: f
            .dependencies
            .iter()
            .filter(|d| d.relation_type == 3)
            .map(|d| d.mod_id.to_string())
            .collect(),
    }
}

pub async fn versions(
    http: &Client,
    project: &str,
    kind: ContentKind,
    target: Option<&Target>,
) -> Result<Vec<ContentVersion>> {
    let id = check_id(project)?;
    let mut base = vec![("pageSize", "50".to_string())];
    if let Some(t) = target {
        base.push(("gameVersion", t.game_version.clone()));
    }
    // CurseForge filters one loader at a time; Quilt instances also take Fabric files.
    let loaders: Vec<Option<u32>> = match target {
        Some(t) if kind == ContentKind::Mod => {
            t.mod_loaders().into_iter().map(loader_type).collect()
        }
        _ => vec![None],
    };
    let mut files = Vec::new();
    for l in loaders {
        let mut params = base.clone();
        if let Some(l) = l {
            params.push(("modLoaderType", l.to_string()));
        }
        let page: Data<Vec<File>> = get(http, &format!("/mods/{id}/files"), &params).await?;
        files.extend(page.data);
    }
    let mut seen = std::collections::HashSet::new();
    let mut out: Vec<_> = files
        .into_iter()
        .filter(|f| seen.insert(f.id))
        .map(to_version)
        .collect();
    out.sort_by(|a, b| b.published.cmp(&a.published));
    Ok(out)
}

pub async fn project(http: &Client, id: &str) -> Result<ProjectInfo> {
    let m: Data<Mod> = get(http, &format!("/mods/{}", check_id(id)?), &[]).await?;
    Ok(m.data.info())
}

/// Files by id (for modpack manifests), in batches.
pub async fn files(http: &Client, ids: &[u64]) -> Result<Vec<File>> {
    let mut out = Vec::new();
    for chunk in ids.chunks(500) {
        let r: Data<Vec<File>> =
            post(http, "/mods/files", serde_json::json!({ "fileIds": chunk })).await?;
        out.extend(r.data);
    }
    Ok(out)
}

/// Projects by id (for modpack manifests), in batches.
pub async fn mods(http: &Client, ids: &[u64]) -> Result<Vec<Mod>> {
    let mut out = Vec::new();
    for chunk in ids.chunks(500) {
        let r: Data<Vec<Mod>> = post(http, "/mods", serde_json::json!({ "modIds": chunk })).await?;
        out.extend(r.data);
    }
    Ok(out)
}

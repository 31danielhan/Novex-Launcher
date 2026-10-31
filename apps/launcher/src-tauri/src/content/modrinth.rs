//! Modrinth API v2 (public, no key needed).

use reqwest::{Client, Url};
use serde::Deserialize;

use super::{
    ContentFile, ContentKind, ContentVersion, ProjectInfo, SearchHit, SearchPage, SearchQuery,
    Source, Target, PAGE_SIZE,
};
use crate::downloads;
use crate::error::{msg, Result};
use crate::loaders::LoaderKind;

const API: &str = "https://api.modrinth.com/v2";

fn project_type(kind: ContentKind) -> &'static str {
    match kind {
        ContentKind::Modpack => "modpack",
        ContentKind::Mod => "mod",
        ContentKind::ResourcePack => "resourcepack",
        ContentKind::Shader => "shader",
    }
}

fn kind_of(project_type: &str) -> Option<ContentKind> {
    Some(match project_type {
        "modpack" => ContentKind::Modpack,
        "mod" => ContentKind::Mod,
        "resourcepack" => ContentKind::ResourcePack,
        "shader" => ContentKind::Shader,
        _ => return None,
    })
}

fn loader_name(l: LoaderKind) -> &'static str {
    match l {
        LoaderKind::Vanilla => "minecraft",
        LoaderKind::Fabric => "fabric",
        LoaderKind::Quilt => "quilt",
        LoaderKind::Forge => "forge",
        LoaderKind::NeoForge => "neoforge",
    }
}

fn url(path: &str, params: &[(&str, String)]) -> Result<String> {
    Ok(Url::parse_with_params(&format!("{API}{path}"), params)
        .map_err(|e| msg(e.to_string()))?
        .into())
}

/// Path segments come from the UI; Modrinth ids and slugs never contain these.
fn check_id(id: &str) -> Result<&str> {
    if id.is_empty() || id.contains(['/', '?', '#', '.']) {
        return Err(msg("Invalid Modrinth project id."));
    }
    Ok(id)
}

#[derive(Deserialize)]
struct SearchResponse {
    hits: Vec<Hit>,
    total_hits: u64,
}

#[derive(Deserialize)]
struct Hit {
    project_id: String,
    slug: String,
    title: String,
    description: String,
    author: String,
    icon_url: Option<String>,
    downloads: u64,
    #[serde(default)]
    display_categories: Vec<String>,
    project_type: String,
}

pub async fn search(http: &Client, q: &SearchQuery) -> Result<SearchPage> {
    let mut facets = vec![vec![format!("project_type:{}", project_type(q.kind))]];
    if let Some(v) = &q.game_version {
        facets.push(vec![format!("versions:{v}")]);
    }
    // Resource packs and shaders use their own "loaders" (e.g. iris), so only mods and
    // modpacks are filtered by mod loader.
    if let Some(l) = q.loader.filter(|l| *l != LoaderKind::Vanilla) {
        if matches!(q.kind, ContentKind::Mod | ContentKind::Modpack) {
            let target = Target {
                game_version: String::new(),
                loader: l,
            };
            facets.push(
                target
                    .mod_loaders()
                    .into_iter()
                    .map(|l| format!("categories:{}", loader_name(l)))
                    .collect(),
            );
        }
    }
    let index = if q.query.trim().is_empty() {
        "downloads"
    } else {
        "relevance"
    };
    let u = url(
        "/search",
        &[
            ("query", q.query.trim().to_string()),
            ("facets", serde_json::to_string(&facets)?),
            ("index", index.into()),
            ("offset", q.offset.to_string()),
            ("limit", PAGE_SIZE.to_string()),
        ],
    )?;
    let r: SearchResponse = downloads::get_json(http, &u).await?;
    Ok(SearchPage {
        total: r.total_hits,
        hits: r
            .hits
            .into_iter()
            .map(|h| SearchHit {
                source: Source::Modrinth,
                url: format!("https://modrinth.com/{}/{}", h.project_type, h.slug),
                id: h.project_id,
                title: h.title,
                description: h.description,
                author: h.author,
                icon_url: h.icon_url.filter(|s| !s.is_empty()),
                downloads: h.downloads,
                categories: h.display_categories,
            })
            .collect(),
    })
}

#[derive(Deserialize)]
struct Version {
    id: String,
    name: String,
    version_number: String,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    date_published: String,
    version_type: String,
    files: Vec<VersionFile>,
    #[serde(default)]
    dependencies: Vec<Dependency>,
}

#[derive(Deserialize)]
struct VersionFile {
    url: String,
    filename: String,
    primary: bool,
    hashes: Hashes,
    size: u64,
}

#[derive(Deserialize)]
struct Hashes {
    sha1: Option<String>,
}

#[derive(Deserialize)]
struct Dependency {
    project_id: Option<String>,
    version_id: Option<String>,
    dependency_type: String,
}

pub async fn versions(
    http: &Client,
    project: &str,
    kind: ContentKind,
    target: Option<&Target>,
) -> Result<Vec<ContentVersion>> {
    let mut params = Vec::new();
    if let Some(t) = target {
        params.push(("game_versions", serde_json::to_string(&[&t.game_version])?));
        if kind == ContentKind::Mod {
            let loaders: Vec<_> = t.mod_loaders().into_iter().map(loader_name).collect();
            params.push(("loaders", serde_json::to_string(&loaders)?));
        }
    }
    let u = url(&format!("/project/{}/version", check_id(project)?), &params)?;
    let list: Vec<Version> = downloads::get_json(http, &u).await?;

    let mut out = Vec::with_capacity(list.len());
    for v in list {
        // Modpack versions hold one .mrpack; mods may have extra files (sources, dev jars).
        let Some(file) = v.files.iter().find(|f| f.primary).or(v.files.first()) else {
            continue;
        };
        let mut deps = Vec::new();
        for d in v
            .dependencies
            .iter()
            .filter(|d| d.dependency_type == "required")
        {
            match (&d.project_id, &d.version_id) {
                (Some(p), _) => deps.push(p.clone()),
                (None, Some(vid)) => {
                    if let Ok(p) = project_of_version(http, vid).await {
                        deps.push(p);
                    }
                }
                _ => {}
            }
        }
        out.push(ContentVersion {
            id: v.id,
            name: v.name,
            version_number: v.version_number,
            game_versions: v.game_versions,
            loaders: v.loaders,
            published: v.date_published,
            channel: v.version_type,
            file: ContentFile {
                url: Some(file.url.clone()),
                filename: file.filename.clone(),
                sha1: file.hashes.sha1.clone(),
                size: Some(file.size),
            },
            dependencies: deps,
        });
    }
    out.sort_by(|a, b| b.published.cmp(&a.published));
    Ok(out)
}

async fn project_of_version(http: &Client, version: &str) -> Result<String> {
    #[derive(Deserialize)]
    struct V {
        project_id: String,
    }
    let v: V = downloads::get_json(
        http,
        &url(&format!("/version/{}", check_id(version)?), &[])?,
    )
    .await?;
    Ok(v.project_id)
}

#[derive(Deserialize)]
struct Project {
    id: String,
    title: String,
    icon_url: Option<String>,
    project_type: String,
}

pub async fn project(http: &Client, id: &str) -> Result<ProjectInfo> {
    let p: Project =
        downloads::get_json(http, &url(&format!("/project/{}", check_id(id)?), &[])?).await?;
    Ok(ProjectInfo {
        title: p.title,
        icon_url: p.icon_url.filter(|s| !s.is_empty()),
        kind: kind_of(&p.project_type),
    })
}

/// Identifies files by sha1 (used for the files listed in a .mrpack).
/// Returns (sha1, project id, version id, version number) for each match.
pub async fn identify(
    http: &Client,
    sha1s: &[String],
) -> Result<Vec<(String, String, String, String)>> {
    #[derive(Deserialize)]
    struct V {
        id: String,
        project_id: String,
        version_number: String,
    }
    if sha1s.is_empty() {
        return Ok(vec![]);
    }
    let map: std::collections::HashMap<String, V> = http
        .post(format!("{API}/version_files"))
        .json(&serde_json::json!({ "hashes": sha1s, "algorithm": "sha1" }))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(map
        .into_iter()
        .map(|(h, v)| (h, v.project_id, v.id, v.version_number))
        .collect())
}

/// Title and icon for many projects at once.
pub async fn projects(http: &Client, ids: &[String]) -> Result<Vec<(String, ProjectInfo)>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let u = url("/projects", &[("ids", serde_json::to_string(ids)?)])?;
    let list: Vec<Project> = downloads::get_json(http, &u).await?;
    Ok(list
        .into_iter()
        .map(|p| {
            (
                p.id,
                ProjectInfo {
                    title: p.title,
                    icon_url: p.icon_url.filter(|s| !s.is_empty()),
                    kind: kind_of(&p.project_type),
                },
            )
        })
        .collect())
}

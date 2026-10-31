//! Mods, resource packs, shaders and modpacks from Modrinth and CurseForge.
//!
//! Each source exposes the same three calls (search, versions, project info), so installing
//! into an instance and resolving dependencies is written once here.

pub mod curseforge;
pub mod modpack;
pub mod modrinth;

use std::collections::{HashSet, VecDeque};
use std::path::{Path, PathBuf};

use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::downloads::{self, Download};
use crate::error::{msg, Result};
use crate::instances::{self, Instance};
use crate::loaders::LoaderKind;
use crate::platform::Paths;
use crate::AppState;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Modrinth,
    CurseForge,
}

impl Source {
    pub fn label(self) -> &'static str {
        match self {
            Source::Modrinth => "Modrinth",
            Source::CurseForge => "CurseForge",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentKind {
    Modpack,
    Mod,
    ResourcePack,
    Shader,
}

impl ContentKind {
    /// Folder inside the game directory.
    pub fn folder(self) -> &'static str {
        match self {
            ContentKind::Mod | ContentKind::Modpack => "mods",
            ContentKind::ResourcePack => "resourcepacks",
            ContentKind::Shader => "shaderpacks",
        }
    }

    const INSTALLABLE: [ContentKind; 3] = [
        ContentKind::Mod,
        ContentKind::ResourcePack,
        ContentKind::Shader,
    ];
}

/// What an instance can run: content is filtered to this.
#[derive(Debug, Clone)]
pub struct Target {
    pub game_version: String,
    pub loader: LoaderKind,
}

impl Target {
    pub fn of(inst: &Instance) -> Self {
        Self {
            game_version: inst.version.clone(),
            loader: inst.loader,
        }
    }

    /// Loaders whose mods run here. Quilt loads Fabric mods.
    pub fn mod_loaders(&self) -> Vec<LoaderKind> {
        match self.loader {
            LoaderKind::Quilt => vec![LoaderKind::Quilt, LoaderKind::Fabric],
            l => vec![l],
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub source: Source,
    pub kind: ContentKind,
    #[serde(default)]
    pub query: String,
    pub game_version: Option<String>,
    pub loader: Option<LoaderKind>,
    #[serde(default)]
    pub offset: u32,
}

pub const PAGE_SIZE: u32 = 20;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub source: Source,
    pub id: String,
    pub title: String,
    pub description: String,
    pub author: String,
    pub icon_url: Option<String>,
    pub downloads: u64,
    pub categories: Vec<String>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchPage {
    pub hits: Vec<SearchHit>,
    pub total: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentFile {
    /// `None` when the author doesn't allow downloads outside CurseForge.
    pub url: Option<String>,
    pub filename: String,
    pub sha1: Option<String>,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentVersion {
    pub id: String,
    pub name: String,
    pub version_number: String,
    pub game_versions: Vec<String>,
    pub loaders: Vec<String>,
    pub published: String,
    /// "release", "beta" or "alpha".
    pub channel: String,
    pub file: ContentFile,
    /// Project ids of required dependencies.
    #[serde(skip)]
    pub dependencies: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ProjectInfo {
    pub title: String,
    pub icon_url: Option<String>,
    pub kind: Option<ContentKind>,
}

pub async fn search(http: &Client, q: &SearchQuery) -> Result<SearchPage> {
    match q.source {
        Source::Modrinth => modrinth::search(http, q).await,
        Source::CurseForge => curseforge::search(http, q).await,
    }
}

/// Versions newest first, filtered to `target` when given.
pub async fn versions(
    http: &Client,
    source: Source,
    project: &str,
    kind: ContentKind,
    target: Option<&Target>,
) -> Result<Vec<ContentVersion>> {
    match source {
        Source::Modrinth => modrinth::versions(http, project, kind, target).await,
        Source::CurseForge => curseforge::versions(http, project, kind, target).await,
    }
}

pub async fn project(http: &Client, source: Source, id: &str) -> Result<ProjectInfo> {
    match source {
        Source::Modrinth => modrinth::project(http, id).await,
        Source::CurseForge => curseforge::project(http, id).await,
    }
}

/// The version to install when the user didn't pick one: newest release, else newest.
pub fn pick(list: &[ContentVersion]) -> Option<&ContentVersion> {
    list.iter()
        .find(|v| v.channel == "release")
        .or(list.first())
}

// ---- Installed content -------------------------------------------------------------------

/// Where installed files came from, kept in `<instance>/content.json`. Files the user added
/// by hand simply have no entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tracked {
    pub kind: ContentKind,
    pub file: String,
    pub source: Source,
    pub project_id: String,
    pub version_id: String,
    pub title: String,
    pub version: String,
    pub icon_url: Option<String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Manifest {
    pub items: Vec<Tracked>,
}

impl Manifest {
    fn path(paths: &Paths, id: &str) -> PathBuf {
        instances::dir(paths, id).join("content.json")
    }

    pub fn load(paths: &Paths, id: &str) -> Self {
        std::fs::read(Self::path(paths, id))
            .ok()
            .and_then(|b| serde_json::from_slice(&b).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, paths: &Paths, id: &str) -> Result<()> {
        std::fs::write(Self::path(paths, id), serde_json::to_vec_pretty(self)?)?;
        Ok(())
    }

    /// Adds or replaces the entry for a file, and drops other files of the same project.
    pub fn upsert(&mut self, t: Tracked) {
        self.items.retain(|i| {
            i.file != t.file && !(i.source == t.source && i.project_id == t.project_id)
        });
        self.items.push(t);
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledItem {
    pub kind: ContentKind,
    /// File name without the `.disabled` suffix.
    pub file: String,
    pub enabled: bool,
    pub title: String,
    pub version: Option<String>,
    pub icon_url: Option<String>,
    pub source: Option<Source>,
    pub project_id: Option<String>,
}

const DISABLED: &str = ".disabled";

/// Rejects names that could escape the content folder.
fn safe_file_name(name: &str) -> Result<&str> {
    if name.is_empty() || name.contains(['/', '\\']) || name.starts_with('.') {
        return Err(msg(format!("Unsafe file name: {name}")));
    }
    Ok(name)
}

pub fn list_installed(paths: &Paths, id: &str) -> Result<Vec<InstalledItem>> {
    instances::load(paths, id)?;
    let game = instances::game_dir(paths, id);
    let manifest = Manifest::load(paths, id);
    let mut out = Vec::new();
    for kind in ContentKind::INSTALLABLE {
        let Ok(entries) = std::fs::read_dir(game.join(kind.folder())) else {
            continue;
        };
        for e in entries.flatten() {
            if !e.file_type().is_ok_and(|t| t.is_file()) {
                continue;
            }
            let name = e.file_name().to_string_lossy().into_owned();
            let (file, enabled) = match name.strip_suffix(DISABLED) {
                Some(base) => (base.to_string(), false),
                None => (name, true),
            };
            let ext_ok = [".jar", ".zip", ".litemod"]
                .iter()
                .any(|x| file.ends_with(x));
            if !ext_ok {
                continue;
            }
            let tracked = manifest
                .items
                .iter()
                .find(|t| t.kind == kind && t.file == file);
            out.push(InstalledItem {
                kind,
                title: tracked.map_or_else(
                    || {
                        file.rsplit_once('.')
                            .map_or(file.clone(), |(b, _)| b.to_string())
                    },
                    |t| t.title.clone(),
                ),
                version: tracked.map(|t| t.version.clone()),
                icon_url: tracked.and_then(|t| t.icon_url.clone()),
                source: tracked.map(|t| t.source),
                project_id: tracked.map(|t| t.project_id.clone()),
                file,
                enabled,
            });
        }
    }
    out.sort_by_key(|i| i.title.to_lowercase());
    Ok(out)
}

fn content_path(paths: &Paths, id: &str, kind: ContentKind, file: &str) -> Result<PathBuf> {
    Ok(instances::game_dir(paths, id)
        .join(kind.folder())
        .join(safe_file_name(file)?))
}

fn with_disabled(p: &Path) -> PathBuf {
    let mut s = p.as_os_str().to_owned();
    s.push(DISABLED);
    PathBuf::from(s)
}

pub fn set_enabled(paths: &Paths, id: &str, kind: ContentKind, file: &str, on: bool) -> Result<()> {
    let enabled = content_path(paths, id, kind, file)?;
    let disabled = with_disabled(&enabled);
    let (from, to) = if on {
        (disabled, enabled)
    } else {
        (enabled, disabled)
    };
    if from.exists() {
        std::fs::rename(from, to)?;
    }
    Ok(())
}

pub fn remove(paths: &Paths, id: &str, kind: ContentKind, file: &str) -> Result<()> {
    let p = content_path(paths, id, kind, file)?;
    for f in [with_disabled(&p), p] {
        if f.exists() {
            std::fs::remove_file(f)?;
        }
    }
    let mut m = Manifest::load(paths, id);
    m.items.retain(|t| !(t.kind == kind && t.file == file));
    m.save(paths, id)
}

/// Installs a project into an instance, plus its required dependencies (for mods).
/// `version_id` picks a version; otherwise the newest compatible release is used.
/// Returns the titles of everything installed.
pub async fn install(
    http: &Client,
    paths: &Paths,
    inst: &Instance,
    source: Source,
    project_id: &str,
    kind: ContentKind,
    version_id: Option<&str>,
) -> Result<Vec<String>> {
    if kind == ContentKind::Modpack {
        return Err(msg("Modpacks are installed as new instances."));
    }
    if kind == ContentKind::Mod && inst.loader == LoaderKind::Vanilla {
        return Err(msg(
            "This is a vanilla instance. Mods need an instance with Fabric, Quilt, Forge or NeoForge.",
        ));
    }
    let target = Target::of(inst);
    let mut manifest = Manifest::load(paths, &inst.id);
    let mut queue = VecDeque::from([(project_id.to_string(), version_id.map(str::to_string))]);
    let mut seen = HashSet::new();
    let mut installed = Vec::new();

    while let Some((project, wanted)) = queue.pop_front() {
        if !seen.insert(project.clone()) {
            continue;
        }
        let is_root = project == project_id;
        // Dependencies that are already installed are left alone.
        if !is_root
            && manifest
                .items
                .iter()
                .any(|t| t.source == source && t.project_id == project)
        {
            continue;
        }
        let info = project_info_or_id(http, source, &project).await;
        let list = versions(http, source, &project, kind, Some(&target)).await?;
        let version = match &wanted {
            Some(w) => list.iter().find(|v| &v.id == w),
            None => pick(&list),
        }
        .ok_or_else(|| {
            msg(format!(
                "{} has no version for {} {}.",
                info.title,
                target.loader.label(),
                target.game_version
            ))
        })?;
        let url = version.file.url.clone().ok_or_else(|| {
            msg(format!(
                "The author of {} only allows downloads from the CurseForge website.",
                info.title
            ))
        })?;
        let path = content_path(paths, &inst.id, kind, &version.file.filename)?;

        // Updating: remove the previous file of this project.
        for old in manifest.items.iter().filter(|t| {
            t.source == source && t.project_id == project && t.file != version.file.filename
        }) {
            if let Ok(p) = content_path(paths, &inst.id, old.kind, &old.file) {
                let _ = std::fs::remove_file(with_disabled(&p));
                let _ = std::fs::remove_file(p);
            }
        }
        downloads::fetch_all(
            http,
            vec![Download {
                url,
                path,
                sha1: version.file.sha1.clone(),
                size: version.file.size,
            }],
            |_, _| {},
        )
        .await?;
        manifest.upsert(Tracked {
            kind,
            file: version.file.filename.clone(),
            source,
            project_id: project.clone(),
            version_id: version.id.clone(),
            title: info.title.clone(),
            version: version.version_number.clone(),
            icon_url: info.icon_url.clone(),
        });
        manifest.save(paths, &inst.id)?;
        installed.push(info.title);
        if kind == ContentKind::Mod {
            for dep in &version.dependencies {
                queue.push_back((dep.clone(), None));
            }
        }
    }
    Ok(installed)
}

async fn project_info_or_id(http: &Client, source: Source, id: &str) -> ProjectInfo {
    project(http, source, id).await.unwrap_or(ProjectInfo {
        title: id.to_string(),
        icon_url: None,
        kind: None,
    })
}

// ---- Commands ----------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Sources {
    pub curseforge: bool,
}

#[tauri::command]
pub fn content_sources() -> Sources {
    Sources {
        curseforge: curseforge::api_key().is_some(),
    }
}

#[tauri::command]
pub async fn content_search(state: State<'_, AppState>, query: SearchQuery) -> Result<SearchPage> {
    search(&state.http, &query).await
}

#[tauri::command]
pub async fn content_versions(
    state: State<'_, AppState>,
    source: Source,
    project_id: String,
    kind: ContentKind,
    instance_id: Option<String>,
) -> Result<Vec<ContentVersion>> {
    let target = match instance_id {
        Some(id) if kind != ContentKind::Modpack => {
            Some(Target::of(&instances::load(&state.paths, &id)?))
        }
        _ => None,
    };
    versions(&state.http, source, &project_id, kind, target.as_ref()).await
}

#[tauri::command]
pub async fn content_install(
    state: State<'_, AppState>,
    instance_id: String,
    source: Source,
    project_id: String,
    kind: ContentKind,
    version_id: Option<String>,
) -> Result<Vec<String>> {
    let inst = instances::load(&state.paths, &instance_id)?;
    install(
        &state.http,
        &state.paths,
        &inst,
        source,
        &project_id,
        kind,
        version_id.as_deref(),
    )
    .await
}

#[tauri::command]
pub fn content_list(state: State<'_, AppState>, instance_id: String) -> Result<Vec<InstalledItem>> {
    list_installed(&state.paths, &instance_id)
}

#[tauri::command]
pub fn content_set_enabled(
    state: State<'_, AppState>,
    instance_id: String,
    kind: ContentKind,
    file: String,
    enabled: bool,
) -> Result<()> {
    set_enabled(&state.paths, &instance_id, kind, &file, enabled)
}

#[tauri::command]
pub fn content_remove(
    state: State<'_, AppState>,
    instance_id: String,
    kind: ContentKind,
    file: String,
) -> Result<()> {
    remove(&state.paths, &instance_id, kind, &file)
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent {
    title: String,
    stage: String,
    done: usize,
    total: usize,
}

fn emitter(app: &AppHandle, title: String) -> impl Fn(&str, usize, usize) + Send + Sync + '_ {
    move |stage: &str, done: usize, total: usize| {
        let _ = app.emit(
            "modpack-progress",
            ProgressEvent {
                title: title.clone(),
                stage: stage.to_string(),
                done,
                total,
            },
        );
    }
}

#[tauri::command]
pub async fn modpack_install(
    app: AppHandle,
    state: State<'_, AppState>,
    source: Source,
    project_id: String,
    version_id: Option<String>,
    title: String,
) -> Result<modpack::Installed> {
    modpack::install_from_source(
        &state.http,
        &state.paths,
        source,
        &project_id,
        version_id.as_deref(),
        emitter(&app, title),
    )
    .await
}

#[tauri::command]
pub async fn modpack_import(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<modpack::Installed> {
    let title = Path::new(&path)
        .file_stem()
        .map_or("Modpack".into(), |s| s.to_string_lossy().into_owned());
    modpack::install_file(
        &state.http,
        &state.paths,
        Path::new(&path),
        None,
        emitter(&app, title),
    )
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn file_names_cannot_escape_the_folder() {
        assert!(safe_file_name("sodium.jar").is_ok());
        for bad in ["", "../x.jar", "a/b.jar", "a\\b.jar", ".hidden"] {
            assert!(safe_file_name(bad).is_err(), "{bad}");
        }
    }

    #[test]
    fn upsert_replaces_older_files_of_a_project() {
        let t = |file: &str| Tracked {
            kind: ContentKind::Mod,
            file: file.into(),
            source: Source::Modrinth,
            project_id: "p".into(),
            version_id: file.into(),
            title: "P".into(),
            version: file.into(),
            icon_url: None,
        };
        let mut m = Manifest::default();
        m.upsert(t("p-1.jar"));
        m.upsert(t("p-2.jar"));
        assert_eq!(m.items.len(), 1);
        assert_eq!(m.items[0].file, "p-2.jar");
    }
}

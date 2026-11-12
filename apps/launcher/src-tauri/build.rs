use std::{env, fs, path::Path};

fn main() {
    embed_client_jars();
    embed_curseforge_key();
    tauri_build::build()
}

/// Generates `client_jars.rs`: every Novex Client jar in resources/client, named `<loader>-<minecraft>.jar`
/// by apps/client/build-all.sh, embedded as (loader, minecraft version, bytes).
fn embed_client_jars() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/client");
    println!("cargo:rerun-if-changed={}", dir.display());
    let mut jars: Vec<_> = fs::read_dir(&dir)
        .map(|r| r.filter_map(|e| e.ok()).map(|e| e.path()).collect())
        .unwrap_or_default();
    jars.retain(|p| p.extension().is_some_and(|e| e == "jar"));
    jars.sort();

    let mut code = String::from("pub const JARS: &[(&str, &str, &[u8])] = &[\n");
    for jar in &jars {
        println!("cargo:rerun-if-changed={}", jar.display());
        let stem = jar.file_stem().unwrap().to_string_lossy();
        let (loader, mc) = stem
            .split_once('-')
            .expect("jar names are <loader>-<minecraft>.jar");
        code += &format!(
            "    ({loader:?}, {mc:?}, include_bytes!({:?})),\n",
            jar.display().to_string()
        );
    }
    code += "];\n";
    fs::write(
        Path::new(&env::var("OUT_DIR").unwrap()).join("client_jars.rs"),
        code,
    )
    .unwrap();
}

/// Generates `curseforge_key.rs`: the CurseForge API key from NOVEX_CURSEFORGE_API_KEY, scrambled
/// with a pad made fresh for each build, so the key never sits in the app as readable text.
fn embed_curseforge_key() {
    println!("cargo:rerun-if-env-changed=NOVEX_CURSEFORGE_API_KEY");
    let key = env::var("NOVEX_CURSEFORGE_API_KEY").unwrap_or_default();
    let key = key.trim().as_bytes();

    // A pad from the build's time and process, spread with xorshift.
    let mut state = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0x9E37_79B9_7F4A_7C15)
        ^ ((std::process::id() as u64) << 32)
        | 1;
    let pad: Vec<u8> = (0..key.len())
        .map(|_| {
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            (state >> 24) as u8
        })
        .collect();
    let scrambled: Vec<u8> = key.iter().zip(&pad).map(|(k, p)| k ^ p).collect();

    fs::write(
        Path::new(&env::var("OUT_DIR").unwrap()).join("curseforge_key.rs"),
        format!("const SCRAMBLED: &[u8] = &{scrambled:?};\nconst PAD: &[u8] = &{pad:?};\n"),
    )
    .unwrap();
}

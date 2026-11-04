use std::{env, fs, path::Path};

fn main() {
    embed_client_jars();
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

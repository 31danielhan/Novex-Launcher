#!/bin/bash
# Builds every version target and copies the jars into the launcher, with an index the
# launcher uses to pick the jar for an instance's Minecraft version and loader.
# Usage: ./build-all.sh [target...]   (default: every folder in versions/)
set -euo pipefail
cd "$(dirname "$0")"
out=../launcher/src-tauri/resources/client
mkdir -p "$out"
targets=("$@")
[ ${#targets[@]} -eq 0 ] && targets=($(ls versions))

for t in "${targets[@]}"; do
	echo "== $t"
	(
		cd "versions/$t"
		# 1.8.9 has its own Gradle 8.8 wrapper, which can't run on the newest JDKs.
		# Clean builds: a synced folder can leave conflict copies like "mods 2.toml" in build/,
		# which end up in the jar and crash Forge.
		if [ -x ./gradlew ]; then JAVA_HOME=$(/usr/libexec/java_home -v 21) ./gradlew --no-daemon -q clean build
		else ../../gradlew --no-daemon -q clean build ${GRADLE_ARGS:-}; fi
	)
	jar=$(ls versions/$t/build/libs/novex-client-$t-*.jar | grep -vE -- '-(dev|sources)\.jar$' | head -1)
	if unzip -Z1 "$jar" | grep -q ' '; then
		echo "$jar has entries with spaces in their names (conflict copies?):" >&2
		unzip -Z1 "$jar" | grep ' ' >&2
		exit 1
	fi
	cp "$jar" "$out/$t.jar"
done

# One entry per jar in the launcher folder: loader and the single Minecraft version it was built for.
python3 - "$out" <<'PY'
import json, os, sys
out = sys.argv[1]
entries = []
for f in sorted(os.listdir(out)):
    if f.endswith(".jar"):
        loader, mc = f[:-4].split("-", 1)
        entries.append({"file": f, "loader": loader, "minecraft": mc})
json.dump(entries, open(os.path.join(out, "index.json"), "w"), indent=2)
print(f"{len(entries)} jars in {out}")
PY

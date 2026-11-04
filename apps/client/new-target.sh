#!/bin/sh
# Copies a version adapter as the start of another: ./new-target.sh fabric-26.3 fabric-26.2 26.2 <fabric-api> <sodium>
set -e
cd "$(dirname "$0")/versions"
src=$1 dst=$2 mc=$3
rsync -a --exclude build --exclude .gradle "$src/" "$dst/"
sed -i '' "s/^minecraft_version=.*/minecraft_version=$mc/; s/^fabric_api_version=.*/fabric_api_version=$4/; s/^sodium_version=.*/sodium_version=$5/" "$dst/gradle.properties"
sed -i '' "s/${src}/${dst}/g" "$dst/settings.gradle" "$dst/build.gradle"

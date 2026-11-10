#!/bin/bash
# Builds the macOS Now Playing helper for the music module and copies it into every client build.
# It's loaded into /usr/bin/perl, which macOS still lets read what's playing (MediaRemote).
set -euo pipefail
cd "$(dirname "$0")"
clang -dynamiclib -arch arm64 -arch x86_64 -mmacosx-version-min=11.0 -fobjc-arc -O2 \
	-framework Foundation -framework AppKit -o novex-now-playing.dylib now-playing.m
for v in ../../versions/*/src/main/resources; do cp novex-now-playing.dylib "$v/"; done

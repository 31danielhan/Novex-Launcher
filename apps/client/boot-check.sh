#!/bin/bash
# Starts a target's dev client, waits for the title screen (or a crash), then closes it.
# Usage: [GRADLE_ARGS=-PnoSodium] ./boot-check.sh fabric-1.20.1 [timeout-seconds]
cd "$(dirname "$0")/versions/$1" || exit 2
log="../../boot-$1.log"
# 1.8.9 has its own Gradle 8.8 wrapper, which can't run on the newest JDKs.
if [ -x ./gradlew ]; then gw=./gradlew; export JAVA_HOME=$(/usr/libexec/java_home -v 21); else gw=../../gradlew; fi
$gw --no-daemon runClient $GRADLE_ARGS > "$log" 2>&1 &
pid=$!
for _ in $(seq "${2:-900}"); do
	sleep 1
	if grep -qE "Sound engine started|Minecraft has crashed|BUILD FAILED|Crash report saved" "$log" || ! kill -0 $pid 2>/dev/null; then break; fi
done
sleep 5
# Close the game and Gradle, which this script started.
pkill -P $pid; kill $pid 2>/dev/null; wait $pid 2>/dev/null
if grep -qE "was not applied|Mixin apply.*failed|Minecraft has crashed|BUILD FAILED|Crash report saved" "$log"; then
	echo "$1: FAILED"; grep -nE "was not applied|failed|crashed|Caused by|What went wrong" -A2 "$log" | head -20; exit 1
elif grep -q "Sound engine started" "$log"; then
	echo "$1: reached the title screen"; grep -E "novex|sodium" "$log" | grep -iE "^\s*- |Loading" | head -4
else
	echo "$1: timed out"; tail -3 "$log"; exit 1
fi

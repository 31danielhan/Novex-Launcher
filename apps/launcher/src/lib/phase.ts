import type { Status } from "../launcher";

export type Phase = "preparing" | "loading" | "menu" | "joining" | "playing" | "saving" | "closing";

/** Phases in the order a session usually goes through them; saving and closing sit outside it. */
export const phaseSteps: Phase[] = ["preparing", "loading", "menu", "joining", "playing"];

// Log lines that mark a change, newest wins. Same text across 1.8.9 to 26.x and every loader.
const markers: [RegExp, Phase][] = [
  [/Stopping!|Stopping singleplayer server|Stopping server/, "closing"],
  [/All (chunks|dimensions) are saved|ThreadedAnvilChunkStorage.*: All chunks are saved/, "playing"],
  [/Saving and pausing game|Saving chunks for level|Saving worlds|Saving the game/, "saving"],
  [/\[CHAT\]|joined the game|logged in with entity id|Loaded \d+ advancements/, "playing"],
  [/Preparing spawn area|Starting integrated minecraft server|Connecting to .*, \d+|Preparing start region/, "joining"],
  [/Sound engine started|OpenAL initialized|Created: \d+x\d+x\d+ minecraft:textures\/atlas\/(blocks|gui)/, "menu"],
];

/** Where a session is, from the launcher's status and the game's log so far. */
export function gamePhase(status: Status, logs: string[] | undefined): Phase | null {
  if (status.state === "idle") return null;
  if (status.state === "launching") return "preparing";
  const lines = logs ?? [];
  for (let i = lines.length - 1; i >= 0; i--) {
    for (const [re, phase] of markers) if (re.test(lines[i])) return phase;
  }
  return "loading";
}

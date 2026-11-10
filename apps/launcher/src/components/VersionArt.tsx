import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api, inTauri } from "../lib/api";
import { cx } from "./ui";

/** Each version's scene: a screenshot if one is in assets/versions, otherwise an original pixel scene drawn in code. */
const W = 112;
const H = 42;
type Px = (x: number, y: number, w: number, h: number, c: string) => void;
type Rand = () => number;

function pick(version: string) {
  const [a, b = 0] = version.split(".").map((n) => parseInt(n) || 0);
  if (a !== 1) return "copper";
  if (b <= 8) return "bedwars";
  if (b <= 12) return "plains";
  if (b <= 15) return "ocean";
  if (b === 16) return "nether";
  if (b <= 18) return "peaks";
  if (b === 19) return "deep";
  if (b === 20) return "cherry";
  return "trial";
}

function sky(px: Px, top: string, bottom: string) {
  const mix = (t: number) => {
    const n = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
    const ch = [0, 1, 2].map((i) => Math.round(n(top, i) + (n(bottom, i) - n(top, i)) * t));
    return `rgb(${ch.join(",")})`;
  };
  const bands = 7;
  for (let i = 0; i < bands; i++) px(0, Math.floor((i * H) / bands), W, Math.ceil(H / bands), mix(i / (bands - 1)));
}

/** Blocky terrain: a stepped ridge with a top layer and a fill. */
function ridge(px: Px, r: Rand, base: number, rough: number, top: string, fill: string, depth = 2) {
  let y = base;
  for (let x = 0; x < W; x += 2) {
    y = Math.max(base - rough, Math.min(base + rough, y + Math.round(r() * 2 - 1)));
    px(x, y + depth, 2, H - y, fill);
    px(x, y, 2, depth, top);
  }
}

function tree(px: Px, x: number, y: number, wood: string, leaf: string, leaf2: string) {
  px(x, y - 6, 2, 6, wood);
  px(x - 4, y - 10, 10, 4, leaf);
  px(x - 2, y - 12, 6, 2, leaf2);
}

function island(px: Px, x: number, y: number, w: number, bed: string) {
  px(x, y, w, 2, "#6fae4e");
  px(x, y + 2, w, 2, "#8a6242");
  px(x + 2, y + 4, w - 4, 2, "#8a6242");
  px(x + 5, y + 6, w - 10, 2, "#6d6d72");
  px(x + w / 2 - 3, y - 2, 4, 2, "#e8e4da");
  px(x + w / 2 + 1, y - 2, 4, 2, bed);
}

const scenes: Record<string, (px: Px, r: Rand) => void> = {
  bedwars(px) {
    sky(px, "#27304f", "#7fa6d8");
    island(px, 4, 25, 24, "#d6403c");
    island(px, 84, 25, 24, "#3f6fd6");
    island(px, 44, 15, 26, "#e4c23c");
    for (let x = 28; x < 44; x += 2) px(x, 25 - Math.floor((x - 28) / 2), 2, 1, "#e9e9ee");
    for (let x = 70; x < 84; x += 2) px(x, 18 + Math.floor((x - 70) / 2), 2, 1, "#e9e9ee");
    px(52, 9, 2, 6, "#3fc9c0");
    px(50, 11, 6, 2, "#3fc9c0");
  },
  plains(px, r) {
    sky(px, "#6ea8ee", "#cfe6fa");
    px(14, 7, 16, 3, "#ffffff");
    px(72, 5, 20, 3, "#ffffff");
    ridge(px, r, 27, 3, "#6cb14f", "#855f3f", 3);
    tree(px, 22, 27, "#6d4a2c", "#3f8c3a", "#55a549");
    tree(px, 84, 26, "#6d4a2c", "#3f8c3a", "#55a549");
    px(52, 18, 16, 10, "#b58a55");
    px(50, 15, 20, 3, "#7b5433");
  },
  ocean(px, r) {
    sky(px, "#1f8fc4", "#0d3f78");
    for (let i = 0; i < 22; i++) px(Math.floor(r() * W), Math.floor(r() * 24), 1, 1, "#7fd6ee");
    ridge(px, r, 33, 2, "#d9c98d", "#a99a66");
    for (const [x, c] of [[16, "#e0577f"], [34, "#e8a33c"], [60, "#a65ce0"], [92, "#e0577f"]] as const) {
      px(x, 25, 2, 8, c);
      px(x - 2, 28, 2, 2, c);
      px(x + 2, 26, 2, 2, c);
    }
  },
  nether(px, r) {
    sky(px, "#2a0d12", "#a12b1c");
    for (let x = 0; x < W; x += 4) px(x, 0, 4, 3 + Math.floor(r() * 7), "#4a1518");
    ridge(px, r, 29, 3, "#a3262d", "#5b1a1e", 2);
    px(0, 37, W, 5, "#ec7c1e");
    px(0, 37, W, 1, "#ffc23c");
    px(48, 15, 3, 15, "#5a2a6a");
    px(62, 15, 3, 15, "#5a2a6a");
    px(48, 12, 17, 3, "#1c1226");
    px(51, 15, 11, 15, "#9c4cd8");
  },
  peaks(px, r) {
    sky(px, "#7fb4e6", "#e5eef6");
    for (let i = 0; i < 3; i++) {
      const c = 18 + i * 38;
      for (let d = 0; d < 26; d += 2) {
        const top = 8 + d + i * 2;
        px(c - d, top, 2, H, d < 8 ? "#f2f6fa" : "#8f98a3");
        px(c + d, top, 2, H, d < 8 ? "#e2e9f0" : "#7c8590");
      }
    }
    ridge(px, r, 33, 2, "#5f9e52", "#6b7078");
  },
  deep(px, r) {
    sky(px, "#05131a", "#0d2c33");
    ridge(px, r, 31, 3, "#123f47", "#0a1d24", 2);
    for (let i = 0; i < 30; i++) px(Math.floor(r() * W), 26 + Math.floor(r() * 14), 1, 1, "#3ce0d4");
    px(50, 16, 12, 16, "#10252c");
    px(53, 19, 6, 6, "#3ce0d4");
    px(55, 21, 2, 2, "#e9fffb");
  },
  cherry(px, r) {
    sky(px, "#a8d0f2", "#fbe4ee");
    ridge(px, r, 29, 3, "#7dbb62", "#7a5a44", 2);
    tree(px, 24, 30, "#4a2d38", "#f4a8c8", "#fbcfe0");
    tree(px, 58, 28, "#4a2d38", "#f4a8c8", "#fbcfe0");
    tree(px, 90, 30, "#4a2d38", "#f4a8c8", "#fbcfe0");
    for (let i = 0; i < 26; i++) px(Math.floor(r() * W), 10 + Math.floor(r() * 24), 1, 1, "#fbcfe0");
  },
  trial(px, r) {
    sky(px, "#2b4a4f", "#1c2b30");
    for (let y = 0; y < H; y += 6)
      for (let x = (y / 6) % 2 ? 0 : 6; x < W; x += 12)
        px(x, y, 11, 5, r() > 0.5 ? "#b86f4b" : "#3f8f83");
    px(0, 34, W, 8, "#3d5258");
    px(46, 18, 20, 16, "#20292e");
    px(50, 22, 12, 8, "#e8a33c");
    px(54, 24, 4, 4, "#fff0b8");
  },
  copper(px, r) {
    sky(px, "#3d4a5c", "#d9a57e");
    ridge(px, r, 30, 3, "#6f9e8c", "#8c5a3c", 2);
    for (const x of [18, 44, 78]) {
      px(x, 16, 10, 15, "#c67f55");
      px(x + 2, 18, 6, 4, "#f0c97a");
      px(x - 1, 14, 12, 2, "#5fa596");
    }
  },
};

const cache = new Map<string, string>();

function render(scene: string) {
  const hit = cache.get(scene);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return "";
  // Same seed each time, so a scene never changes between visits.
  let seed = 1234567;
  for (const c of scene) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  scenes[scene]((x, y, w, h, c) => {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  }, rand);
  const url = canvas.toDataURL("image/png");
  cache.set(scene, url);
  return url;
}

/** Screenshots in assets/versions, named by version: 1.8.png, 1.20.jpg, 26.webp. */
const shots = import.meta.glob("../assets/versions/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

/** Images for this computer only, in assets/versions/local. Git ignores them, so releases never include them. */
const localShots = import.meta.glob("../assets/versions/local/*.{png,jpg,jpeg,webp}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

/** Versions that share another version's screenshot. */
const eras: Record<string, string> = {
  "0": "1.8", "1": "1.8", "2": "1.8", "3": "1.8", "4": "1.8", "5": "1.8", "6": "1.8", "7": "1.8",
  "10": "1.9", "11": "1.9", "12": "1.9", "15": "1.14",
};

function keyOf(version: string) {
  const [major, minor] = version.split(".");
  return major === "1" ? (eras[minor] ?? `1.${minor}`) : major;
}

function screenshot(version: string) {
  const key = keyOf(version);
  const find = (set: Record<string, string>) =>
    set[Object.keys(set).find((p) => p.split("/").pop()?.replace(/\.\w+$/, "") === key) ?? ""];
  return find(localShots) ?? find(shots) ?? null;
}

/** Images from the user's backgrounds folder, which win over everything shipped. Only hits are kept, so new files show up. */
const folderShots = new Map<string, string>();

function useFolderShot(version: string) {
  const key = keyOf(version);
  const [shot, setShot] = useState(() => folderShots.get(key) ?? null);
  useEffect(() => {
    if (!inTauri) return;
    let live = true;
    api
      .background(key)
      .then((url) => {
        if (url) folderShots.set(key, url);
        if (live) setShot(url);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [key]);
  return shot;
}

export function VersionArt({ version, className }: { version: string; className?: string }) {
  const folder = useFolderShot(version);
  const shipped = useMemo(() => screenshot(version), [version]);
  const shot = folder ?? shipped;
  const url = useMemo(() => shot ?? render(pick(version)), [shot, version]);
  return (
    <div
      aria-hidden
      className={cx("bg-cover", shot ? "bg-center" : "bg-[center_75%] [image-rendering:pixelated]", className)}
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}

/** The scene as a banner across the top of a card with p-5 padding. */
export function ArtBanner({ version }: { version: string }) {
  return <VersionArt version={version} className="-mx-5 -mt-5 mb-4 h-40 rounded-t-xl" />;
}

/** The scene behind a whole page. Portaled out because the page's entrance animation would trap a fixed element. */
export function PageBackdrop({ version }: { version: string }) {
  return createPortal(
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[-1]">
      <VersionArt version={version} className="absolute inset-0 animate-[fade_300ms_ease-out]" />
      {/* Fades the art behind the sidebar and title row, where text sits directly on it. */}
      <div className="absolute inset-0 bg-gradient-to-r from-bg from-[210px] via-bg/60 via-[340px] to-bg/40" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-bg from-40% to-transparent" />
    </div>,
    document.body,
  );
}

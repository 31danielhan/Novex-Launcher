/**
 * The options on the Game settings tab, grouped and named the way Minecraft's Options screen does.
 * Ids are the `options.txt` keys (or `key_key.*` for keybinds); the launcher converts each value to
 * the instance's version when it writes it (src-tauri/src/game_options.rs), and skips options an
 * older version doesn't have. `since` is the first version that has one.
 */

export type OptionValue = boolean | number | string;

export type GameOption =
  | { kind: "toggle"; id: string; label: string; def: boolean; on?: string; off?: string; since?: string }
  | {
      kind: "slider";
      id: string;
      label: string;
      def: number;
      min: number;
      max: number;
      step: number;
      show: (v: number) => string;
      since?: string;
    }
  | { kind: "cycle"; id: string; label: string; def: OptionValue; values: [OptionValue, string][]; since?: string };

export interface KeyBind {
  id: string;
  label: string;
  def: string;
  since?: string;
}

export interface OptionsPage {
  id: string;
  /** As on Minecraft's Options screen, without the trailing "...". */
  title: string;
  options: GameOption[];
}

const pct = (v: number) => (v === 0 ? "OFF" : `${v}%`);
const onOff = (v: boolean) => (v ? "ON" : "OFF");
export { onOff };

export const FOV: GameOption = {
  kind: "slider",
  id: "fov",
  label: "FOV",
  def: 70,
  min: 30,
  max: 110,
  step: 1,
  show: (v) => (v === 70 ? "Normal" : v === 110 ? "Quake Pro" : String(v)),
};

export const pages: OptionsPage[] = [
  {
    id: "skin",
    title: "Skin Customization",
    options: [
      { kind: "toggle", id: "modelPart_cape", label: "Cape", def: true },
      { kind: "toggle", id: "modelPart_jacket", label: "Jacket", def: true },
      { kind: "toggle", id: "modelPart_left_sleeve", label: "Left Sleeve", def: true },
      { kind: "toggle", id: "modelPart_right_sleeve", label: "Right Sleeve", def: true },
      { kind: "toggle", id: "modelPart_left_pants_leg", label: "Left Pants Leg", def: true },
      { kind: "toggle", id: "modelPart_right_pants_leg", label: "Right Pants Leg", def: true },
      { kind: "toggle", id: "modelPart_hat", label: "Hat", def: true },
      { kind: "cycle", id: "mainHand", label: "Main Hand", def: "right", values: [["left", "Left"], ["right", "Right"]], since: "1.9" },
    ],
  },
  {
    id: "sound",
    title: "Music & Sounds",
    options: [
      { kind: "slider", id: "soundCategory_master", label: "Master Volume", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_music", label: "Music", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_record", label: "Jukebox/Note Blocks", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_weather", label: "Weather", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_block", label: "Blocks", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_hostile", label: "Hostile Creatures", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_neutral", label: "Friendly Creatures", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_player", label: "Players", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_ambient", label: "Ambient/Environment", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "soundCategory_voice", label: "Voice/Speech", def: 100, min: 0, max: 100, step: 1, show: pct, since: "1.9" },
      { kind: "toggle", id: "showSubtitles", label: "Show Subtitles", def: false, since: "1.9" },
      { kind: "toggle", id: "directionalAudio", label: "Directional Audio", def: false, since: "1.19" },
    ],
  },
  {
    id: "video",
    title: "Video Settings",
    options: [
      { kind: "cycle", id: "graphics", label: "Graphics", def: "fancy", values: [["fast", "Fast"], ["fancy", "Fancy"], ["fabulous", "Fabulous!"]] },
      { kind: "slider", id: "renderDistance", label: "Render Distance", def: 12, min: 2, max: 32, step: 1, show: (v) => `${v} chunks` },
      { kind: "slider", id: "simulationDistance", label: "Simulation Distance", def: 12, min: 5, max: 32, step: 1, show: (v) => `${v} chunks`, since: "1.18" },
      { kind: "slider", id: "maxFps", label: "Max Framerate", def: 120, min: 10, max: 260, step: 10, show: (v) => (v >= 260 ? "Unlimited" : `${v} fps`) },
      { kind: "toggle", id: "enableVsync", label: "VSync", def: true },
      { kind: "toggle", id: "fullscreen", label: "Fullscreen", def: false },
      { kind: "cycle", id: "guiScale", label: "GUI Scale", def: 0, values: [[0, "Auto"], [1, "1"], [2, "2"], [3, "3"], [4, "4"]] },
      { kind: "slider", id: "gamma", label: "Brightness", def: 50, min: 0, max: 100, step: 1, show: (v) => (v === 0 ? "Moody" : v === 100 ? "Bright" : `+${v}%`) },
      { kind: "toggle", id: "ao", label: "Smooth Lighting", def: true },
      { kind: "cycle", id: "renderClouds", label: "Clouds", def: "true", values: [["true", "Fancy"], ["fast", "Fast"], ["false", "OFF"]] },
      { kind: "cycle", id: "particles", label: "Particles", def: 0, values: [[0, "All"], [1, "Decreased"], [2, "Minimal"]] },
      { kind: "slider", id: "mipmapLevels", label: "Mipmap Levels", def: 4, min: 0, max: 4, step: 1, show: (v) => (v === 0 ? "OFF" : String(v)) },
      { kind: "toggle", id: "entityShadows", label: "Entity Shadows", def: true },
      { kind: "toggle", id: "bobView", label: "View Bobbing", def: true },
      { kind: "cycle", id: "attackIndicator", label: "Attack Indicator", def: 1, values: [[0, "OFF"], [1, "Crosshair"], [2, "Hotbar"]], since: "1.9" },
      { kind: "slider", id: "biomeBlendRadius", label: "Biome Blend", def: 2, min: 0, max: 7, step: 1, show: (v) => (v === 0 ? "OFF" : `${v * 2 + 1}x${v * 2 + 1}`), since: "1.13" },
      { kind: "slider", id: "entityDistanceScaling", label: "Entity Distance", def: 100, min: 50, max: 500, step: 25, show: (v) => `${v}%`, since: "1.16" },
      { kind: "slider", id: "fovEffectScale", label: "FOV Effects", def: 100, min: 0, max: 100, step: 1, show: pct, since: "1.16" },
      { kind: "slider", id: "screenEffectScale", label: "Distortion Effects", def: 100, min: 0, max: 100, step: 1, show: pct, since: "1.16" },
    ],
  },
  {
    id: "controls",
    title: "Controls",
    options: [
      { kind: "slider", id: "mouseSensitivity", label: "Sensitivity", def: 100, min: 0, max: 200, step: 1, show: (v) => (v === 0 ? "*yawn*" : v === 200 ? "HYPERSPEED!!!" : `${v}%`) },
      { kind: "toggle", id: "invertYMouse", label: "Invert Mouse", def: false },
      { kind: "slider", id: "mouseWheelSensitivity", label: "Scroll Sensitivity", def: 1, min: 0.01, max: 10, step: 0.01, show: (v) => v.toFixed(2), since: "1.13" },
      { kind: "toggle", id: "discrete_mouse_scroll", label: "Discrete Scrolling", def: false, since: "1.13" },
      { kind: "toggle", id: "autoJump", label: "Auto-Jump", def: false, since: "1.11" },
      { kind: "toggle", id: "toggleCrouch", label: "Sneak", def: false, on: "Toggle", off: "Hold", since: "1.15" },
      { kind: "toggle", id: "toggleSprint", label: "Sprint", def: false, on: "Toggle", off: "Hold", since: "1.15" },
    ],
  },
  {
    id: "language",
    title: "Language",
    options: [
      {
        kind: "cycle",
        id: "lang",
        label: "Language",
        def: "en_us",
        values: [
          ["en_us", "English (US)"],
          ["en_gb", "English (UK)"],
          ["zh_cn", "简体中文 (中国大陆)"],
          ["zh_tw", "繁體中文 (台灣)"],
          ["es_es", "Español (España)"],
          ["es_mx", "Español (México)"],
          ["fr_fr", "Français (France)"],
          ["de_de", "Deutsch (Deutschland)"],
          ["pt_br", "Português (Brasil)"],
          ["ru_ru", "Русский (Россия)"],
          ["ja_jp", "日本語 (日本)"],
          ["ko_kr", "한국어 (대한민국)"],
          ["it_it", "Italiano (Italia)"],
          ["pl_pl", "Polski (Polska)"],
          ["nl_nl", "Nederlands (Nederland)"],
          ["tr_tr", "Türkçe (Türkiye)"],
          ["uk_ua", "Українська (Україна)"],
          ["sv_se", "Svenska (Sverige)"],
        ],
      },
    ],
  },
  {
    id: "chat",
    title: "Chat Settings",
    options: [
      { kind: "cycle", id: "chatVisibility", label: "Chat", def: 0, values: [[0, "Shown"], [1, "Commands Only"], [2, "Hidden"]] },
      { kind: "toggle", id: "chatColors", label: "Colors", def: true },
      { kind: "toggle", id: "chatLinks", label: "Web Links", def: true },
      { kind: "toggle", id: "chatLinksPrompt", label: "Prompt on Links", def: true },
      { kind: "slider", id: "chatOpacity", label: "Chat Text Opacity", def: 100, min: 10, max: 100, step: 1, show: (v) => `${v}%` },
      { kind: "slider", id: "textBackgroundOpacity", label: "Text Background Opacity", def: 50, min: 0, max: 100, step: 1, show: (v) => `${v}%`, since: "1.13" },
      { kind: "slider", id: "chatScale", label: "Chat Text Size", def: 100, min: 0, max: 100, step: 1, show: pct },
      { kind: "slider", id: "chatLineSpacing", label: "Line Spacing", def: 0, min: 0, max: 100, step: 1, show: (v) => `${v}%`, since: "1.16" },
      { kind: "slider", id: "chatDelay", label: "Chat Delay", def: 0, min: 0, max: 6, step: 0.1, show: (v) => (v === 0 ? "None" : `${v.toFixed(1)} seconds`), since: "1.16" },
      { kind: "slider", id: "chatWidth", label: "Width", def: 100, min: 0, max: 100, step: 1, show: (v) => `${Math.round(40 + (v / 100) * 280)}px` },
      { kind: "slider", id: "chatHeightFocused", label: "Focused Height", def: 100, min: 0, max: 100, step: 1, show: (v) => `${Math.round(20 + (v / 100) * 160)}px` },
      { kind: "slider", id: "chatHeightUnfocused", label: "Unfocused Height", def: 44, min: 0, max: 100, step: 1, show: (v) => `${Math.round(20 + (v / 100) * 160)}px` },
      { kind: "cycle", id: "narrator", label: "Narrator", def: 0, values: [[0, "OFF"], [1, "Narrates All"], [2, "Narrates Chat"], [3, "Narrates System"]], since: "1.12" },
      { kind: "toggle", id: "autoSuggestions", label: "Command Suggestions", def: true, since: "1.13" },
      { kind: "toggle", id: "hideMatchedNames", label: "Hide Matching Names", def: true, since: "1.16" },
      { kind: "toggle", id: "onlyShowSecureChat", label: "Only Show Secure Chat", def: false, since: "1.19" },
      { kind: "toggle", id: "reducedDebugInfo", label: "Reduced Debug Info", def: false },
    ],
  },
  {
    id: "accessibility",
    title: "Accessibility Settings",
    options: [
      { kind: "slider", id: "darknessEffectScale", label: "Darkness Pulsing", def: 100, min: 0, max: 100, step: 1, show: pct, since: "1.19" },
      { kind: "slider", id: "damageTiltStrength", label: "Damage Tilt", def: 100, min: 0, max: 100, step: 1, show: pct, since: "1.19.4" },
      { kind: "slider", id: "glintSpeed", label: "Glint Speed", def: 50, min: 0, max: 100, step: 1, show: pct, since: "1.19" },
      { kind: "slider", id: "glintStrength", label: "Glint Strength", def: 75, min: 0, max: 100, step: 1, show: pct, since: "1.19" },
      { kind: "toggle", id: "hideLightningFlashes", label: "Hide Lightning Flashes", def: false, since: "1.19" },
      { kind: "toggle", id: "highContrast", label: "High Contrast", def: false, since: "1.19.4" },
      { kind: "slider", id: "panoramaScrollSpeed", label: "Panorama Scroll Speed", def: 1, min: 0, max: 1, step: 0.05, show: (v) => `${Math.round(v * 100)}%`, since: "1.19" },
    ],
  },
];

/** Key binds, in Minecraft's categories and order. Values are key names as 1.13+ stores them. */
export const keyBinds: { category: string; binds: KeyBind[] }[] = [
  {
    category: "Movement",
    binds: [
      { id: "key_key.jump", label: "Jump", def: "key.keyboard.space" },
      { id: "key_key.sneak", label: "Sneak", def: "key.keyboard.left.shift" },
      { id: "key_key.sprint", label: "Sprint", def: "key.keyboard.left.control" },
      { id: "key_key.left", label: "Strafe Left", def: "key.keyboard.a" },
      { id: "key_key.right", label: "Strafe Right", def: "key.keyboard.d" },
      { id: "key_key.back", label: "Walk Backwards", def: "key.keyboard.s" },
      { id: "key_key.forward", label: "Walk Forwards", def: "key.keyboard.w" },
    ],
  },
  {
    category: "Gameplay",
    binds: [
      { id: "key_key.attack", label: "Attack/Destroy", def: "key.mouse.left" },
      { id: "key_key.pickItem", label: "Pick Block", def: "key.mouse.middle" },
      { id: "key_key.use", label: "Use Item/Place Block", def: "key.mouse.right" },
    ],
  },
  {
    category: "Inventory",
    binds: [
      { id: "key_key.drop", label: "Drop Selected Item", def: "key.keyboard.q" },
      ...Array.from({ length: 9 }, (_, i) => ({
        id: `key_key.hotbar.${i + 1}`,
        label: `Hotbar Slot ${i + 1}`,
        def: `key.keyboard.${i + 1}`,
      })),
      { id: "key_key.inventory", label: "Open/Close Inventory", def: "key.keyboard.e" },
      { id: "key_key.swapOffhand", label: "Swap Item With Offhand", def: "key.keyboard.f", since: "1.9" },
    ],
  },
  {
    category: "Creative Mode",
    binds: [
      { id: "key_key.loadToolbarActivator", label: "Load Hotbar Activator", def: "key.keyboard.x", since: "1.12" },
      { id: "key_key.saveToolbarActivator", label: "Save Hotbar Activator", def: "key.keyboard.c", since: "1.12" },
    ],
  },
  {
    category: "Multiplayer",
    binds: [
      { id: "key_key.playerlist", label: "List Players", def: "key.keyboard.tab" },
      { id: "key_key.chat", label: "Open Chat", def: "key.keyboard.t" },
      { id: "key_key.command", label: "Open Command", def: "key.keyboard.slash" },
      { id: "key_key.socialInteractions", label: "Social Interactions Screen", def: "key.keyboard.p", since: "1.16" },
    ],
  },
  {
    category: "Miscellaneous",
    binds: [
      { id: "key_key.advancements", label: "Advancements", def: "key.keyboard.l", since: "1.12" },
      { id: "key_key.spectatorOutlines", label: "Highlight Players (Spectators)", def: "key.keyboard.unknown", since: "1.8" },
      { id: "key_key.screenshot", label: "Take Screenshot", def: "key.keyboard.f2" },
      { id: "key_key.smoothCamera", label: "Toggle Cinematic Camera", def: "key.keyboard.unknown" },
      { id: "key_key.fullscreen", label: "Toggle Fullscreen", def: "key.keyboard.f11" },
      { id: "key_key.togglePerspective", label: "Toggle Perspective", def: "key.keyboard.f5" },
    ],
  },
];

/** The All versions sections: most-used first, with FOV among the video options. */
export const allPages: OptionsPage[] = ["video", "controls", "chat", "sound", "skin", "language", "accessibility"].map((id) => {
  const page = pages.find((p) => p.id === id)!;
  return id === "video" ? { ...page, options: [FOV, ...page.options] } : page;
});

/** The names 1.8 gives options that were renamed later, from its language file. */
const names18: Record<string, string> = {
  soundCategory_record: "Jukebox/Noteblocks",
  chatOpacity: "Opacity",
  chatScale: "Scale",
};

/** A page's options that 1.8 has, under 1.8's names. */
function from18(id: string): GameOption[] {
  return pages
    .find((p) => p.id === id)!
    .options.filter((o) => !o.since)
    .map((o) => ({ ...o, label: names18[o.id] ?? o.label }));
}

const flag = (id: string, label: string, def: boolean): GameOption => ({ kind: "toggle", id, label, def });

/** The 1.8 page of Game settings. Written only to versions before 1.9, over the shared options. */
export const pages18: OptionsPage[] = [
  {
    id: "video",
    title: "Video Settings",
    options: [
      FOV,
      ...from18("video").map((o): GameOption => {
        if (o.id === "graphics") return { kind: "cycle", id: o.id, label: o.label, def: "fancy", values: [["fast", "Fast"], ["fancy", "Fancy"]] };
        if (o.id === "ao") return { kind: "cycle", id: "ao", label: o.label, def: 2, values: [[0, "OFF"], [1, "Minimum"], [2, "Maximum"]] };
        return o;
      }),
      flag("useVbo", "Use VBOs", true),
      flag("anaglyph3d", "3D Anaglyph", false),
      flag("allowBlockAlternatives", "Alternate Blocks", true),
    ],
  },
  { id: "controls", title: "Controls", options: [...from18("controls"), flag("touchscreen", "Touchscreen Mode", false)] },
  {
    id: "chat",
    title: "Multiplayer Settings",
    options: [...from18("chat"), flag("snooperEnabled", "Allow Snooper", true), flag("realmsNotifications", "Realms Notifications", true)],
  },
  { id: "sound", title: "Music & Sounds", options: from18("sound") },
  { id: "skin", title: "Skin Customization", options: from18("skin") },
  { id: "language", title: "Language", options: [...from18("language"), flag("forceUnicodeFont", "Force Unicode Font", false)] },
  {
    id: "other",
    title: "Other",
    options: [
      flag("advancedItemTooltips", "Advanced Tooltips", false),
      flag("heldItemTooltips", "Held Item Tooltips", true),
      flag("pauseOnLostFocus", "Pause on Lost Focus", true),
    ],
  },
];

/** 1.8's key binds: everything except the ones added later. */
export const keyBinds18 = keyBinds
  .map((c) => ({ ...c, binds: c.binds.filter((b) => !b.since || b.since === "1.8") }))
  .filter((c) => c.binds.length > 0);

/** A shared option's value as the 1.8 page shows it, where 1.8 stores it differently. */
export function shown18(id: string, value: OptionValue | undefined): OptionValue | undefined {
  if (id === "graphics" && value === "fabulous") return "fancy";
  if (id === "ao" && typeof value === "boolean") return value ? 2 : 0;
  return value;
}

/** "W", "Left Shift", "Left Button": how Minecraft labels a key on the Key Binds screen. */
export function keyLabel(key: string): string {
  if (key === "key.keyboard.unknown") return "Not Bound";
  const mouse = key.match(/^key\.mouse\.(.+)$/);
  if (mouse) {
    const b = mouse[1];
    return b === "left" ? "Left Button" : b === "right" ? "Right Button" : b === "middle" ? "Middle Button" : `Button ${b}`;
  }
  const k = key.replace(/^key\.keyboard\./, "");
  const names: Record<string, string> = {
    space: "Space",
    "left.shift": "Left Shift",
    "right.shift": "Right Shift",
    "left.control": "Left Control",
    "right.control": "Right Control",
    "left.alt": "Left Alt",
    "right.alt": "Right Alt",
    tab: "Tab",
    enter: "Enter",
    backspace: "Backspace",
    slash: "/",
    "grave.accent": "`",
    "caps.lock": "Caps Lock",
    up: "Up Arrow",
    down: "Down Arrow",
    left: "Left Arrow",
    right: "Right Arrow",
  };
  return names[k] ?? k.toUpperCase();
}

/** Minecraft's key name for a browser key event, or null for keys it has no name for. */
export function keyFromEvent(e: KeyboardEvent): string | null {
  const code = e.code;
  const simple: Record<string, string> = {
    Space: "space",
    ShiftLeft: "left.shift",
    ShiftRight: "right.shift",
    ControlLeft: "left.control",
    ControlRight: "right.control",
    AltLeft: "left.alt",
    AltRight: "right.alt",
    Tab: "tab",
    Enter: "enter",
    Backspace: "backspace",
    Slash: "slash",
    Backquote: "grave.accent",
    Minus: "minus",
    Equal: "equal",
    BracketLeft: "left.bracket",
    BracketRight: "right.bracket",
    Semicolon: "semicolon",
    Quote: "apostrophe",
    Backslash: "backslash",
    Comma: "comma",
    Period: "period",
    CapsLock: "caps.lock",
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    Insert: "insert",
    Delete: "delete",
    Home: "home",
    End: "end",
    PageUp: "page.up",
    PageDown: "page.down",
  };
  let name = simple[code];
  if (!name && /^Key[A-Z]$/.test(code)) name = code.slice(3).toLowerCase();
  if (!name && /^Digit\d$/.test(code)) name = code.slice(5);
  if (!name && /^F([1-9]|1[0-2])$/.test(code)) name = code.toLowerCase();
  return name ? `key.keyboard.${name}` : null;
}

/** Minecraft's name for a mouse button from a browser event. */
export function keyFromMouse(button: number): string {
  return button === 0 ? "key.mouse.left" : button === 2 ? "key.mouse.right" : button === 1 ? "key.mouse.middle" : `key.mouse.${button + 1}`;
}

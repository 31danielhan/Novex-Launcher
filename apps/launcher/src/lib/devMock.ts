/**
 * A stand-in backend for previewing the interface in a browser: `npm run dev`, then open
 * http://localhost:1420/?mock. It answers the commands screens need to render with sample data, so
 * pages that only show in the desktop app can be checked. Development only; release builds drop it.
 */
if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) {
  const instances = [
    { id: "a", name: "Survival", version: "26.3", loader: "fabric", loaderVersion: "0.20.1", created: 0, playTimeSecs: 184000, useGameOptions: true },
    { id: "b", name: "PvP", version: "1.8.9", loader: "forge", loaderVersion: "11.15.1.2318", created: 0, playTimeSecs: 9000, useGameOptions: true },
  ];
  let settings: Record<string, unknown> = {
    maxMemoryMb: 4096,
    javaPath: null,
    jvmArgs: "",
    autoUpdate: true,
    curseforgeApiKey: null,
    gameOptionsLegacy: { renderDistance: 6, useVbo: true },
    gameOptions: { renderDistance: 16, fov: 90, toggleSprint: true, "key_key.sprint": "key.keyboard.r" },
    template: null,
  };
  const answers: Record<string, (args: Record<string, unknown>) => unknown> = {
    instances_list: () => instances,
    accounts_list: () => ({ accounts: [], active: null }),
    settings_get: () => settings,
    settings_set: (a) => (settings = a.settings as Record<string, unknown>),
    game_template_set: (a) => (settings = { ...settings, template: { name: instances.find((i) => i.id === a.instanceId)?.name, version: "26.3", includeConfig: a.includeConfig } }),
    game_template_clear: () => (settings = { ...settings, template: null }),
    "plugin:event|listen": () => 1,
    running_instances: () => [],
    content_sources: () => ({ curseforge: false }),
    content_search: () => ({ total: 1, hits: [{ source: "modrinth", id: "sodium", title: "Sodium", author: "jellysquid", description: "A performance mod.", downloads: 1000000, iconUrl: null, url: "https://modrinth.com", categories: ["optimization"] }] }),
    content_versions: (a) => (a.instanceId === "b" ? [] : [{ id: "v1", versionNumber: "0.6.0", channel: "release", loaders: ["fabric"], gameVersions: ["26.3"], published: "2026-10-01", file: { url: "https://example.com/a.jar" } }]),
    client_status: (a) => ({ enabled: a.instanceId === "b", unsupported: null, outdated: a.instanceId === "b" }),
    client_set_enabled: (a) => ({ enabled: a.enabled, unsupported: null, outdated: false }),
    client_update: () => ({ enabled: true, unsupported: null, outdated: false }),
    content_updates: (a) => (a.instanceId === "a" ? [{ kind: "mod", file: "sodium.jar", source: "modrinth", projectId: "sodium", versionId: "v2", version: "0.7.0" }] : []),
    update_info: () => ({ appVersion: "0.2.0", configured: true, uiVersion: null }),
    app_update_check: () => ({ version: "0.3.0", currentVersion: "0.2.0", notes: null }),
    content_list: () => [],
    content_install: () => ["Sodium"],
  };
  let callbacks = 0;
  Object.assign(window, {
    isTauri: true,
    __TAURI_INTERNALS__: {
      invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
        const answer = answers[cmd];
        if (!answer) throw new Error(`Not in the mock backend: ${cmd}`);
        return answer(args);
      },
      transformCallback: () => ++callbacks,
      unregisterCallback: () => {},
      metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    },
  });
}

export {};

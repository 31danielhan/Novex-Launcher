import { useEffect, useState } from "react";
import { t } from "../i18n";
import { useLauncher } from "../launcher";
import { useApp } from "../store";
import { api, errorText, inTauri, type Settings } from "../lib/api";
import {
  allPages,
  keyBinds,
  keyBinds18,
  keyLabel,
  onOff,
  pages18,
  shown18,
  type GameOption,
  type OptionValue,
} from "../lib/gameOptions";
import { useKeyCapture } from "../lib/useKeyCapture";
import { clientPages, moduleOptions } from "../lib/clientOptions";
import { Segmented, cx } from "../components/ui";
import { useSettings } from "./Settings";

type Options = Record<string, OptionValue>;
type SetOption = (id: string, value: OptionValue | null) => void;
type Edition = "all" | "1.8";
type Kind = "game" | "client";

/**
 * Settings shared by every instance: Minecraft's options, or Novex Client's. All versions goes to
 * every instance; 1.8 wins over it on versions before 1.9, and anything left alone there uses the
 * All versions value. Options never set keep each instance's own value.
 */
export function OptionTabs({ kind }: { kind: Kind }) {
  const [edition, setEdition] = useState<Edition>("all");
  return (
    <>
      <div className="mb-4 flex justify-center">
        <Segmented
          value={edition}
          onChange={(v) => setEdition(v as Edition)}
          options={[
            { value: "all", label: t("All versions") },
            { value: "1.8", label: "1.8" },
          ]}
        />
      </div>
      <Panel key={edition} kind={kind} edition={edition} />
    </>
  );
}

export function GameSettingsScreen() {
  return <OptionTabs kind="game" />;
}

function Panel({ kind, edition }: { kind: Kind; edition: Edition }) {
  const { s, save, setS } = useSettings();
  const legacy = edition === "1.8";
  const game = kind === "game";
  const pages = game ? (legacy ? pages18 : allPages) : clientPages(legacy);
  const binds = legacy ? keyBinds18 : keyBinds;
  const [section, setSection] = useState(pages[0].id);
  /** The client module whose options are open, by id. */
  const [open, setOpen] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const pending = useApp((a) => a.pendingSearch);

  useEffect(() => {
    if (pending?.target !== kind) return;
    setQuery(pending.query);
    useApp.getState().setPendingSearch(null);
  }, [pending, kind]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!s) return <p className="py-10 text-center text-[13px] text-muted">{t("Available in the desktop app.")}</p>;

  const base = game ? "gameOptions" : "clientOptions";
  const field = legacy ? (game ? "gameOptionsLegacy" : "clientOptionsLegacy") : base;
  const own: Options = s[field] ?? {};
  const shared: Options = legacy ? (s[base] ?? {}) : {};
  const write = (next: Options) => save({ ...s, [field]: next });
  const set: SetOption = (id, value) => {
    const next = { ...own };
    if (value === null) delete next[id];
    else next[id] = value;
    write(next);
  };
  const preview = (id: string, value: OptionValue) => setS({ ...s, [field]: { ...own, [id]: value } });
  const value = (id: string) => own[id] ?? shown18(id, shared[id]);

  const page = pages.find((p) => p.id === section);
  const optionsOf = (o: GameOption) => (game ? [] : (moduleOptions[o.id] ?? []));
  const ids = page
    ? page.options.flatMap((o) => [o.id, ...optionsOf(o).map((x) => x.id)])
    : binds.flatMap((c) => c.binds.map((b) => b.id));
  const opened = page?.options.find((o) => o.id === open);
  const q = query.trim().toLowerCase();
  const found = q
    ? pages
        .flatMap((p) => p.options.flatMap((o) => [o, ...optionsOf(o)]))
        .filter((o) => t(o.label).toLowerCase().includes(q) || o.label.toLowerCase().includes(q))
    : [];
  const resetSection = () => write(Object.fromEntries(Object.entries(own).filter(([id]) => !ids.includes(id))));
  const nav = (id: string, label: string) => (
    <button key={id} className={cx(section === id && "nvx-on")} onClick={() => { setSection(id); setOpen(null); }}>
      {label}
    </button>
  );

  return (
    <div className="nvx-panel mx-auto max-w-4xl">
      <header className="nvx-head">
        <span className="nvx-logo">N</span>
        <span className="font-semibold">Novex</span>
        <span className="nvx-version">{legacy ? "1.8" : t("All versions")}</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search settings")}
          aria-label={t("Search settings")}
          spellCheck={false}
          className="nvx-search ml-auto"
        />
        {section !== "template" && (
          <button className="nvx-ghost" onClick={resetSection}>
            {t("Reset section")}
          </button>
        )}
      </header>
      <div className="flex min-h-[460px]">
        <nav className="nvx-side">
          {pages.map((p) => nav(p.id, t(p.title)))}
          {game && nav("keys", t("Key Binds"))}
          {game && !legacy && nav("template", t("Copy from Instance"))}
        </nav>
        <main key={`${section}/${open}`} className="min-w-0 flex-1 p-4">
          {q ? (
            found.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {found.map((o) => (
                  <Card key={o.id} option={o} value={value(o.id)} isSet={own[o.id] !== undefined} set={set} preview={preview} />
                ))}
              </div>
            ) : (
              <p className="nvx-note mt-0">{t("Nothing matches “{query}”.", { query })}</p>
            )
          ) : section === "template" ? (
            <Template s={s} setS={setS} />
          ) : opened ? (
            <>
              <button className="nvx-ghost mb-3" onClick={() => setOpen(null)}>
                ← {t(page!.title)}
              </button>
              <h3 className="mb-3 text-[15px] font-semibold">{t(opened.label)}</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[opened, ...optionsOf(opened)].map((o) => (
                  <Card key={o.id} option={o} value={value(o.id)} isSet={own[o.id] !== undefined} set={set} preview={preview} />
                ))}
              </div>
            </>
          ) : page ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {page.options.map((o) => (
                <Card
                  key={o.id}
                  option={o}
                  value={value(o.id)}
                  isSet={own[o.id] !== undefined}
                  set={set}
                  preview={preview}
                  onOpen={optionsOf(o).length ? () => setOpen(o.id) : undefined}
                />
              ))}
            </div>
          ) : (
            <Keys binds={binds} own={own} shared={shared} set={set} />
          )}
          {!q && section !== "template" && (
            <p className="nvx-note">
              {!game
                ? legacy
                  ? t("Used on 1.8 instances, over the All versions page. Anything you leave alone comes from there. Right-click to reset.")
                  : t("Written into every instance with Novex Client before it launches. Options you haven't changed stay as each instance has them.")
                : legacy
                ? t("Used on 1.8 instances, over the All versions page. Anything you leave alone comes from there. Right-click to reset.")
                : t("Written into every instance before it launches, so new ones play the same. Options you haven't changed stay as each instance has them. Sodium and other performance mods use these too.")}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

function Card({
  option: o,
  value,
  isSet,
  set,
  preview,
  onOpen,
}: {
  option: GameOption;
  value: OptionValue | undefined;
  isSet: boolean;
  set: SetOption;
  preview: (id: string, v: OptionValue) => void;
  /** Opens the option's own page, for client modules that have one. */
  onOpen?: () => void;
}) {
  const reset = (e: React.MouseEvent) => {
    e.preventDefault();
    set(o.id, null);
  };
  const name = (
    <>
      {t(o.label)}
      {o.since && <span className="nvx-since">{o.since}+</span>}
    </>
  );
  const head = onOpen ? (
    <button className={cx("nvx-name nvx-open w-full", isSet && "nvx-set")} onClick={onOpen}>
      {name}
      <span className="nvx-more">{t("Options")} ›</span>
    </button>
  ) : (
    <p className={cx("nvx-name", isSet && "nvx-set")}>{name}</p>
  );

  if (o.kind === "toggle") {
    const on = typeof value === "boolean" ? value : o.def;
    return (
      <div className="nvx-card" onContextMenu={reset}>
        {head}
        <button className={on ? "nvx-state nvx-enabled" : "nvx-state nvx-disabled"} onClick={() => set(o.id, !on)}>
          {on ? t("ENABLED") : t("DISABLED")}
        </button>
      </div>
    );
  }
  if (o.kind === "slider") {
    const v = typeof value === "number" ? value : o.def;
    return (
      <div className="nvx-card" onContextMenu={reset}>
        {head}
        <div className="nvx-range">
          <span>{t(o.show(v))}</span>
          <input
            type="range"
            min={o.min}
            max={o.max}
            step={o.step}
            value={v}
            aria-label={t(o.label)}
            style={{ "--at": `${((v - o.min) / (o.max - o.min)) * 100}%` } as React.CSSProperties}
            onChange={(e) => preview(o.id, Number(e.target.value))}
            onPointerUp={(e) => set(o.id, Number((e.target as HTMLInputElement).value))}
            onKeyUp={(e) => set(o.id, Number((e.target as HTMLInputElement).value))}
          />
        </div>
      </div>
    );
  }
  if (o.id === "lang") {
    const current = value ?? o.def;
    return (
      <div className="nvx-card sm:col-span-2 lg:col-span-3" onContextMenu={reset}>
        {head}
        <div className="grid grid-cols-1 gap-1.5 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {o.values.map(([code, name]) => (
            <button key={String(code)} className={cx("nvx-key", current === code && "nvx-on")} onClick={() => set(o.id, code)}>
              {t(String(name))}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const i = Math.max(0, o.values.findIndex(([x]) => x === (value ?? o.def)));
  return (
    <div className="nvx-card" onContextMenu={reset}>
      {head}
      <button
        className="nvx-state nvx-cycle"
        onClick={(e) => set(o.id, o.values[(i + (e.shiftKey ? o.values.length - 1 : 1)) % o.values.length][0])}
      >
        {t(String(o.values[i][1]))}
      </button>
    </div>
  );
}

function Keys({
  binds,
  own,
  shared,
  set,
}: {
  binds: typeof keyBinds;
  own: Options;
  shared: Options;
  set: SetOption;
}) {
  const all = binds.flatMap((c) => c.binds);
  const keyOf = (id: string, def: string) => String(own[id] ?? shared[id] ?? def);
  const [waiting, setWaiting] = useKeyCapture((id, key) => {
    const bind = all.find((b) => b.id === id)!;
    // Back to the game's own key means "not set by the launcher".
    set(id, key === bind.def && own[id] === undefined && shared[id] === undefined ? null : key);
  });
  const used = new Map<string, number>();
  for (const b of all) {
    const k = keyOf(b.id, b.def);
    if (k !== "key.keyboard.unknown") used.set(k, (used.get(k) ?? 0) + 1);
  }

  return (
    <>
      {binds.map((cat) => (
        <section key={cat.category} className="mb-4">
          <h3 className="nvx-group">{t(cat.category)}</h3>
          {cat.binds.map((b) => {
            const k = keyOf(b.id, b.def);
            return (
              <div key={b.id} className="nvx-row" onContextMenu={(e) => (e.preventDefault(), set(b.id, null))}>
                <span className={cx("nvx-bind", own[b.id] !== undefined && "nvx-set")}>
                  {t(b.label)}
                  {b.since && <span className="nvx-since">{b.since}+</span>}
                </span>
                <button
                  className={cx("nvx-key", waiting === b.id && "nvx-on", (used.get(k) ?? 0) > 1 && waiting !== b.id && "nvx-clash")}
                  onClick={() => setWaiting(b.id)}
                >
                  {waiting === b.id ? `> ${t(keyLabel(k))} <` : t(keyLabel(k))}
                </button>
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}

/** Copy one instance's whole setup (every option and keybind, and optionally mod settings) to new ones. */
function Template({ s, setS }: { s: Settings; setS: (s: Settings) => void }) {
  const { instances, setError, setNotice } = useLauncher();
  const [from, setFrom] = useState(instances[0]?.id ?? "");
  const [config, setConfig] = useState(true);
  const tpl = s.template;
  const inst = instances.find((i) => i.id === from);

  const use = async () => {
    if (!inst || !inTauri) return;
    try {
      setS(await api.setTemplate(inst.id, config));
      setNotice(t("New instances will start with {name}'s settings.", { name: inst.name }));
    } catch (e) {
      setError(errorText(e));
    }
  };

  return (
    <div className="mx-auto grid max-w-md gap-2">
      <p className="nvx-note mb-2 mt-0">
        {t(
          "Copies an instance's keybinds and every game setting into instances that haven't been played yet. Keybinds changed format in 1.13, so a template only goes to instances on the same side of it.",
        )}
      </p>
      {tpl && (
        <button className="nvx-key" onClick={async () => setS(await api.clearTemplate())}>
          {t("Stop using {name}", { name: tpl.name })}
        </button>
      )}
      {instances.length > 0 ? (
        <>
          <button
            className="nvx-key"
            onClick={() => setFrom(instances[(instances.findIndex((i) => i.id === from) + 1) % instances.length].id)}
          >
            {t("Instance")}: {inst?.name ?? "—"} ({inst?.version})
          </button>
          <button className="nvx-key" onClick={() => setConfig(!config)}>
            {t("Include mod settings")}: {t(onOff(config))}
          </button>
          <button className="nvx-key nvx-on" onClick={use}>
            {tpl ? t("Replace template") : t("Use as template")}
          </button>
        </>
      ) : (
        <p className="nvx-note">{t("Create and play an instance first.")}</p>
      )}
    </div>
  );
}

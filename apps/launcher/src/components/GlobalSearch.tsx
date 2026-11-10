import { useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Compass, Search, Settings2, type LucideIcon } from "lucide-react";
import { t } from "../i18n";
import { useLauncher } from "../launcher";
import { describe } from "../lib/api";
import { clientPages, moduleOptions } from "../lib/clientOptions";
import { allPages } from "../lib/gameOptions";
import { useApp, type Screen } from "../store";
import { cx } from "./ui";

interface Result {
  key: string;
  label: string;
  note: string;
  icon: LucideIcon;
  go: () => void;
}

const screens: [Screen, string][] = [
  ["home", "Home"],
  ["instances", "Instances"],
  ["browse", "Browse"],
  ["client", "Novex Client"],
  ["game", "Game settings"],
  ["settings", "Settings"],
];
const launcherSettings = ["Account", "Java", "Updates", "Content sources", "Appearance", "About"];
const MAX_RESULTS = 8;

/** The top bar's search: instances, every setting and page, then mods and modpacks. */
export function GlobalSearch() {
  const instances = useLauncher((s) => s.instances);
  const openContent = useLauncher((s) => s.openContent);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return [];
    const app = useApp.getState();
    const search = (target: "game" | "client" | "browse", screen: Screen, text: string) => {
      app.setPendingSearch({ target, query: text });
      app.setScreen(screen);
    };
    const option = (kind: "game" | "client", screen: Screen, area: string) => (label: string): Result => ({
      key: `${kind}/${label}`,
      label: t(label),
      note: t(area),
      icon: Settings2,
      go: () => search(kind, screen, t(label)),
    });
    const client = clientPages(true).flatMap((p) =>
      p.options.flatMap((o) => [o, ...(moduleOptions[o.id] ?? [])]).map((o) => o.label),
    );
    const game = allPages.flatMap((p) => p.options.map((o) => o.label));
    const all: Result[] = [
      ...instances.map((i) => ({
        key: `instance/${i.id}`,
        label: i.name,
        note: describe(i),
        icon: Boxes,
        go: () => {
          openContent(i.id);
          app.setScreen("instances");
        },
      })),
      ...screens.map(([id, label]) => ({
        key: `screen/${id}`,
        label: t(label),
        note: t("Open"),
        icon: Compass,
        go: () => app.setScreen(id),
      })),
      ...launcherSettings.map((label) => ({
        key: `settings/${label}`,
        label: t(label),
        note: t("Settings"),
        icon: Settings2,
        go: () => app.setScreen("settings"),
      })),
      ...[...new Set(client)].map(option("client", "client", "Novex Client")),
      ...[...new Set(game)].map(option("game", "game", "Game settings")),
    ];
    const matches = all.filter((r) => r.label.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
    matches.push({
      key: "browse",
      label: t("Search mods and modpacks for “{query}”", { query: query.trim() }),
      note: t("Browse"),
      icon: Search,
      go: () => search("browse", "browse", query.trim()),
    });
    return matches;
  }, [q, query, instances, openContent]);

  useEffect(() => setAt(0), [q]);
  useEffect(() => {
    const away = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", away);
    return () => window.removeEventListener("mousedown", away);
  }, []);

  const choose = (r: Result) => {
    r.go();
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={box} className="relative w-64 min-w-[8rem] shrink">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          else if (e.key === "ArrowDown" && results.length) setAt((at + 1) % results.length);
          else if (e.key === "ArrowUp" && results.length) setAt((at + results.length - 1) % results.length);
          else if (e.key === "Enter" && results[at]) choose(results[at]);
          else return;
          e.preventDefault();
        }}
        placeholder={t("Search settings, instances, mods")}
        aria-label={t("Search settings, instances, mods")}
        spellCheck={false}
        className="glass hairline shadow-card h-10 w-full rounded-lg border bg-surface pl-9 pr-3 text-[13px] outline-none transition placeholder:text-muted focus:border-accent/60"
      />
      {open && results.length > 0 && (
        <div className="hairline absolute right-0 top-full z-40 mt-2 max-h-96 w-96 overflow-y-auto rounded-xl border bg-surface p-1.5 shadow-2xl">
          {results.map((r, i) => (
            <button
              key={r.key}
              onMouseEnter={() => setAt(i)}
              onClick={() => choose(r)}
              className={cx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === at && "bg-fg/[0.06]")}
            >
              <r.icon size={15} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-[13px]">{r.label}</span>
              <span className="shrink-0 text-[11px] text-muted">{r.note}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

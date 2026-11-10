import { t } from "./i18n";
import { useCallback, useEffect, useState } from "react";
import logo from "./assets/logo.svg";
import { ArrowUpCircle, CheckCircle2, Loader2, Plus, UserRound, X } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { GlobalSearch } from "./components/GlobalSearch";
import { AccountsDialog, Avatar } from "./components/AccountsDialog";
import { NewInstanceDialog } from "./components/NewInstanceDialog";
import { LogsDialog } from "./components/LogsDialog";
import { progressLabel } from "./components/InstanceCard";
import { cx } from "./components/ui";
import { useApp, type Screen } from "./store";
import { languages, resolveLanguage } from "./i18n";
import { initLauncher, useLauncher } from "./launcher";
import { HomeScreen } from "./screens/Home";
import { InstancesScreen } from "./screens/Instances";
import { BrowseScreen } from "./screens/Browse";
import { ClientScreen } from "./screens/Client";
import { SettingsScreen } from "./screens/Settings";
import { GameSettingsScreen } from "./screens/GameSettings";

const titles: Record<Screen, string> = {
  home: "Home",
  instances: "Instances",
  browse: "Browse",
  client: "Novex Client",
  game: "Game settings",
  settings: "Settings",
};

const screens: Record<Screen, () => JSX.Element> = {
  home: HomeScreen,
  instances: InstancesScreen,
  browse: BrowseScreen,
  client: ClientScreen,
  game: GameSettingsScreen,
  settings: SettingsScreen,
};

function TopBar({ title }: { title: string }) {
  const { accounts, activeAccount, openAccounts, openNewInstance } = useLauncher();
  const active = accounts.find((a) => a.uuid === activeAccount);
  const name = active?.name;

  return (
    <header data-tauri-drag-region className="flex items-center gap-3 px-6 pb-4 pt-5">
      <h1 data-tauri-drag-region className="display flex-1 select-none whitespace-nowrap text-[26px] font-semibold">
        {title}
      </h1>
      <UpdateButton />
      <GlobalSearch />
      <button
        onClick={() => openNewInstance(true)}
        className="lift press flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-accent px-4 text-[13px] font-semibold text-accent-fg transition hover:brightness-110"
      >
        <Plus size={15} />
        {t("New instance")}
      </button>
      <button
        onClick={() => openAccounts(true)}
        aria-label={name ?? t("Sign in")}
        title={name ?? t("Sign in")}
        className="glass hairline shadow-card grid h-10 w-10 shrink-0 place-items-center rounded-lg border bg-surface text-muted transition hover:text-fg"
      >
        {active ? <Avatar key={active.uuid} account={active} size={24} /> : <UserRound size={17} />}
      </button>
    </header>
  );
}

function UpdateButton() {
  const { available, updating, applyUpdate } = useLauncher();
  if (!available) return null;
  const label =
    available.kind === "app"
      ? t("Update to {version}", { version: available.update.version })
      : t("New interface {version}", { version: available.version });
  const pct =
    updating?.total ? Math.round((updating.downloaded / updating.total) * 100) : null;
  return (
    <button
      onClick={applyUpdate}
      disabled={!!updating}
      title={
        available.kind === "app"
          ? "Downloads the update, then restarts Novex"
          : "Downloads the new interface and reloads it"
      }
      className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-success/30 bg-success/10 px-4 text-[13px] font-medium text-success transition hover:bg-success/15 disabled:cursor-wait"
    >
      {updating ? <Loader2 size={15} className="animate-spin" /> : <ArrowUpCircle size={15} />}
      {updating ? `${t("Updating")}${pct !== null ? ` ${pct}%` : "…"}` : label}
    </button>
  );
}

function StatusBar() {
  const { alerts, dismissAlert, applyUpdate, openContent, status, instances, error, setError, notice, setNotice, pack } = useLauncher();
  const launching = Object.entries(status).find(([, s]) => s.state === "launching");
  const name = launching && instances.find((i) => i.id === launching[0])?.name;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-sm flex-col items-end gap-2">
      {alerts.map((a) => (
        <div key={a.key} className="glass hairline pointer-events-auto flex animate-[fade_150ms_ease-out] items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-xl">
          <ArrowUpCircle size={16} className="shrink-0 text-success" />
          <p className="select-text text-[13px]">{a.text}</p>
          {a.action && (
            <button
              className="shrink-0 text-[13px] font-semibold text-accent hover:underline"
              onClick={() => {
                const action = a.action!;
                dismissAlert(a.key);
                if ("run" in action) void applyUpdate();
                else {
                  openContent(action.instance);
                  useApp.getState().setScreen("instances");
                }
              }}
            >
              {a.action.label}
            </button>
          )}
          <button aria-label={t("Dismiss")} onClick={() => dismissAlert(a.key)} className="text-muted hover:text-fg">
            <X size={14} />
          </button>
        </div>
      ))}
      {error && (
        <div className="glass hairline pointer-events-auto flex animate-[slide-in_220ms_cubic-bezier(0.2,0.8,0.2,1)] items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-xl">
          <p className="select-text text-[13px] text-danger">{error}</p>
          <button
            aria-label={t("Dismiss")}
            onClick={() => setError(null)}
            className="text-muted hover:text-fg"
          >
            <X size={14} />
          </button>
        </div>
      )}
      {notice && (
        <div className="glass hairline pointer-events-auto flex animate-[slide-in_220ms_cubic-bezier(0.2,0.8,0.2,1)] items-start gap-3 rounded-xl border bg-surface px-4 py-3 shadow-xl">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
          <p className="select-text text-[13px]">{notice}</p>
          <button aria-label={t("Dismiss")} onClick={() => setNotice(null)} className="text-muted hover:text-fg">
            <X size={14} />
          </button>
        </div>
      )}
      {pack && (
        <div className="glass hairline w-72 animate-[slide-in_220ms_cubic-bezier(0.2,0.8,0.2,1)] rounded-xl border bg-surface px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2 text-[12px]">
            <Loader2 size={14} className="shrink-0 animate-spin text-muted" />
            <span className="truncate font-medium">{pack.title}</span>
          </div>
          <div className="slot mt-2 h-1.5 overflow-hidden rounded-sm bg-fg/10">
            <div
              className={pack.total ? "h-full bg-success transition-all" : "h-full w-1/3 animate-pulse bg-success"}
              style={pack.total ? { width: `${(pack.done / pack.total) * 100}%` } : undefined}
            />
          </div>
          <p className="mt-1.5 truncate text-[11px] text-muted">
            {pack.stage}
            {pack.total > 0 && ` · ${pack.done}/${pack.total}`}
          </p>
        </div>
      )}
      {launching && (
        <div className="glass hairline rounded-lg border bg-surface px-3 py-2 text-[12px] shadow-lg">
          <span className="font-medium">{name}</span>
          <span className="text-muted"> · {progressLabel(launching[1])}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Startup cover, about 4 seconds: a droplet lands and sends out ripples, settles into a glass tile
 * holding the logo, then the glass and ripples clear and leave the logo and name. It lifts once the
 * sequence has played and the launcher has loaded (or after 6 seconds, whichever is first).
 */
function Splash({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"loading" | "lifting" | "gone">("loading");
  useEffect(() => {
    const minimum = new Promise((r) => setTimeout(r, 4000));
    const ready = Promise.race([initLauncher(), new Promise((r) => setTimeout(r, 6000))]);
    Promise.all([minimum, ready]).then(() => {
      setPhase("lifting");
      onDone();
      setTimeout(() => setPhase("gone"), 520);
    });
  }, [onDone]);
  if (phase === "gone") return null;
  return (
    <div className={cx("splash", phase === "lifting" && "done")} data-tauri-drag-region aria-hidden>
      <div className="splash-stage">
        <span className="splash-ring" />
        <span className="splash-ring [animation-delay:180ms]" />
        <span className="splash-ring [animation-delay:360ms]" />
        <span className="splash-drop" />
        <div className="splash-tile">
          <span className="splash-glass" />
          <img src={logo} alt="" draggable={false} className="splash-logo" />
        </div>
        <img src={logo} alt="" draggable={false} className="splash-rest" />
        <p className="splash-name display">Novex</p>
      </div>
    </div>
  );
}

/** First launch: pick a language. It stays changeable in Settings. */
function LanguagePicker() {
  const setLanguage = useApp((s) => s.setLanguage);
  const language = useApp((s) => s.language);
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem("novex.language") === null;
    } catch {
      return false;
    }
  });
  if (!open) return null;
  const current = resolveLanguage(language);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-6">
      <div className="glass hairline w-full max-w-md rounded-xl border bg-surface p-6 shadow-xl">
        <h2 className="display text-[20px] font-semibold">{t("Choose your language")}</h2>
        <p className="mb-4 mt-1 text-[13px] text-muted">{t("You can change this later in Settings.")}</p>
        <div className="grid grid-cols-2 gap-2">
          {languages.map((l) => (
            <button
              key={l.value}
              onClick={() => {
                setLanguage(l.value);
                setOpen(false);
              }}
              className={cx(
                "h-10 rounded-lg border px-3 text-left text-[13px] font-medium transition hover:bg-fg/5",
                l.value === current ? "border-accent" : "hairline",
              )}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useApp((s) => s.screen);
  // t() reads the language when called, so the shell remounts when it changes.
  const language = useApp((s) => s.language);
  const Current = screens[screen];
  const [booting, setBooting] = useState(true);
  const [entered, setEntered] = useState(false);
  const enter = useCallback(() => setEntered(true), []);

  // The entrance classes come off once played, so later re-renders don't replay them.
  useEffect(() => {
    if (!entered) return;
    const t = setTimeout(() => setBooting(false), 700);
    return () => clearTimeout(t);
  }, [entered]);

  return (
    <div className={cx("flex h-full", entered && booting && "booting")}>
      <Splash onDone={enter} />
      <div className="backdrop" aria-hidden />
      <div key={`side-${language}`} className="enter-side flex">
        <Sidebar />
      </div>
      <main key={`main-${language}`} className="enter-main flex min-w-0 flex-1 flex-col">
        <TopBar title={t(titles[screen])} />
        <div className="flex-1 overflow-y-auto">
          <div key={screen} className="mx-auto max-w-6xl animate-[rise_240ms_cubic-bezier(0.2,0.8,0.2,1)] px-6 pb-8">
            <Current />
          </div>
        </div>
      </main>
      <StatusBar />
      <AccountsDialog />
      <NewInstanceDialog />
      <LogsDialog />
      {entered && <LanguagePicker />}
    </div>
  );
}

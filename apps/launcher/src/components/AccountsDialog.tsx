import { useEffect, useState } from "react";
import { Check, Copy, Loader2, LogIn, Trash2, UserPlus } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errorText, type Account, type DeviceCode } from "../lib/api";
import { useLauncher } from "../launcher";
import { Dialog, inputClass } from "./Dialog";
import { Badge, Button, cx } from "./ui";
import { t } from "../i18n";

const faces = new Map<string, Promise<string | null>>();

/** The face and hat layer cut from a skin, as an 8x8 image. */
function drawFace(base64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const skin = new Image();
    skin.onerror = reject;
    skin.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 8;
      const g = canvas.getContext("2d");
      if (!g) return reject(new Error("no canvas"));
      g.drawImage(skin, 8, 8, 8, 8, 0, 0, 8, 8);
      g.drawImage(skin, 40, 8, 8, 8, 0, 0, 8, 8);
      resolve(canvas.toDataURL());
    };
    skin.src = `data:image/png;base64,${base64}`;
  });
}

/** Cut from the same skin the game gets, so the two always match. Null if the name has none. */
function faceOf(name: string): Promise<string | null> {
  let face = faces.get(name);
  if (!face) {
    face = api
      .accountSkin(name)
      .then((skin) => (skin ? drawFace(skin) : null))
      .catch(() => null);
    faces.set(name, face);
  }
  return face;
}

export function Avatar({ account, size = 32 }: { account: Account; size?: number }) {
  // undefined while loading; null means this name has no skin, which is Steve in game.
  const [face, setFace] = useState<string | null | undefined>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setFace(undefined);
    faceOf(account.name).then((f) => current && setFace(f));
    return () => {
      current = false;
    };
  }, [account.name]);

  const src = face ?? (face === null ? `https://mc-heads.net/avatar/MHF_Steve/${size * 2}` : null);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-[6px] [image-rendering:pixelated]"
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-fg/15 to-fg/5 font-semibold uppercase text-fg"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {account.name[0]}
    </span>
  );
}

/** Same rules as the backend, so the form can say what's wrong before submitting. */
function offlineNameProblem(name: string, accounts: Account[]): string | null {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return t("Use 3–16 letters, numbers or underscores.");
  const taken = accounts.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (taken?.kind === "microsoft") return t("That name belongs to your Microsoft account.");
  if (taken) return t("You already have an offline account with that name.");
  return null;
}

function SignIn({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState<DeviceCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await api.authStart();
        if (!alive) return;
        setCode(c);
        await api.authFinish(c);
        if (alive) onDone();
      } catch (e) {
        if (alive) setError(errorText(e));
      }
    })();
    return () => {
      alive = false;
      api.authCancel().catch(() => {});
    };
  }, [onDone]);

  const copyAndOpen = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.userCode);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the code is still on screen.
    }
    await openUrl(code.verificationUri);
  };

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded bg-danger/10 px-3 py-2.5 text-[13px] text-danger">{error}</p>
        <Button onClick={onCancel}>{t("Back")}</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      {code ? (
        <>
          <p className="text-[13px] text-muted">
            {t("Open the Microsoft sign-in page and enter this code:")}
          </p>
          <p className="select-text font-mono text-3xl font-semibold tracking-[0.2em]">
            {code.userCode}
          </p>
          <Button variant="primary" icon={copied ? Check : Copy} onClick={copyAndOpen}>
            {copied ? t("Copied — opening browser") : t("Copy code & open browser")}
          </Button>
          <p className="flex items-center justify-center gap-2 text-[12px] text-muted">
            <Loader2 size={14} className="animate-spin" /> {t("Waiting for you to finish signing in…")}
          </p>
        </>
      ) : (
        <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted">
          <Loader2 size={16} className="animate-spin" /> {t("Contacting Microsoft…")}
        </p>
      )}
      <Button variant="ghost" onClick={onCancel}>
        {t("Cancel")}
      </Button>
    </div>
  );
}

export function AccountsDialog() {
  const { accountsOpen, openAccounts, accounts, activeAccount, refreshAccounts } =
    useLauncher();
  const [signingIn, setSigningIn] = useState(false);
  const [offlineName, setOfflineName] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmedName = offlineName.trim();
  const nameProblem = offlineNameProblem(trimmedName, accounts);
  // Too short is only worth saying once the name could be finished; bad characters right away.
  const showNameProblem =
    !!nameProblem && (trimmedName.length >= 3 || /[^A-Za-z0-9_]/.test(trimmedName));

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refreshAccounts();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const close = () => {
    setSigningIn(false);
    setConfirmRemove(null);
    openAccounts(false);
  };

  return (
    <Dialog open={accountsOpen} onClose={close} title={t("Accounts")}>
      {signingIn ? (
        <SignIn
          onDone={() => {
            setSigningIn(false);
            refreshAccounts();
          }}
          onCancel={() => setSigningIn(false)}
        />
      ) : (
        <div className="space-y-4">
          {accounts.length > 0 && (
            <ul className="space-y-1">
              {accounts.map((a) => {
                const active = a.uuid === activeAccount;
                if (confirmRemove === a.uuid) {
                  return (
                    <li key={a.uuid} className="flex items-center gap-3 rounded bg-danger/10 px-2 py-2">
                      <Avatar account={a} />
                      <span className="flex-1 text-[13px]">
                        {t("Remove {name}? You'll have to sign in again.", { name: a.name })}
                      </span>
                      <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
                        {t("Cancel")}
                      </Button>
                      <button
                        onClick={() => {
                          setConfirmRemove(null);
                          run(() => api.removeAccount(a.uuid));
                        }}
                        className="h-9 rounded-full bg-danger px-4 text-[13px] font-medium text-white transition hover:opacity-90"
                      >
                        {t("Remove")}
                      </button>
                    </li>
                  );
                }
                return (
                  <li
                    key={a.uuid}
                    className={cx(
                      "group flex items-center gap-3 rounded px-2 py-2 transition",
                      active ? "bg-accent/10" : "hover:bg-fg/5",
                    )}
                  >
                    <button
                      className="flex flex-1 items-center gap-3 text-left"
                      onClick={() => run(() => api.selectAccount(a.uuid))}
                    >
                      <Avatar account={a} />
                      <span className="flex-1">
                        <span className="block font-medium">{a.name}</span>
                        <span className="text-[12px] text-muted">
                          {a.kind === "microsoft" ? "Microsoft" : t("Offline")}
                        </span>
                      </span>
                      {active && <Badge>{t("Active")}</Badge>}
                    </button>
                    <button
                      aria-label={t("Remove {name}", { name: a.name })}
                      onClick={() =>
                        a.kind === "microsoft"
                          ? setConfirmRemove(a.uuid)
                          : run(() => api.removeAccount(a.uuid))
                      }
                      className="grid h-8 w-8 place-items-center rounded text-muted opacity-0 transition hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {accounts.length === 0 && (
            <p className="text-[13px] text-muted">
              {t("Pick a player name to play offline, or sign in with Microsoft for online servers.")}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-[12px] font-medium text-muted">{t("Offline account")}</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (nameProblem) return;
                run(async () => {
                  await api.addOffline(offlineName.trim());
                  setOfflineName("");
                });
              }}
            >
              <input
                autoFocus={accounts.length === 0}
                value={offlineName}
                onChange={(e) => setOfflineName(e.target.value)}
                placeholder={t("Player name")}
                maxLength={16}
                spellCheck={false}
                className={inputClass}
              />
              <Button variant="primary" icon={UserPlus} type="submit" disabled={!!nameProblem}>
                {t("Add")}
              </Button>
            </form>
            {showNameProblem ? (
              <p className="text-[12px] text-danger">{nameProblem}</p>
            ) : (
              <p className="text-[12px] text-muted">
                {t("Offline accounts can play singleplayer, LAN and servers in offline mode. Online servers need your Microsoft account.")}
              </p>
            )}
          </div>

          <div className="hairline space-y-2 border-t pt-4">
            <p className="text-[12px] font-medium text-muted">{t("Microsoft account")}</p>
            <Button icon={LogIn} className="w-full" onClick={() => setSigningIn(true)}>
              {t("Sign in with Microsoft")}
            </Button>
          </div>

          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}

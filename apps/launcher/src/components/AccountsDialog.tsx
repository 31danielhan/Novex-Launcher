import { useEffect, useState } from "react";
import { Check, Copy, Loader2, LogIn, Trash2, UserPlus } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, errorText, type DeviceCode } from "../lib/api";
import { useLauncher } from "../launcher";
import { useSystemInfo } from "../lib/system";
import { Dialog, inputClass } from "./Dialog";
import { Badge, Button, cx } from "./ui";

export function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded bg-accent/15 font-semibold uppercase text-accent"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name?.[0] ?? "?"}
    </span>
  );
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
        <Button onClick={onCancel}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center">
      {code ? (
        <>
          <p className="text-[13px] text-muted">
            Open the Microsoft sign-in page and enter this code:
          </p>
          <p className="select-text font-mono text-3xl font-semibold tracking-[0.2em]">
            {code.userCode}
          </p>
          <Button variant="primary" icon={copied ? Check : Copy} onClick={copyAndOpen}>
            {copied ? "Copied — opening browser" : "Copy code & open browser"}
          </Button>
          <p className="flex items-center justify-center gap-2 text-[12px] text-muted">
            <Loader2 size={14} className="animate-spin" /> Waiting for you to finish signing in…
          </p>
        </>
      ) : (
        <p className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted">
          <Loader2 size={16} className="animate-spin" /> Contacting Microsoft…
        </p>
      )}
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

export function AccountsDialog() {
  const { accountsOpen, openAccounts, accounts, activeAccount, refreshAccounts } = useLauncher();
  const info = useSystemInfo();
  const [signingIn, setSigningIn] = useState(false);
  const [offlineName, setOfflineName] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    openAccounts(false);
  };

  return (
    <Dialog open={accountsOpen} onClose={close} title="Accounts">
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
                      <Avatar name={a.name} />
                      <span className="flex-1">
                        <span className="block font-medium">{a.name}</span>
                        <span className="text-[12px] text-muted">
                          {a.kind === "microsoft" ? "Microsoft" : "Offline (dev)"}
                        </span>
                      </span>
                      {active && <Badge>Active</Badge>}
                    </button>
                    <button
                      aria-label={`Remove ${a.name}`}
                      onClick={() => run(() => api.removeAccount(a.uuid))}
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
              Sign in with the Microsoft account that owns Minecraft: Java Edition.
            </p>
          )}

          <Button variant="primary" icon={LogIn} className="w-full" onClick={() => setSigningIn(true)}>
            Sign in with Microsoft
          </Button>

          {info?.devBuild && (
            <form
              className="hairline flex gap-2 border-t pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api.addOffline(offlineName);
                  setOfflineName("");
                });
              }}
            >
              <input
                value={offlineName}
                onChange={(e) => setOfflineName(e.target.value)}
                placeholder="Offline name (dev builds only)"
                className={inputClass}
              />
              <Button icon={UserPlus} type="submit" disabled={!offlineName.trim()}>
                Add
              </Button>
            </form>
          )}

          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}

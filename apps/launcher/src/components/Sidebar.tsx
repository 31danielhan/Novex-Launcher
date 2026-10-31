import { Boxes, Compass, Home, Settings, Swords, UserRound, type LucideIcon } from "lucide-react";
import { useApp, type Screen } from "../store";
import { useLauncher } from "../launcher";
import { Avatar } from "./AccountsDialog";
import { cx } from "./ui";

const items: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "instances", label: "Instances", icon: Boxes },
  { id: "browse", label: "Browse", icon: Compass },
  { id: "client", label: "Novex Client", icon: Swords },
];

function NavButton({ id, label, icon: Icon }: { id: Screen; label: string; icon: LucideIcon }) {
  const { screen, setScreen } = useApp();
  const active = screen === id;
  return (
    <button
      onClick={() => setScreen(id)}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group relative grid h-10 w-10 place-items-center rounded transition",
        active ? "bg-accent/15 text-accent" : "text-muted hover:bg-fg/5 hover:text-fg",
      )}
    >
      <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
      <span className="pointer-events-none absolute left-12 z-10 whitespace-nowrap rounded bg-raised px-2 py-1 text-[12px] text-fg opacity-0 shadow-lg transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

export function Sidebar() {
  return (
    <nav className="hairline flex w-16 shrink-0 flex-col items-center gap-1 border-r bg-surface py-4">
      <div className="mb-4 grid h-9 w-9 place-items-center rounded bg-accent text-[15px] font-bold text-accent-fg">
        N
      </div>
      {items.map((i) => (
        <NavButton key={i.id} {...i} />
      ))}
      <div className="flex-1" />
      <AccountButton />
      <NavButton id="settings" label="Settings" icon={Settings} />
    </nav>
  );
}

function AccountButton() {
  const { accounts, activeAccount, openAccounts } = useLauncher();
  const name = accounts.find((a) => a.uuid === activeAccount)?.name;
  const label = name ?? "Sign in";
  return (
    <button
      onClick={() => openAccounts(true)}
      aria-label={label}
      className="group relative mb-1 grid h-10 w-10 place-items-center rounded transition hover:bg-fg/5"
    >
      {name ? <Avatar name={name} size={28} /> : <UserRound size={19} className="text-muted" />}
      <span className="pointer-events-none absolute left-12 z-10 whitespace-nowrap rounded bg-raised px-2 py-1 text-[12px] text-fg opacity-0 shadow-lg transition group-hover:opacity-100">
        {label}
      </span>
    </button>
  );
}

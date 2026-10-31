import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "ghost" | "subtle";

export function Button({
  variant = "subtle",
  icon: Icon,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: LucideIcon }) {
  return (
    <button
      className={cx(
        "inline-flex h-9 items-center justify-center gap-2 rounded px-3.5 text-[13px] font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg hover:brightness-110 active:brightness-95",
        variant === "subtle" && "bg-raised text-fg hover:bg-fg/10",
        variant === "ghost" && "text-muted hover:bg-fg/5 hover:text-fg",
        className,
      )}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("hairline rounded-lg border bg-surface", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="hairline flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-16 text-center">
      <div className="mb-4 grid h-11 w-11 place-items-center rounded-lg bg-accent/10 text-accent">
        <Icon size={20} />
      </div>
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative h-6 w-10 shrink-0 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40",
        checked ? "bg-accent" : "bg-fg/15",
      )}
    >
      <span
        className={cx(
          "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all",
          checked ? "left-5" : "left-1",
        )}
      />
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded bg-raised p-1">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-7 rounded-[6px] px-3 text-[12px] font-medium transition disabled:cursor-not-allowed",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-fg/[0.06] px-2 py-0.5 text-[11px] font-medium text-muted">
      {children}
    </span>
  );
}

export { cx };

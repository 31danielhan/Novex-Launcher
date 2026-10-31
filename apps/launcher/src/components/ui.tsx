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
        "inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg shadow-sm hover:opacity-90 active:opacity-100",
        variant === "subtle" && "hairline border bg-surface text-fg hover:bg-raised",
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
  return (
    <div className={cx("hairline shadow-card rounded-xl border bg-surface", className)}>{children}</div>
  );
}

/** Intro line and actions under the top bar, which already shows the page title. */
export function PageHeader({ subtitle, actions }: { subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex items-center justify-between gap-4">
      <p className="text-[13px] text-muted">{subtitle}</p>
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
    <div className="hairline flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="shadow-card mb-4 grid h-11 w-11 place-items-center rounded-full bg-surface text-fg">
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
        checked ? "bg-success" : "bg-fg/15",
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
    <div className="inline-flex rounded-full bg-raised p-1">
      {options.map((o) => (
        <button
          key={o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={cx(
            "h-7 rounded-full px-3.5 text-[12px] font-medium transition disabled:cursor-not-allowed",
            value === o.value ? "bg-surface text-fg shadow-sm" : "text-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Tone = "neutral" | "success" | "danger";

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium",
        tone === "neutral" && "hairline text-muted",
        tone === "success" && "border-success/30 bg-success/10 text-success",
        tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
      )}
    >
      {children}
    </span>
  );
}

export { cx };

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "./ui";

export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid animate-[fade_150ms_ease-out] place-items-center bg-black/50 p-6 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          "hairline flex max-h-full w-full flex-col rounded-xl border bg-surface shadow-2xl",
          wide ? "max-w-3xl" : "max-w-md",
        )}
      >
        <header className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-semibold">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded text-muted hover:bg-fg/5 hover:text-fg"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {footer && (
          <footer className="hairline flex justify-end gap-2 border-t px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "hairline h-9 w-full rounded border bg-bg px-3 text-[13px] outline-none transition placeholder:text-muted focus:border-accent/60";

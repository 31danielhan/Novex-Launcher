import { useEffect, useState } from "react";
import { api, errorText, loaderLabels, type LoaderKind, type LoaderVersion } from "../lib/api";
import { inputClass } from "./Dialog";

/** Loader build picker for one game version. Picks the recommended build when `value` is empty. */
export function LoaderVersionSelect({
  kind,
  game,
  value,
  onChange,
}: {
  kind: LoaderKind;
  game: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [list, setList] = useState<LoaderVersion[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "vanilla" || !game) return;
    let alive = true;
    setList(null);
    setError(null);
    api
      .loaderVersions(kind, game)
      .then((l) => {
        if (!alive) return;
        setList(l);
        if (!value || !l.some((v) => v.id === value)) onChange(l[0]?.id ?? null);
      })
      .catch((e) => alive && setError(errorText(e)));
    return () => {
      alive = false;
    };
    // `value` is read only to keep a still-valid choice when the list reloads.
  }, [kind, game]);

  if (kind === "vanilla") return null;
  if (error) return <p className="text-[13px] text-danger">{error}</p>;
  if (!list) return <p className="text-[13px] text-muted">Loading {loaderLabels[kind]} versions…</p>;
  if (list.length === 0) {
    return (
      <p className="text-[13px] text-muted">
        {loaderLabels[kind]} isn't available for Minecraft {game}.
      </p>
    );
  }
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputClass} appearance-auto`}
      aria-label={`${loaderLabels[kind]} version`}
    >
      {list.map((v) => (
        <option key={v.id} value={v.id}>
          {v.label}
          {v.recommended ? " (recommended)" : !v.stable ? " (beta)" : ""}
        </option>
      ))}
    </select>
  );
}

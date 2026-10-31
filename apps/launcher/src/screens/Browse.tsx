import { useState } from "react";
import { Compass, Search } from "lucide-react";
import { EmptyState, PageHeader, cx } from "../components/ui";

const kinds = ["Modpacks", "Mods", "Resource packs", "Shaders"] as const;
type Kind = (typeof kinds)[number];

export function BrowseScreen() {
  const [kind, setKind] = useState<Kind>("Modpacks");
  const [query, setQuery] = useState("");

  return (
    <>
      <PageHeader title="Browse" subtitle="Find content on Modrinth and CurseForge." />

      <div className="hairline mb-4 flex h-10 items-center gap-2 rounded border bg-surface px-3 focus-within:border-accent/60">
        <Search size={16} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${kind.toLowerCase()}…`}
          className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
        />
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={cx(
              "h-8 rounded-full px-3.5 text-[12px] font-medium transition",
              k === kind ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg",
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <EmptyState
        icon={Compass}
        title="Search is coming soon"
        body="Results will be filtered to the selected instance's version and loader automatically."
      />
    </>
  );
}

import { useEffect, useRef } from "react";
import { Copy } from "lucide-react";
import { useLauncher } from "../launcher";
import { Dialog } from "./Dialog";
import { Button } from "./ui";

function lineClass(l: string) {
  if (/\/(ERROR|FATAL)\]|Exception|^\s+at /.test(l)) return "text-danger";
  if (/\/WARN\]/.test(l)) return "text-[#e0b252]";
  return "";
}

export function LogsDialog() {
  const { logsFor, openLogs, logs, instances } = useLauncher();
  const lines = (logsFor && logs[logsFor]) || [];
  const name = instances.find((i) => i.id === logsFor)?.name ?? "";
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines.length, logsFor]);

  return (
    <Dialog
      wide
      open={logsFor !== null}
      onClose={() => openLogs(null)}
      title={`Logs · ${name}`}
      footer={
        <Button icon={Copy} onClick={() => navigator.clipboard.writeText(lines.join("\n")).catch(() => {})}>
          Copy
        </Button>
      }
    >
      <div className="h-[55vh] select-text overflow-auto rounded-lg bg-raised p-3 font-mono text-[11.5px] leading-relaxed">
        {lines.length === 0 ? (
          <p className="text-muted">No output yet. Logs appear here while the game runs.</p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={`whitespace-pre-wrap break-all ${lineClass(l)}`}>
              {l}
            </div>
          ))
        )}
        <div ref={end} />
      </div>
    </Dialog>
  );
}

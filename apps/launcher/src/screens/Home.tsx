import { Boxes, Play, Plus } from "lucide-react";
import { useLauncher, statusOf } from "../launcher";
import { timeAgo } from "../lib/api";
import { Badge, Button, Card, EmptyState } from "../components/ui";
import { InstanceCard, PlayButton, ProgressBar } from "../components/InstanceCard";

export function HomeScreen() {
  const { instances, status, openNewInstance } = useLauncher();
  const [last, ...rest] = instances;

  return (
    <>
      <Card className="relative mb-8 overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <p className="text-[12px] font-medium uppercase tracking-wider text-muted">
          {last?.lastPlayed ? "Last played" : "Ready to play"}
        </p>
        {last ? (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{last.name}</h1>
            <p className="mt-1 text-[13px] text-muted">
              Vanilla {last.version} · {timeAgo(last.lastPlayed)}
            </p>
            <div className="mt-6 flex max-w-sm flex-col">
              <div className="flex gap-2">
                <PlayButton inst={last} large />
              </div>
              <ProgressBar s={statusOf(status, last.id)} />
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">No instance yet</h1>
            <p className="mt-1 text-[13px] text-muted">
              Create an instance to pick a version, then hit play.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="primary" icon={Play} disabled className="h-10 px-6">
                Play
              </Button>
              <Button icon={Plus} onClick={() => openNewInstance(true)} className="h-10">
                New instance
              </Button>
            </div>
          </>
        )}
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-medium text-muted">Recent</h2>
        {rest.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rest.slice(0, 3).map((i) => (
              <InstanceCard key={i.id} inst={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Boxes}
            title="Nothing else here yet"
            body="Your other recently played instances will show up here."
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-medium text-muted">What's new</h2>
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">Microsoft sign-in & vanilla play</p>
            <p className="text-[13px] text-muted">
              Create vanilla instances and play. Java is downloaded for you.
            </p>
          </div>
          <Badge>Preview</Badge>
        </Card>
      </section>
    </>
  );
}

import { Boxes, Play, Plus } from "lucide-react";
import { useApp } from "../store";
import { Badge, Button, Card, EmptyState } from "../components/ui";

export function HomeScreen() {
  const setScreen = useApp((s) => s.setScreen);

  return (
    <>
      <Card className="relative mb-8 overflow-hidden p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <p className="text-[12px] font-medium uppercase tracking-wider text-muted">Last played</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">No instance yet</h1>
        <p className="mt-1 text-[13px] text-muted">
          Create an instance to pick a version and loader, then hit play.
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="primary" icon={Play} disabled className="h-10 px-6">
            Play
          </Button>
          <Button icon={Plus} onClick={() => setScreen("instances")} className="h-10">
            New instance
          </Button>
        </div>
      </Card>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-medium text-muted">Recent</h2>
        <EmptyState
          icon={Boxes}
          title="Nothing played yet"
          body="Your recently played instances will show up here."
        />
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-medium text-muted">What's new</h2>
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="font-medium">Novex Launcher 0.1.0</p>
            <p className="text-[13px] text-muted">First preview: app shell and design system.</p>
          </div>
          <Badge>Preview</Badge>
        </Card>
      </section>
    </>
  );
}

import { Boxes, FolderInput, Plus } from "lucide-react";
import { Button, EmptyState, PageHeader } from "../components/ui";

export function InstancesScreen() {
  return (
    <>
      <PageHeader
        title="Instances"
        subtitle="Each instance has its own version, loader, mods and settings."
        actions={
          <>
            <Button variant="ghost" icon={FolderInput} disabled title="Coming soon">
              Import
            </Button>
            <Button variant="primary" icon={Plus} disabled title="Coming soon">
              New instance
            </Button>
          </>
        }
      />
      <EmptyState
        icon={Boxes}
        title="No instances"
        body="Create a Vanilla, Fabric, Quilt, Forge or NeoForge instance, or import from another launcher."
      />
    </>
  );
}

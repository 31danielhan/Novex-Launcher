import { Boxes, FolderInput, Plus } from "lucide-react";
import { useLauncher } from "../launcher";
import { Button, EmptyState, PageHeader } from "../components/ui";
import { InstanceCard } from "../components/InstanceCard";

export function InstancesScreen() {
  const { instances, openNewInstance } = useLauncher();
  const create = (
    <Button variant="primary" icon={Plus} onClick={() => openNewInstance(true)}>
      New instance
    </Button>
  );

  return (
    <>
      <PageHeader
        title="Instances"
        subtitle="Each instance has its own version, worlds, mods and settings."
        actions={
          <>
            <Button variant="ghost" icon={FolderInput} disabled title="Coming soon">
              Import
            </Button>
            {create}
          </>
        }
      />
      {instances.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {instances.map((i) => (
            <InstanceCard key={i.id} inst={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Boxes}
          title="No instances"
          body="Create a vanilla or modded instance with Fabric, Quilt, Forge or NeoForge."
          action={create}
        />
      )}
    </>
  );
}

import { t } from "../i18n";
import { Boxes, FolderInput, Plus } from "lucide-react";
import { useLauncher } from "../launcher";
import { Button, EmptyState, PageHeader } from "../components/ui";
import { InstanceCard } from "../components/InstanceCard";
import { InstancePage } from "../components/InstancePage";

export function InstancesScreen() {
  const { instances, openNewInstance, importModpack, pack, contentFor } = useLauncher();
  const open = instances.find((i) => i.id === contentFor);
  if (open) return <InstancePage key={open.id} inst={open} />;

  const create = (
    <Button variant="primary" icon={Plus} onClick={() => openNewInstance(true)}>
      {t("New instance")}
    </Button>
  );

  return (
    <>
      <PageHeader
        subtitle={t("Each instance has its own version, worlds, mods and settings.")}
        actions={
          <>
            <Button
              variant="ghost"
              icon={FolderInput}
              onClick={importModpack}
              disabled={!!pack}
              title={t("Import a .mrpack or CurseForge modpack .zip")}
            >
              {t("Import")}
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
          title={t("No instances")}
          body={t("Create a vanilla or modded instance, install a modpack from Browse, or import a .mrpack or CurseForge .zip.")}
          action={create}
        />
      )}
    </>
  );
}

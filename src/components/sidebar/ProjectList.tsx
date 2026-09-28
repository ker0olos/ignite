import { ProjectRow } from "@/components/app/ProjectRow";
import { RecentRow } from "@/components/app/RecentRow";
import type { ProjectStatus } from "../../../shared/hostProtocol";

const MAX_RECENT = 8;

export type ProjectListProps = {
  folders: string[];
  projects: string[];
  statuses: Record<string, ProjectStatus>;
  home: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onOpenFolder: () => void;
};

/** Sidebar's project list: open projects, then recent folders. */
export function ProjectList({
  folder,
  folders,
  projects,
  statuses,
  home,
  onSelect,
  onClose,
  onShowFiles,
}: ProjectListProps & { folder: string; onShowFiles: () => void }) {
  const recent = folders
    .filter((path) => !projects.includes(path))
    .slice(0, MAX_RECENT);

  return (
    <>
      <h2 className="mt-2 mb-1 px-2 text-xs font-medium text-muted-foreground">
        Open
      </h2>
      <div className="flex flex-col gap-1">
        {projects.map((path) => (
          <ProjectRow
            key={path}
            path={path}
            home={home}
            status={statuses[path]}
            selected={path === folder}
            onSelect={() => (path === folder ? onShowFiles() : onSelect(path))}
            onClose={() => onClose(path)}
          />
        ))}
      </div>
      {recent.length > 0 && (
        <>
          <h2 className="mt-4 mb-1 px-2 text-xs font-medium text-muted-foreground">
            Recent
          </h2>
          <div className="flex flex-col gap-1">
            {recent.map((path) => (
              <RecentRow
                key={path}
                path={path}
                home={home}
                onSelect={() => onSelect(path)}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

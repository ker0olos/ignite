import { ProjectRow } from "@/components/app/ProjectRow";
import type { ProjectStatus } from "../../../shared/hostProtocol";

/** Rows for the projects open in this window, the shown one selected. */
export function OpenProjects({
  folder,
  projects,
  statuses,
  home,
  onSelect,
  onClose,
}: {
  folder: string;
  projects: string[];
  statuses: Record<string, ProjectStatus>;
  home: string;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      {projects.map((path) => (
        <ProjectRow
          key={path}
          path={path}
          home={home}
          status={statuses[path]}
          selected={path === folder}
          onSelect={() => onSelect(path)}
          onClose={() => onClose(path)}
        />
      ))}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import type { SkillCatalog, SkillEntry } from "../../shared/skills";
import type { HostClient } from "@/lib/piHost";

type SkillChange = Extract<
  Parameters<HostClient["request"]>[0],
  {
    type:
      | "skills_set_enabled"
      | "skills_set_always"
      | "skills_remove"
      | "skills_import";
  }
>;

/**
 * The app's skills and plugins, fetched while the Settings dialog is open.
 * Also offers other apps' skills to import in one click.
 */
export function useSkills(host: HostClient | null, open: boolean) {
  const [loaded, setLoaded] = useState<{
    host: HostClient;
    skills: SkillEntry[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const skills = loaded && loaded.host === host ? loaded.skills : null;
  const [catalog, setCatalog] = useState<SkillCatalog | null>(null);
  // What the catalog depends on: which skills are saved (its "added" marks),
  // including a plugin's, which grows without its id changing.
  const catalogKey = skills
    ? JSON.stringify(skills.map((s) => [s.id, s.skills?.map((k) => k.name)]))
    : null;

  useEffect(() => {
    if (!host || !open) return;
    let live = true;
    host
      .request({ type: "skills_list" })
      .then((skills) => live && setLoaded({ host, skills }))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, open]);

  useEffect(() => {
    if (!host || !open || catalogKey === null) return;
    let live = true;
    host
      .request({ type: "skills_catalog" })
      .then((catalog) => live && setCatalog(catalog))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [host, open, catalogKey]);

  /** Sends a change; resolves with what went wrong, or null. */
  const change = useCallback(
    async (request: SkillChange): Promise<string | null> => {
      if (!host) return "The agent host isn't running.";
      try {
        const skills = await host.request(request);
        setLoaded({ host, skills });
        return null;
      } catch (e) {
        return (e as Error).message;
      }
    },
    [host],
  );

  // Row actions report failures in `error`; nothing else shows its own.
  const act = useCallback(
    async (request: SkillChange) => {
      setError(null);
      setError(await change(request));
    },
    [change],
  );

  return {
    /** Null until the sidecar has answered. */
    skills,
    error,
    setEnabled: (id: string, enabled: boolean) =>
      act({ type: "skills_set_enabled", skill: id, enabled }),
    /** Puts a skill's whole text in every prompt, not just its description. */
    setAlways: (id: string, always: boolean) =>
      act({ type: "skills_set_always", skill: id, always }),
    remove: (id: string) => act({ type: "skills_remove", skill: id }),
    /** Null until loaded; the last one stays while a refresh loads. */
    catalog,
    importSkills: (source: string, names: string[]) =>
      act({ type: "skills_import", source, names }),
  };
}

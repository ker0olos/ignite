/** Skills and plugins as they cross the wire. */

/** A skill in the app's skills folder; only its description enters the prompt. */
export type SkillInfo = { name: string; description: string };

/**
 * The app's skills: standalone ones and plugins (a bundle of skills, such as
 * one imported from a Claude Code plugin). `id` names it in requests.
 */
export type SkillEntry = SkillInfo & {
  id: string;
  enabled: boolean;
  /** Set on a plugin: the skills it bundles. */
  skills?: SkillInfo[];
};

/** Other apps' skills found on this Mac, to copy in. */
export type SkillCatalog = {
  sources: {
    id: string;
    app: string;
    /** "Skills", or the Claude Code plugin's name. */
    label: string;
    /** Importing brings its skills in as one plugin. */
    plugin: boolean;
    skills: (SkillInfo & { added: boolean })[];
  }[];
};

/** The skills settings' requests; each change answers with the new list. */
export type SkillRequest =
  | { id: number; type: "skills_list" }
  | { id: number; type: "skills_set_enabled"; skill: string; enabled: boolean }
  | { id: number; type: "skills_remove"; skill: string }
  | { id: number; type: "skills_catalog" }
  /** Copies skills from another app (see SkillCatalog.sources). */
  | { id: number; type: "skills_import"; source: string; names: string[] };

/** What each skills request resolves to. */
export type SkillResponses = {
  skills_list: SkillEntry[];
  skills_set_enabled: SkillEntry[];
  skills_remove: SkillEntry[];
  skills_catalog: SkillCatalog;
  skills_import: SkillEntry[];
};

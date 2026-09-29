/** Servers the MCP settings offer to add in one click. */
export type McpCatalog = {
  presets: {
    id: string;
    name: string;
    summary: string;
    /** Signs in with OAuth, which the app can't do yet. */
    signIn: boolean;
    /** A server with this name is already saved. */
    added: boolean;
  }[];
  /** Other apps' servers found on this Mac. */
  sources: {
    id: string;
    app: string;
    /** "project": set up in that app for one folder only; the open one unless `folder`. */
    scope: "user" | "project";
    folder?: string;
    servers: {
      name: string;
      /** The command or URL, to recognise it by. */
      target: string;
      added: boolean;
    }[];
  }[];
};

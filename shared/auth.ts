/** A sign-in's prompts and events, as pi-ai's AuthPrompt / AuthEvent, minus the AbortSignals that can't cross a process boundary. */
export type AuthPromptData =
  | {
      type: "text" | "secret" | "manual_code";
      message: string;
      placeholder?: string;
    }
  | {
      type: "select";
      message: string;
      options: readonly { id: string; label: string; description?: string }[];
    };

export type AuthEventData =
  | {
      type: "info";
      message: string;
      links?: readonly { url: string; label?: string }[];
    }
  | { type: "auth_url"; url: string; instructions?: string }
  | {
      type: "device_code";
      userCode: string;
      verificationUri: string;
      intervalSeconds?: number;
      expiresInSeconds?: number;
    }
  | { type: "progress"; message: string };

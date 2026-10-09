import type { Item } from "@/components/settings/sections";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/settings";
import { isWindows } from "@/lib/window";

const MAX_SUBAGENTS = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: String(n),
}));

/** The row that lets Auto run every tool call, unsandboxed. */
function fullAccessItem(
  settings: Settings,
  onChange: (settings: Settings) => void,
): Item {
  return {
    section: "Agent",
    title: "Full access in Auto",
    description:
      "Auto runs every tool call without asking and outside the sandbox: risky commands, files outside the folder, commits and pushes.",
    keywords: "yolo approval auto sandbox permissions bypass trust",
    control: (
      <Switch
        checked={settings.approval.full_access}
        onCheckedChange={(full_access) =>
          onChange({
            ...settings,
            approval: { ...settings.approval, full_access },
          })
        }
      />
    ),
  };
}

/** The row that sandboxes Auto's shell commands on Windows instead of asking for each. */
function windowsSandboxItem(
  settings: Settings,
  onChange: (settings: Settings) => void,
): Item {
  return {
    section: "Agent",
    title: "Sandbox on Windows (alpha)",
    description:
      "Auto runs shell commands in a sandbox instead of asking for each: as a separate Windows user that writes only in folders commands run in, online only through the app. The first command asks for administrator rights once, to set it up.",
    keywords: "sandbox windows approval auto permissions srt",
    control: (
      <Switch
        checked={settings.approval.windows_sandbox}
        onCheckedChange={(windows_sandbox) =>
          onChange({
            ...settings,
            approval: { ...settings.approval, windows_sandbox },
          })
        }
      />
    ),
  };
}

/** The row that turns on notifications for finished and waiting conversations. */
function notificationsItem(
  settings: Settings,
  onChange: (settings: Settings) => void,
): Item {
  return {
    section: "Agent",
    title: "Notifications",
    description:
      "Tells you when a conversation finishes or waits for you, while the app isn't in front.",
    keywords: "notify alert done finished waiting banner",
    control: (
      <Switch
        checked={settings.notifications.enabled}
        onCheckedChange={(enabled) =>
          onChange({
            ...settings,
            notifications: { ...settings.notifications, enabled },
          })
        }
      />
    ),
  };
}

/** The row that plays a chime with each notification. */
function notificationSoundItem(
  settings: Settings,
  onChange: (settings: Settings) => void,
): Item {
  return {
    section: "Agent",
    title: "Notification sound",
    description: "Plays a short chime with each notification.",
    keywords: "notify alert sound chime bell audio",
    control: (
      <Switch
        checked={settings.notifications.sound}
        disabled={!settings.notifications.enabled}
        onCheckedChange={(sound) =>
          onChange({
            ...settings,
            notifications: { ...settings.notifications, sound },
          })
        }
      />
    ),
  };
}

/** Settings rows for how the agent works: questions, subagents, full access, notifications. */
export function agentItems({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}): Item[] {
  return [
    fullAccessItem(settings, onChange),
    ...(isWindows() ? [windowsSandboxItem(settings, onChange)] : []),
    {
      section: "Agent",
      title: "Ask before deciding",
      description:
        "The agent asks you about open choices, with options to pick from. Off, it decides on its own.",
      keywords: "questions autonomous choices options",
      control: (
        <Switch
          checked={settings.conversation.ask_questions}
          onCheckedChange={(ask_questions) =>
            onChange({
              ...settings,
              conversation: { ...settings.conversation, ask_questions },
            })
          }
        />
      ),
    },
    {
      section: "Agent",
      title: "Subagents",
      description:
        "The agent can hand tasks to its own model or a cheaper one from the same provider, at its effort or lower, and talk with it.",
      keywords: "subagents delegate agents helpers",
      control: (
        <Switch
          checked={settings.subagents.enabled}
          onCheckedChange={(enabled) =>
            onChange({
              ...settings,
              subagents: { ...settings.subagents, enabled },
            })
          }
        />
      ),
    },
    {
      section: "Agent",
      title: "Subagents at once",
      description:
        "How many of a conversation's subagents run at the same time; the rest wait their turn.",
      keywords: "subagents delegate agents helpers max",
      control: (
        <Select
          items={MAX_SUBAGENTS}
          value={String(settings.subagents.max)}
          disabled={!settings.subagents.enabled}
          onValueChange={(value) =>
            value &&
            onChange({
              ...settings,
              subagents: { ...settings.subagents, max: Number(value) },
            })
          }
        >
          <SelectTrigger size="sm" className="w-16 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            {MAX_SUBAGENTS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-[13px]">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    notificationsItem(settings, onChange),
    notificationSoundItem(settings, onChange),
  ];
}

import { SettingsDialog } from "@/components/settings/SettingsDialog";
import type { useConnectScreen } from "@/hooks/useConnectScreen";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useProviders } from "@/hooks/useProviders";
import type { useSettingsDialog } from "@/hooks/useSettingsDialog";
import type { Settings } from "@/lib/settings";

/** The Settings dialog, wired to the app's state. */
export function AppSettingsDialog({
  dialog,
  settings,
  onChange,
  providers,
  mcp,
  folder,
  connectScreen,
}: {
  dialog: ReturnType<typeof useSettingsDialog>;
  settings: Settings;
  onChange: (settings: Settings) => void;
  providers: ReturnType<typeof useProviders>;
  mcp: ReturnType<typeof useMcpServers>;
  folder: string | null;
  connectScreen: ReturnType<typeof useConnectScreen>;
}) {
  return (
    <SettingsDialog
      key={dialog.section}
      initialSection={dialog.section}
      open={dialog.open}
      onOpenChange={dialog.setOpen}
      settings={settings}
      onChange={onChange}
      providers={providers.statuses}
      providersError={providers.hostError}
      mcp={mcp}
      skills={dialog.skills}
      memory={dialog.memory}
      about={dialog.about}
      folder={folder}
      onManageProviders={() => {
        dialog.setOpen(false);
        connectScreen.show();
      }}
    />
  );
}

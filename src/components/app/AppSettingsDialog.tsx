import { lazy, Suspense } from "react";
import type { useConnectScreen } from "@/hooks/useConnectScreen";
import type { useMcpServers } from "@/hooks/useMcpServers";
import type { useProviders } from "@/hooks/useProviders";
import type { useSettingsDialog } from "@/hooks/useSettingsDialog";
import type { Settings } from "@/lib/settings";
import { useOpenedOnce } from "@/hooks/useOpenedOnce";
import type { RemoteStatus } from "../../../shared/remote";

const load = () => import("@/components/settings/SettingsDialog");
const SettingsDialog = lazy(() =>
  load().then((m) => ({ default: m.SettingsDialog })),
);

/** The Settings dialog, wired to the app's state. */
export function AppSettingsDialog({
  dialog,
  settings,
  onChange,
  providers,
  mcp,
  folder,
  connectScreen,
  remote,
}: {
  dialog: ReturnType<typeof useSettingsDialog>;
  settings: Settings;
  onChange: (settings: Settings) => void;
  providers: ReturnType<typeof useProviders>;
  mcp: ReturnType<typeof useMcpServers>;
  folder: string | null;
  connectScreen: ReturnType<typeof useConnectScreen>;
  remote: RemoteStatus | null;
}) {
  if (!useOpenedOnce(dialog.open, load)) return null;
  return (
    <Suspense>
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
        lessons={dialog.lessons}
        about={dialog.about}
        folder={folder}
        remote={remote}
        onManageProviders={() => {
          dialog.setOpen(false);
          connectScreen.show();
        }}
      />
    </Suspense>
  );
}

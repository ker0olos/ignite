import type { ProviderStatus } from "../../../../shared/hostProtocol";
import type { Item } from "@/components/settings/sections";
import { ProviderState } from "@/components/settings/ProviderState";
import { ProviderTile } from "@/components/settings/ProviderTile";
import { Button } from "@/components/ui/button";
import { PROVIDER_GROUPS, groupConnection } from "@/lib/providerGroups";

/** Settings rows for connected providers, plus the "Manage" entry. */
export function providersItems({
  providers,
  providersError,
  onManageProviders,
}: {
  providers: ProviderStatus[] | null;
  providersError: string | null;
  onManageProviders: () => void;
}): Item[] {
  return [
    ...(providersError
      ? [
          {
            section: "Providers" as const,
            title: "Agent host unavailable",
            description: providersError,
          },
        ]
      : PROVIDER_GROUPS.map((group) => ({
          section: "Providers" as const,
          title: group.name,
          icon: <ProviderTile name={group.name} />,
          keywords: "provider account model subscription api key",
          control: (
            <ProviderState
              how={providers ? groupConnection(group, providers) : undefined}
            />
          ),
        }))),
    {
      section: "Providers",
      title: "",
      keywords: "connect disconnect manage provider account login api key",
      control: (
        <Button variant="outline" size="sm" onClick={onManageProviders}>
          Manage
        </Button>
      ),
    },
  ];
}

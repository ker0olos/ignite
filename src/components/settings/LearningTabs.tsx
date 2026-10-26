import { SECTIONS, type LearningTab } from "@/components/settings/sections";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LearningTabInfo } from "@/lib/learning";

/** The Learning page's tabs: one per part, with its count and whether it's switched off. */
export function LearningTabs({
  tabs,
  section,
  onSectionChange,
}: {
  tabs: LearningTabInfo[];
  section: LearningTab;
  onSectionChange: (section: LearningTab) => void;
}) {
  return (
    <Tabs
      value={section}
      onValueChange={(v) => onSectionChange(v as LearningTab)}
      className="mb-4"
    >
      <TabsList
        variant="line"
        className="w-full justify-start border-b group-data-horizontal/tabs:h-11"
      >
        {tabs.map(({ tab, count, on }) => {
          const Icon = SECTIONS[tab].icon;
          return (
            <TabsTrigger
              key={tab}
              value={tab}
              className="flex-none text-[13px] text-muted-foreground data-active:text-foreground"
            >
              <Icon className="size-4" />
              {tab}
              {count !== undefined && (
                <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">
                  {count}
                </span>
              )}
              {!on && (
                <span className="text-[11px] text-muted-foreground">off</span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SYSTEM_THEME, themeGroups, type CodeTheme } from "@/lib/codeThemes";

/** Theme menu: System, then every theme grouped by source. */
export function ThemePicker({
  themes,
  value,
  onChange,
}: {
  themes: CodeTheme[];
  value: string;
  onChange: (id: string) => void;
}) {
  const groups = themeGroups(themes, value);
  const items = [
    { value: SYSTEM_THEME, label: "System" },
    ...groups.flatMap((g) =>
      g.themes.map((t) => ({ value: t.id, label: t.label })),
    ),
  ];
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(id) => id && onChange(id)}
    >
      <SelectTrigger size="sm" className="w-56 text-[13px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className="max-h-80">
        <SelectGroup>
          <SelectItem value={SYSTEM_THEME} className="text-[13px]">
            System
          </SelectItem>
        </SelectGroup>
        {groups.map((group) => (
          <SelectGroup key={group.source}>
            <SelectLabel>{group.source}</SelectLabel>
            {group.themes.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-[13px]">
                {t.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

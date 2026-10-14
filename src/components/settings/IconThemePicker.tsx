import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { iconThemeGroups } from "@/lib/iconThemeGroups";
import { MINIMAL_ICONS, type IconThemeInfo } from "@/lib/iconThemes";

/** Icon theme menu: the built-in ones (Minimal, the default, first), then installed ones by source. */
export function IconThemePicker({
  themes,
  value,
  onChange,
}: {
  themes: IconThemeInfo[];
  value: string;
  onChange: (id: string) => void;
}) {
  const groups = iconThemeGroups(themes, value);
  const items = [
    { value: MINIMAL_ICONS, label: "Minimal" },
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

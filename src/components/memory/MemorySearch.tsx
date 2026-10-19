import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { basename } from "@/lib/paths";

/** The box that searches the open folder's memories. */
export function MemorySearch({
  folder,
  query,
  onChange,
}: {
  folder: string;
  query: string;
  onChange: (query: string) => void;
}) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label="Search memories"
        placeholder={`Search ${basename(folder)}'s memories`}
        className="text-[13px]"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
    </InputGroup>
  );
}

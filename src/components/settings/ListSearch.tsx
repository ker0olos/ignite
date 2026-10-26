import { Search } from "lucide-react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

/** A search box above a list. */
export function ListSearch({
  label,
  placeholder,
  query,
  onChange,
}: {
  label: string;
  placeholder: string;
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
        aria-label={label}
        placeholder={placeholder}
        className="text-[13px]"
        value={query}
        onChange={(e) => onChange(e.target.value)}
      />
    </InputGroup>
  );
}

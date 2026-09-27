import { ClaudeLogo } from "@/components/providers/ClaudeLogo";
import { OpenAILogo } from "@/components/providers/OpenAILogo";

/** A provider's logo. */
export function ProviderTile({ name }: { name: string }) {
  const Logo = name === "Claude" ? ClaudeLogo : OpenAILogo;
  return <Logo className="size-4 shrink-0" />;
}

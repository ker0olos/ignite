import {
  Bug,
  Compass,
  EyeOff,
  Lock,
  PenLine,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/** Each kind of memory's icon. */
export const OBSERVATION_ICONS: Record<string, LucideIcon | undefined> = {
  bugfix: Bug,
  feature: Sparkles,
  refactor: RefreshCw,
  change: PenLine,
  discovery: Compass,
  decision: Scale,
  security_alert: ShieldAlert,
  security_note: Lock,
  sensitive: EyeOff,
};

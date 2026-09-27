import {
  Bug,
  Compass,
  Lock,
  PenLine,
  RefreshCw,
  Scale,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/** Icons for cmem's observation kinds in its default "code" mode. */
export const OBSERVATION_ICONS: Record<string, LucideIcon | undefined> = {
  bugfix: Bug,
  feature: Sparkles,
  refactor: RefreshCw,
  change: PenLine,
  discovery: Compass,
  decision: Scale,
  security_alert: ShieldAlert,
  security_note: Lock,
};

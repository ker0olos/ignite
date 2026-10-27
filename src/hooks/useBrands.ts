import { useSyncExternalStore } from "react";
import { brandsLoaded, onBrandsLoaded } from "@/lib/brandMarks";

/** Renders again once the brands MCP servers are matched to have loaded. */
export function useBrands() {
  useSyncExternalStore(onBrandsLoaded, brandsLoaded);
}

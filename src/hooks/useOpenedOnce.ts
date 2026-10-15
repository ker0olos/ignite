import { useEffect, useState } from "react";

/** Whether a lazy dialog has opened yet, so it mounts then and stays; its code loads soon after startup anyway. */
export function useOpenedOnce(open: boolean, load: () => Promise<unknown>) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);

  useEffect(() => {
    const id = setTimeout(() => void load(), 2000);
    return () => clearTimeout(id);
  }, [load]);

  return opened;
}

import { clearMocks } from "@tauri-apps/api/mocks";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(async () => {
  // Unmount rendered hooks first so their event listeners are removed,
  // then drop the fake backend; neither may leak into the next test.
  cleanup();
  // Hooks unlisten asynchronously; let that finish while the mocks still exist.
  await new Promise((resolve) => setTimeout(resolve));
  clearMocks();
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FallbackKeyInfo } from "../../../shared/fallbackKeys";
import { FallbackKeys } from "@/components/providers/FallbackKeys";
import type { useFallbackKeys } from "@/hooks/useFallbackKeys";

const confirmNative = vi.hoisted(() => vi.fn());
vi.mock("@/lib/lifecycle", () => ({ confirmNative }));

const a: FallbackKeyInfo = { id: "a", hint: "abcd" };
const b: FallbackKeyInfo = { id: "b", hint: "wxyz" };

function setup(keys: FallbackKeyInfo[] | null, error: string | null = null) {
  const fallback = {
    keys,
    error,
    add: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    move: vi.fn(async () => {}),
  };
  render(
    <FallbackKeys fallback={fallback as ReturnType<typeof useFallbackKeys>} />,
  );
  return fallback;
}

const openForm = () =>
  fireEvent.click(screen.getByText("Add a fallback API key"));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  confirmNative.mockReset().mockResolvedValue(true);
});

describe("FallbackKeys rows", () => {
  it("shows each key's label", () => {
    setup([a, b]);
    expect(screen.getByText("Anthropic API key ••••abcd")).toBeTruthy();
    expect(screen.getByText("Anthropic API key ••••wxyz")).toBeTruthy();
  });

  it("offers moving only with two or more keys, disabled at the ends", () => {
    setup([a]);
    expect(screen.queryByLabelText("Move up")).toBeNull();
  });

  it("moves a key", () => {
    const fallback = setup([a, b]);
    const [up, down] = [
      screen.getAllByLabelText("Move up"),
      screen.getAllByLabelText("Move down"),
    ];
    expect((up[0] as HTMLButtonElement).disabled).toBe(true);
    expect((down[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(down[0]);
    expect(fallback.move).toHaveBeenCalledWith("a", 1);
    fireEvent.click(up[1]);
    expect(fallback.move).toHaveBeenCalledWith("b", -1);
  });

  it("removes a key only once confirmed", async () => {
    const fallback = setup([a]);
    confirmNative.mockResolvedValueOnce(false);
    fireEvent.click(screen.getByLabelText("Remove"));
    await waitFor(() => expect(confirmNative).toHaveBeenCalledTimes(1));
    expect(fallback.remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("Remove"));
    await waitFor(() => expect(fallback.remove).toHaveBeenCalledWith("a"));
  });

  it("shows the hook's error", () => {
    setup([a], "No such key.");
    expect(screen.getByText("No such key.")).toBeTruthy();
  });
});

describe("FallbackKeys form", () => {
  it("rejects a bad key", () => {
    const fallback = setup([]);
    openForm();
    fireEvent.click(screen.getByText("Save key"));
    expect(screen.getByText("Enter an API key.")).toBeTruthy();
    expect(fallback.add).not.toHaveBeenCalled();
  });

  it("adds an Anthropic key and closes", async () => {
    const fallback = setup([]);
    openForm();
    type("API key", " sk-ant-1234 ");
    fireEvent.click(screen.getByText("Save key"));
    await waitFor(() =>
      expect(fallback.add).toHaveBeenCalledWith("sk-ant-1234"),
    );
    await waitFor(() => expect(screen.queryByText("Save key")).toBeNull());
  });

  it("shows the host's error and stays open", async () => {
    const fallback = setup([]);
    fallback.add.mockRejectedValueOnce(new Error("Key already added."));
    openForm();
    type("API key", "sk-ant-1234");
    fireEvent.click(screen.getByText("Save key"));
    expect(await screen.findByText("Key already added.")).toBeTruthy();
    expect(screen.getByText("Save key")).toBeTruthy();
  });

  it("cancels back to the button", () => {
    setup([]);
    openForm();
    fireEvent.click(screen.getByText("Cancel"));
    expect(screen.getByText("Add a fallback API key")).toBeTruthy();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModelRouterItem } from "./ModelRouterItem";

const open = (modelRouter: boolean, onModelRouter = vi.fn()) => {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <ModelRouterItem
          modelRouter={modelRouter}
          onModelRouter={onModelRouter}
        />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  fireEvent.click(screen.getByText("menu"));
};

it("turns Model Router on when clicked", async () => {
  const onModelRouter = vi.fn();
  open(false, onModelRouter);
  fireEvent.click(await screen.findByText("Router"));
  expect(onModelRouter).toHaveBeenCalledWith(true);
});

it("checks the item while Model Router is on", async () => {
  open(true);
  const item = (await screen.findByText("Router")).closest("[role=menuitem]")!;
  expect(item.querySelector("svg")).not.toBeNull();
});

it("shows no check while Model Router is off", async () => {
  open(false);
  const item = (await screen.findByText("Router")).closest("[role=menuitem]")!;
  expect(item.querySelector("svg")).toBeNull();
});

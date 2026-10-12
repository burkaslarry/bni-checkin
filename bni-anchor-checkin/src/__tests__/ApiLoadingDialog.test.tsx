import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiLoadingDialog } from "../components/ApiLoadingDialog";
import { beginApiRequest } from "../lib/apiLoading";

describe("ApiLoadingDialog", () => {
  it("stays visible until all concurrent API requests finish", () => {
    render(<ApiLoadingDialog />);
    let finishFirst = () => {};
    let finishSecond = () => {};
    act(() => {
      finishFirst = beginApiRequest();
      finishSecond = beginApiRequest();
    });
    expect(screen.getByRole("dialog", { name: "處理中" })).toBeInTheDocument();

    act(() => finishFirst());
    expect(screen.getByRole("dialog", { name: "處理中" })).toBeInTheDocument();
    act(() => finishSecond());
    expect(screen.queryByRole("dialog", { name: "處理中" })).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GuestsPage from "../pages/GuestsPage";
import { ChapterProvider } from "../chapterContext";
import { downloadGuestCsv } from "../lib/guestCsv";

vi.mock("../lib/guestCsv", () => ({
  downloadGuestCsv: vi.fn(),
}));

vi.mock("../api", () => ({
  ANCHOR_CHAPTER_ID: 1,
  CHAPTER_TAG_TO_ID: { anchor: 1, amax: 2, dynasty: 3 },
  setActiveApiChapter: vi.fn(),
  setClientAuthToken: vi.fn(),
  clientLogin: vi.fn(),
  clientLogout: vi.fn(),
  fetchClientSession: vi.fn().mockResolvedValue({
    chapter: { id: 1, tag: "anchor", displayName: "BNI Anchor" },
  }),
  getGuests: vi.fn().mockResolvedValue({
    guests: [
      {
        name: "Amy Chan",
        profession: "會計",
        referrer: "Larry Lo",
        eventDate: "2026-07-16",
        phoneNumber: "91234567",
      },
      {
        name: "Ben Wong",
        profession: "法律",
        referrer: "Zoe",
        eventDate: "2026-08-01",
      },
    ],
  }),
  deleteGuest: vi.fn(),
  updateGuest: vi.fn(),
}));

function renderGuests(path = "/admin/guests") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ChapterProvider>
        <GuestsPage />
      </ChapterProvider>
    </MemoryRouter>
  );
}

function signIn() {
  localStorage.setItem(
    "eventxp_admin_session",
    JSON.stringify({
      token: "t",
      chapter: { id: 1, tag: "anchor", displayName: "BNI Anchor" },
      expiresAtEpochMs: Date.now() + 60_000,
    })
  );
}

describe("GuestsPage CSV export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    signIn();
  });

  it("exports the visible guest list in event-date order", async () => {
    renderGuests();
    await screen.findByText("Amy Chan");

    const names = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => row.textContent ?? "");
    expect(names()[0]).toContain("Ben Wong");
    expect(names()[1]).toContain("Amy Chan");

    fireEvent.click(screen.getByRole("button", { name: "📥 匯出 CSV" }));
    expect(downloadGuestCsv).toHaveBeenCalledWith("guest_list_all.csv", [
      expect.objectContaining({ name: "Ben Wong", eventDate: "2026-08-01" }),
      expect.objectContaining({ name: "Amy Chan", eventDate: "2026-07-16" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /活動日期/ }));
    expect(names()[0]).toContain("Amy Chan");
    expect(names()[1]).toContain("Ben Wong");

    fireEvent.click(screen.getByRole("button", { name: "📥 匯出 CSV" }));
    expect(downloadGuestCsv).toHaveBeenLastCalledWith("guest_list_all.csv", [
      expect.objectContaining({ name: "Amy Chan", eventDate: "2026-07-16" }),
      expect.objectContaining({ name: "Ben Wong", eventDate: "2026-08-01" }),
    ]);
  });

  it("exports only the selected event date", async () => {
    renderGuests("/admin/guests?eventDate=2026-07-16");
    await screen.findByText("Amy Chan");
    fireEvent.click(screen.getByRole("button", { name: "📥 匯出 CSV" }));
    expect(downloadGuestCsv).toHaveBeenCalledWith("guest_list_2026-07-16.csv", [
      expect.objectContaining({ name: "Amy Chan", eventDate: "2026-07-16" }),
    ]);
  });
});

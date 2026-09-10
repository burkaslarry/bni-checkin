import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChapterProvider } from "../chapterContext";
import MembersPage from "../pages/MembersPage";

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
  getMembers: vi.fn(),
  getProfessionGroups: vi.fn(),
  getLatestTrafficLight: vi.fn(),
  updateMember: vi.fn(),
  deleteMember: vi.fn(),
  createMember: vi.fn(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/members"]}>
      <ChapterProvider>
        <MembersPage />
      </ChapterProvider>
    </MemoryRouter>
  );
}

describe("MembersPage standing", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(
      "eventxp_admin_session",
      JSON.stringify({
        token: "t",
        chapter: { id: 1, tag: "anchor", displayName: "BNI Anchor" },
        expiresAtEpochMs: Date.now() + 60_000,
      })
    );
    const api = await import("../api");
    vi.mocked(api.getProfessionGroups).mockResolvedValue({ professionGroups: [] });
    vi.mocked(api.getLatestTrafficLight).mockResolvedValue({
      id: 12,
      chapterId: 1,
      periodLabel: "2026-02-01 - 2026-07-31",
      periodStart: "2026-02-01",
      periodEnd: "2026-07-31",
      greenGoal: 60,
      yellowGoal: 40,
      filename: "BNI-Anchor-TL.xlsx",
      createdAt: "2026-08-01T04:00:00Z",
      rows: [
        {
          name: "Dr. Ronnie Chan",
          present: 20,
          absent: 0,
          late: 0,
          medical: 0,
          substitute: 0,
          referralsGiven: 40,
          referralsReceived: 10,
          visitors: 20,
          oneToOnes: 40,
          training: 2,
          bizGive: 600_000,
          plsPct: 100,
          totalPts: 90,
          light: "GREEN",
        },
      ],
    });
    vi.mocked(api.getMembers).mockResolvedValue({
      members: [
        {
          id: 7,
          name: "Dr. Ronnie Chan",
          domain: "心臟科專科醫生",
          standing: "GREEN",
          professionCode: "H",
        },
      ],
    });
  });

  it("shows 綠燈 / 黃燈 / 紅燈 / 黑燈 labels with Total PTs and does not let standing be edited", async () => {
    renderPage();
    expect(await screen.findByText("🟢 綠燈 · 90 分")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /編輯/ })[0]);
    expect(await screen.findByText("編輯會員")).toBeInTheDocument();
    expect(screen.getAllByText("🟢 綠燈 · 90 分").length).toBeGreaterThan(0);
    expect(screen.getByText(/不可在此修改/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /黃燈/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /紅燈/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /黑燈/ })).not.toBeInTheDocument();
    expect(screen.queryByText("正常")).not.toBeInTheDocument();
    expect(screen.queryByText("觀察")).not.toBeInTheDocument();
    expect(screen.queryByText("停權")).not.toBeInTheDocument();
    expect(screen.queryByText("已離會")).not.toBeInTheDocument();
  });
});

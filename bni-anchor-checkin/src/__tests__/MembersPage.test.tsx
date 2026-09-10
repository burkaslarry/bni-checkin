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

  it("shows 綠燈 / 黃燈 / 紅燈 / 黑燈 labels and does not let standing be edited", async () => {
    renderPage();
    expect(await screen.findByText("🟢 綠燈")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /編輯/ })[0]);
    expect(await screen.findByText("編輯會員")).toBeInTheDocument();
    expect(screen.getAllByText("🟢 綠燈").length).toBeGreaterThan(0);
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

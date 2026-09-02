import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChapterProvider } from "../chapterContext";
import { TrafficLightPanel } from "../components/TrafficLightPanel";

const historyItem = {
  id: 12,
  periodLabel: "2026-02-01 - 2026-07-31 (6 Months)",
  periodStart: "2026-02-01",
  periodEnd: "2026-07-31",
  filename: "BNI-Anchor-TL-Jul.xlsx",
  createdAt: "2026-08-01T04:00:00Z",
  rowCount: 2,
  green: 1,
  yellow: 0,
  red: 1,
  black: 0,
};

const report = {
  id: 12,
  chapterId: 1,
  periodLabel: historyItem.periodLabel,
  periodStart: historyItem.periodStart,
  periodEnd: historyItem.periodEnd,
  greenGoal: 60,
  yellowGoal: 40,
  filename: historyItem.filename,
  createdAt: historyItem.createdAt,
  rows: [
    {
      name: "Ada",
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
      light: "GREEN" as const,
    },
    {
      name: "Ben",
      present: 10,
      absent: 5,
      late: 2,
      medical: 0,
      substitute: 0,
      referralsGiven: 2,
      referralsReceived: 12,
      visitors: 0,
      oneToOnes: 2,
      training: 0,
      bizGive: 0,
      plsPct: 40,
      totalPts: 28,
      light: "BLACK" as const,
    },
  ],
};

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
  listTrafficLightReports: vi.fn(),
  getTrafficLightReport: vi.fn(),
  getMembers: vi.fn(),
  uploadTrafficLightExcel: vi.fn(),
  generateTrafficLightReminder: vi.fn(),
}));

function renderPanel() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <ChapterProvider>
        <TrafficLightPanel onNotify={vi.fn()} />
      </ChapterProvider>
    </MemoryRouter>
  );
}

describe("TrafficLightPanel LT board", () => {
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
    vi.mocked(api.listTrafficLightReports).mockResolvedValue([historyItem]);
    vi.mocked(api.getTrafficLightReport).mockResolvedValue(report);
    vi.mocked(api.getMembers).mockResolvedValue({
      members: [
        { name: "Ada", domain: "IT" },
        { name: "Ben", domain: "Legal" },
        { name: "Cara", domain: "Insurance" },
      ],
    });
  });

  it("shows upload history filename and LT percents", async () => {
    renderPanel();
    expect(await screen.findByText("上傳歷史")).toBeInTheDocument();
    expect((await screen.findAllByText(/BNI-Anchor-TL-Jul.xlsx/)).length).toBeGreaterThan(0);
    expect(await screen.findByText("At-risk（紅 + 黑）")).toBeInTheDocument();
    expect(screen.getByText(/會員名單冇喺 Excel：Cara/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ben · 黑燈/ })).toBeInTheDocument();
  });

  it("opens an at-risk member from the board list", async () => {
    const api = await import("../api");
    vi.mocked(api.generateTrafficLightReminder).mockResolvedValue({
      name: "Ben",
      light: "BLACK",
      totalPts: 28,
      emailSubject: "s",
      emailBody: "b",
      whatsappText: "wa ben",
      source: "template",
    });
    renderPanel();
    const risk = await screen.findByRole("button", { name: /Ben · 黑燈/ });
    fireEvent.click(risk);
    expect(await screen.findByDisplayValue("wa ben")).toBeInTheDocument();
  });
});

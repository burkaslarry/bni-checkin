import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QrFlyerContent, PDF_CAPTURE_WIDTH_PX } from "../components/QrFlyerContent";

const sampleData = {
  eventName: "BNI Anchor Regular Meeting 2026-06-12",
  eventDate: "2026-06-12",
  registrationStartTime: "06:30",
  startTime: "07:00",
  onTimeCutoff: "07:05",
  endTime: "09:00"
};

describe("QrFlyerContent", () => {
  it("shows event date row when includeEventDate is true", () => {
    render(
      <QrFlyerContent
        data={sampleData}
        includeEventDate={true}
        websiteUrl="https://example.com"
      />
    );

    expect(screen.getByTestId("qr-flyer-event-date")).toBeInTheDocument();
    expect(screen.getByText("2026-06-12")).toBeInTheDocument();
  });

  it("hides event date row when includeEventDate is false", () => {
    render(
      <QrFlyerContent
        data={sampleData}
        includeEventDate={false}
        websiteUrl="https://example.com"
      />
    );

    expect(screen.queryByTestId("qr-flyer-event-date")).not.toBeInTheDocument();
    expect(screen.queryByText("📆 活動日期:")).not.toBeInTheDocument();
  });

  it("uses a fixed capture width constant for A4 layout", () => {
    expect(PDF_CAPTURE_WIDTH_PX).toBe(718);
  });
});

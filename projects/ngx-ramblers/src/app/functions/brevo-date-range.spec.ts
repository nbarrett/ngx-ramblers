import { clampBrevoDayRange } from "./brevo-date-range";

describe("clampBrevoDayRange", () => {
  it("caps end date that is ahead of UTC today", () => {
    expect(clampBrevoDayRange("2026-07-30", "2026-08-05", "2026-08-04")).toEqual({
      startDate: "2026-07-30",
      endDate: "2026-08-04"
    });
  });

  it("caps start date that is ahead of UTC today", () => {
    expect(clampBrevoDayRange("2026-08-06", "2026-08-07", "2026-08-04")).toEqual({
      startDate: "2026-08-04",
      endDate: "2026-08-04"
    });
  });

  it("clamps ranges longer than ninety inclusive days", () => {
    expect(clampBrevoDayRange("2026-03-31", "2026-06-29", "2026-06-29", 90)).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-06-29"
    });
  });

  it("caps a lone end date", () => {
    expect(clampBrevoDayRange(undefined, "2026-08-05", "2026-08-04")).toEqual({
      startDate: undefined,
      endDate: "2026-08-04"
    });
  });
});

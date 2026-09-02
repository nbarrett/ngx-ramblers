import expect from "expect";
import { morningWalksCount, statsPeriodsFromRequest, totalMilesFromWalks } from "./walk-admin";

describe("morningWalksCount", () => {
  it("splits total walks into morning, evening, cancelled and unfilled", () => {
    const totalWalks = 40;
    const cancelledWalks = 5;
    const eveningWalks = 10;
    const unfilledSlots = 3;

    const morningWalks = morningWalksCount(totalWalks, cancelledWalks, eveningWalks, unfilledSlots);

    expect(morningWalks).toEqual(22);
    expect(morningWalks + cancelledWalks + eveningWalks + unfilledSlots).toEqual(totalWalks);
  });

  it("never returns a negative value", () => {
    const totalWalks = 5;
    const cancelledWalks = 3;
    const eveningWalks = 3;
    const unfilledSlots = 3;

    const morningWalks = morningWalksCount(totalWalks, cancelledWalks, eveningWalks, unfilledSlots);

    expect(morningWalks).toEqual(0);
    expect(morningWalks + cancelledWalks + eveningWalks + unfilledSlots).toBeGreaterThanOrEqual(totalWalks);
  });
});

describe("totalMilesFromWalks", () => {

  it("sums miles from the walks that were actually walked, including drafts", () => {
    expect(totalMilesFromWalks([
      {groupEvent: {distance_miles: 10}},
      {groupEvent: {distance_miles: 9.55}},
      {groupEvent: {distance_miles: 0}},
      {groupEvent: {}}
    ])).toEqual(19.6);
  });

  it("returns 0 when there are no walks", () => {
    expect(totalMilesFromWalks([])).toEqual(0);
  });

});

describe("statsPeriodsFromRequest", () => {

  it("uses explicit committee-meeting periods when they are supplied", () => {
    expect(statsPeriodsFromRequest(300, 400, [
      {fromDate: 200, toDate: 300},
      {fromDate: 300, toDate: 400}
    ])).toEqual([
      {fromDate: 200, toDate: 300},
      {fromDate: 300, toDate: 400}
    ]);
  });

});

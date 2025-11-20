import expect from "expect";
import { morningWalksCount } from "./walk-admin";

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

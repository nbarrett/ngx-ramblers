import { describe, expect, it } from "vitest";
import { beaconBinIndex, beaconDetected, sameRoomLikely, SAME_ROOM_BEACON_HZ } from "./same-room-detector";

function magnitudes(fill: number, peaks: Record<number, number> = {}): Float32Array {
  const data = new Float32Array(2048).fill(fill);
  Object.entries(peaks).forEach(([index, value]) => {
    data[Number(index)] = value;
  });
  return data;
}

describe("beaconBinIndex", () => {

  it("maps the beacon frequency to the nearest FFT bin", () => {
    expect(beaconBinIndex(SAME_ROOM_BEACON_HZ, 48000, 4096)).toEqual(1579);
    expect(beaconBinIndex(SAME_ROOM_BEACON_HZ, 44100, 4096)).toEqual(1718);
  });

});

describe("beaconDetected", () => {

  const options = {absoluteThresholdDb: -85, prominenceDb: 12};

  it("detects a strong tone that stands out above the nearby noise floor", () => {
    expect(beaconDetected(magnitudes(-120, {1579: -60}), 1579, options)).toEqual(true);
  });

  it("ignores broadband noise with no tone standing out", () => {
    expect(beaconDetected(magnitudes(-70), 1579, options)).toEqual(false);
  });

  it("ignores a tone that is too quiet to be a real beacon", () => {
    expect(beaconDetected(magnitudes(-140, {1579: -95}), 1579, options)).toEqual(false);
  });

  it("ignores a bump that is not prominent enough above its neighbours", () => {
    expect(beaconDetected(magnitudes(-75, {1579: -68}), 1579, options)).toEqual(false);
  });

});

describe("sameRoomLikely", () => {

  it("is true once enough recent frames heard a beacon", () => {
    expect(sameRoomLikely([false, true, true, false, true], 3)).toEqual(true);
  });

  it("stays false while hits are below the threshold, so a single stray frame does not trigger", () => {
    expect(sameRoomLikely([false, true, false, false, true], 3)).toEqual(false);
  });

});

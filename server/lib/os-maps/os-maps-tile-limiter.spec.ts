import expect from "expect";
import { describe, it, beforeEach } from "mocha";
import { Request } from "express";
import {
  clientKeyFromRequest,
  OS_TILE_PER_MINUTE,
  resetOsTileLimiter,
  takeTileAllowance
} from "./os-maps-tile-limiter";

describe("os-maps-tile-limiter", () => {

  beforeEach(() => {
    resetOsTileLimiter();
  });

  it("allows the first tile request", () => {
    const result = takeTileAllowance("1.1.1.1");
    expect(result.allowed).toEqual(true);
    expect(result.dayCount).toEqual(1);
  });

  it("rejects a client that exceeds the per-minute cap", () => {
    const allowed = Array.from({length: OS_TILE_PER_MINUTE}, () => takeTileAllowance("2.2.2.2"));
    const blocked = takeTileAllowance("2.2.2.2");
    expect(allowed.every(item => item.allowed)).toEqual(true);
    expect(blocked.allowed).toEqual(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("does not share one client's cap with another", () => {
    Array.from({length: OS_TILE_PER_MINUTE}, () => takeTileAllowance("3.3.3.3"));
    expect(takeTileAllowance("4.4.4.4").allowed).toEqual(true);
  });

  it("reads the first x-forwarded-for address", () => {
    const req = {
      headers: {"x-forwarded-for": "  9.9.9.9, 8.8.8.8"},
      ip: "10.0.0.1",
      socket: {remoteAddress: "10.0.0.2"}
    } as unknown as Request;
    expect(clientKeyFromRequest(req)).toEqual("9.9.9.9");
  });
});

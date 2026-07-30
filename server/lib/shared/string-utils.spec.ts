import expect from "expect";
import { describe, it } from "mocha";
import { padLeft, padRight, truncateAtWordBoundary } from "./string-utils";

describe("padRight", () => {
  it("pads short strings to length", () => {
    expect(padRight("hi", 5)).toBe("hi   ");
  });

  it("returns exact-length strings unchanged", () => {
    expect(padRight("hello", 5)).toBe("hello");
  });

  it("returns longer strings unchanged", () => {
    expect(padRight("hello", 3)).toBe("hello");
  });

  it("handles empty string", () => {
    expect(padRight("", 3)).toBe("   ");
  });

  it("handles zero length", () => {
    expect(padRight("hello", 0)).toBe("hello");
  });
});

describe("padLeft", () => {
  it("pads short strings to length", () => {
    expect(padLeft("hi", 5)).toBe("   hi");
  });

  it("returns exact-length strings unchanged", () => {
    expect(padLeft("hello", 5)).toBe("hello");
  });

  it("returns longer strings unchanged", () => {
    expect(padLeft("hello", 3)).toBe("hello");
  });

  it("handles empty string", () => {
    expect(padLeft("", 3)).toBe("   ");
  });

  it("handles zero length", () => {
    expect(padLeft("hello", 0)).toBe("hello");
  });

  it("pads numeric string", () => {
    expect(padLeft("42", 6)).toBe("    42");
  });
});

describe("truncateAtWordBoundary", () => {

  it("returns titles shorter than the limit unchanged", () => {
    expect(truncateAtWordBoundary("hide non-approved walks from public visitors", 90))
      .toBe("hide non-approved walks from public visitors");
  });

  it("cuts on a word boundary without adding an ellipsis", () => {
    expect(truncateAtWordBoundary("content path Contains match returns no results and carousel titles not showing", 40))
      .toBe("content path Contains match returns no");
  });

  it("drops a dangling opening bracket rather than cutting mid-reference", () => {
    expect(truncateAtWordBoundary("separate inbox privacy from admin config (ref #310, #319)", 48))
      .toBe("separate inbox privacy from admin config");
  });

  it("keeps a complete bracketed phrase within the limit", () => {
    expect(truncateAtWordBoundary("refresh codebase stats (28 July 2026) and tidy up the rest of it", 37))
      .toBe("refresh codebase stats (28 July 2026)");
  });

  it("handles empty input and a zero limit", () => {
    expect(truncateAtWordBoundary("", 90)).toBe("");
    expect(truncateAtWordBoundary("anything", 0)).toBe("");
  });
});

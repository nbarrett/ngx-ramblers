import expect from "expect";
import { describe, it } from "mocha";
import { padLeft, padRight } from "./string-utils";

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

import { toSlug, toKebabCase, booleanOf } from "./strings";

describe("strings", () => {

  describe("toSlug", () => {
    it("should convert title with spaces to slug", () => {
      expect(toSlug("Hello World")).toBe("hello-world");
    });

    it("should remove special characters like forward slashes", () => {
      expect(toSlug("6 miles/10 km")).toBe("6-miles10-km");
    });

    it("should handle the problematic away day slug", () => {
      expect(toSlug("Away Day Whittlesea Straw Bear Festival 6 miles/10 km Leisurely Booking"))
        .toBe("away-day-whittlesea-straw-bear-festival-6-miles10-km-leisurely-booking");
    });

    it("should preserve already valid slugs", () => {
      expect(toSlug("away-day-whittlesea-straw-bear-festival-6-miles10-km-leisurely-booking"))
        .toBe("away-day-whittlesea-straw-bear-festival-6-miles10-km-leisurely-booking");
    });

    it("should handle empty input", () => {
      expect(toSlug("")).toBe("");
      expect(toSlug(null)).toBe("");
      expect(toSlug(undefined)).toBe("");
    });

    it("should collapse multiple hyphens", () => {
      expect(toSlug("hello--world")).toBe("hello-world");
    });

    it("should collapse multiple spaces", () => {
      expect(toSlug("hello   world")).toBe("hello-world");
    });

    it("should remove parentheses and other punctuation", () => {
      expect(toSlug("Walk (5 miles)")).toBe("walk-5-miles");
    });

    it("should handle mixed case", () => {
      expect(toSlug("UPPER lower MiXeD")).toBe("upper-lower-mixed");
    });
  });

  describe("toKebabCase", () => {
    it("should convert strings using es-toolkit kebabCase", () => {
      expect(toKebabCase("Hello World")).toBe("hello-world");
    });

    it("should join multiple strings with hyphens", () => {
      expect(toKebabCase("Hello", "World")).toBe("hello-world");
    });

    it("should handle camelCase input", () => {
      expect(toKebabCase("helloWorld")).toBe("hello-world");
    });
  });

  describe("booleanOf", () => {
    it("should return true for truthy string values", () => {
      expect(booleanOf("true")).toBe(true);
      expect(booleanOf("1")).toBe(true);
      expect(booleanOf("yes")).toBe(true);
    });

    it("should return false for falsy string values", () => {
      expect(booleanOf("false")).toBe(false);
      expect(booleanOf("0")).toBe(false);
      expect(booleanOf("no")).toBe(false);
    });

    it("should return boolean values as-is", () => {
      expect(booleanOf(true)).toBe(true);
      expect(booleanOf(false)).toBe(false);
    });

    it("should return fallback for unrecognized values", () => {
      expect(booleanOf("unknown")).toBe(false);
      expect(booleanOf("unknown", true)).toBe(true);
    });
  });
});

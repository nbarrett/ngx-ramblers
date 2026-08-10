import expect from "expect";
import { describe, it } from "mocha";
import {
  gradientPatternSvg,
  lightenedFillColor,
  stripePatternSvg
} from "../../../projects/ngx-ramblers/src/app/functions/area-map-patterns";

describe("area map patterns", () => {

  describe("stripePatternSvg", () => {
    it("builds a rotated pattern sized to the number of colours", () => {
      const svg = stripePatternSvg(["#ff0000", "#00ff00"], "stripe-pattern-0");
      expect(svg).toContain(`<pattern id="stripe-pattern-0" patternUnits="userSpaceOnUse" width="16" height="16" patternTransform="rotate(45)">`);
      expect(svg).toContain(`<rect x="0" y="0" width="32" height="8" fill="#ff0000"/>`);
      expect(svg).toContain(`<rect x="0" y="8" width="32" height="8" fill="#00ff00"/>`);
    });

    it("stacks one stripe per colour", () => {
      const svg = stripePatternSvg(["a", "b", "c"], "stripe-pattern-1");
      expect(svg.match(/<rect /g)).toHaveLength(3);
      expect(svg).toContain(`width="24" height="24"`);
      expect(svg).toContain(`y="16"`);
    });
  });

  describe("gradientPatternSvg", () => {
    it("spreads colour stops evenly from 0% to 100%", () => {
      const svg = gradientPatternSvg(["#111111", "#222222", "#333333"], "gradient-pattern-0");
      expect(svg).toContain(`<linearGradient id="gradient-pattern-0" x1="0%" y1="0%" x2="100%" y2="100%">`);
      expect(svg).toContain(`<stop offset="0%" stop-color="#111111"/>`);
      expect(svg).toContain(`<stop offset="50%" stop-color="#222222"/>`);
      expect(svg).toContain(`<stop offset="100%" stop-color="#333333"/>`);
    });
  });

  describe("lightenedFillColor", () => {
    it("lightens an hsl border colour by 30 points", () => {
      expect(lightenedFillColor("hsl(120, 70%, 45%)")).toBe("hsl(120, 70%, 75%)");
    });

    it("caps the lightness at 90", () => {
      expect(lightenedFillColor("hsl(120, 70%, 65%)")).toBe("hsl(120, 70%, 90%)");
    });

    it("leaves colours without a trailing lightness untouched", () => {
      expect(lightenedFillColor("#aabbcc")).toBe("#aabbcc");
    });
  });
});

import { nativeApiUrl } from "./native-walking";

describe("nativeApiUrl", () => {
  it("sends relative API requests to the configured group website", () => {
    expect(nativeApiUrl("api/database/config", "https://group.example.org.uk")).toBe("https://group.example.org.uk/api/database/config");
    expect(nativeApiUrl("/api/walks", "https://group.example.org.uk")).toBe("https://group.example.org.uk/api/walks");
  });

  it("keeps bundled assets and external requests unchanged", () => {
    expect(nativeApiUrl("assets/images/icon.svg", "https://group.example.org.uk")).toBe("assets/images/icon.svg");
    expect(nativeApiUrl("https://tiles.example.org/map", "https://group.example.org.uk")).toBe("https://tiles.example.org/map");
    expect(nativeApiUrl("/api/walks", null)).toBe("/api/walks");
  });
});

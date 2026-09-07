import { vi } from "vitest";
import { nativeShareSupported, shareOrOpen } from "./native-share";

describe("nativeShareSupported", () => {

  afterEach(() => {
    delete (navigator as any).share;
  });

  it("is true when navigator.share exists", () => {
    (navigator as any).share = () => Promise.resolve();
    expect(nativeShareSupported()).toBe(true);
  });

  it("is false when navigator.share does not exist", () => {
    expect(nativeShareSupported()).toBe(false);
  });
});

describe("shareOrOpen", () => {

  afterEach(() => {
    vi.restoreAllMocks();
    delete (navigator as any).share;
  });

  it("calls navigator.share when supported and does not fall back", async () => {
    (navigator as any).share = () => Promise.resolve();
    const shareSpy = vi.spyOn(navigator, "share").mockResolvedValue(undefined);
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    await shareOrOpen({url: "https://example.com"}, "https://fallback.example.com");
    expect(shareSpy).toHaveBeenCalledWith({url: "https://example.com"});
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("falls back to opening the URL when navigator.share is unsupported", async () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    await shareOrOpen({url: "https://example.com"}, "https://fallback.example.com");
    expect(openSpy).toHaveBeenCalledWith("https://fallback.example.com", "_blank", "noopener");
  });

  it("does nothing further when the user cancels the share sheet", async () => {
    (navigator as any).share = () => Promise.resolve();
    const abortError = new DOMException("cancelled", "AbortError");
    vi.spyOn(navigator, "share").mockRejectedValue(abortError);
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    await shareOrOpen({url: "https://example.com"}, "https://fallback.example.com");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("falls back when navigator.share fails for a reason other than cancellation", async () => {
    (navigator as any).share = () => Promise.resolve();
    vi.spyOn(navigator, "share").mockRejectedValue(new Error("boom"));
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    await shareOrOpen({url: "https://example.com"}, "https://fallback.example.com");
    expect(openSpy).toHaveBeenCalledWith("https://fallback.example.com", "_blank", "noopener");
  });
});

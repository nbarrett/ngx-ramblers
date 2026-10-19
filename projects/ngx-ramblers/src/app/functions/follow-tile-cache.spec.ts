import { fetchFollowTile, FOLLOW_TILES_CACHE, matchFollowTile, storeFollowTile } from "./follow-tile-cache";

describe("follow tile cache", () => {
  const stored = new Map<string, Response>();

  beforeEach(() => {
    stored.clear();
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValue({
        match: (url: string) => Promise.resolve(stored.get(url) || null),
        put: (url: string, response: Response) => {
          stored.set(url, response);
          return Promise.resolve();
        }
      }),
      match: (url: string) => Promise.resolve(stored.get(url) || null)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses a saved tile without fetching again", async () => {
    stored.set("https://group.example.org.uk/tile", new Response("png", {status: 200}));
    vi.stubGlobal("fetch", vi.fn());
    const response = await fetchFollowTile("https://group.example.org.uk/tile");
    expect(await response.text()).toBe("png");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores a successful download for later walks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("png", {status: 200})));
    const response = await fetchFollowTile("https://group.example.org.uk/tile");
    expect(response.ok).toBe(true);
    expect(stored.has("https://group.example.org.uk/tile")).toBe(true);
    expect(FOLLOW_TILES_CACHE).toBe("follow-tiles-v3");
    expect(await matchFollowTile("https://group.example.org.uk/tile")).not.toBeNull();
  });

  it("does not store a failed download", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", {status: 503})));
    const response = await fetchFollowTile("https://group.example.org.uk/tile");
    expect(response.ok).toBe(false);
    expect(await storeFollowTile("https://group.example.org.uk/tile", response)).toBe(false);
    expect(stored.has("https://group.example.org.uk/tile")).toBe(false);
  });
});

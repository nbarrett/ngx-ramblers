import { RouteFollowCacheService } from "./route-follow-cache.service";
import { CachedFollowRoute, RouteFollowOfflineStatus, RouteFollowPayload } from "../../models/route-follow.model";

describe("RouteFollowCacheService recovery", () => {
  it("reports unavailable storage without blocking session restoration", async () => {
    const cache = Object.create(RouteFollowCacheService.prototype) as RouteFollowCacheService;
    cache["logger"] = {warn: vi.fn()} as unknown as typeof cache["logger"];
    cache.cached = vi.fn().mockRejectedValue(new Error("Device storage unavailable"));
    expect(await cache.status("walk:fictional-walk")).toBe(RouteFollowOfflineStatus.NEEDS_NETWORK);
  });

  it("requires another tile download when the saved route geometry changes", async () => {
    const cache = Object.create(RouteFollowCacheService.prototype) as RouteFollowCacheService;
    const payload = {walkId: "fictional-walk", points: [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}]} as RouteFollowPayload;
    cache.cached = vi.fn().mockResolvedValue({payload, tilesReady: true, tileCount: 20});
    cache["dateUtils"] = {dateTimeNowAsValue: () => 123} as unknown as typeof cache["dateUtils"];
    cache["putRoute"] = vi.fn().mockResolvedValue(null);
    await cache.savePayload({...payload, points: [{latitude: 52, longitude: 1}, {latitude: 52.001, longitude: 1.001}]});
    expect(cache["putRoute"]).toHaveBeenCalledWith(expect.objectContaining({tilesReady: false, tileCount: 0}));
  });

  it("waits for the transaction to commit before reporting a saved route", async () => {
    const cache = Object.create(RouteFollowCacheService.prototype) as RouteFollowCacheService;
    const transaction = {
      oncomplete: vi.fn(), onerror: vi.fn(), onabort: vi.fn(),
      objectStore: () => ({put: vi.fn()})
    };
    cache["database"] = vi.fn().mockResolvedValue({transaction: () => transaction});
    const result = {completed: false};
    const saved = cache["putRoute"]({key: "walk:fictional-walk"} as CachedFollowRoute).then(() => result.completed = true);
    await Promise.resolve();
    expect(result.completed).toBe(false);
    transaction.oncomplete();
    await saved;
    expect(result.completed).toBe(true);
  });

  it("rejects an interrupted write instead of reporting success", async () => {
    const cache = Object.create(RouteFollowCacheService.prototype) as RouteFollowCacheService;
    const transaction = {
      oncomplete: vi.fn(), onerror: vi.fn(), onabort: vi.fn(), error: null,
      objectStore: () => ({put: vi.fn()})
    };
    cache["database"] = vi.fn().mockResolvedValue({transaction: () => transaction});
    const saved = cache["putRoute"]({key: "walk:fictional-walk"} as CachedFollowRoute);
    const failure = expect(saved).rejects.toThrow("interrupted");
    await Promise.resolve();
    transaction.onabort();
    await failure;
  });

  it("does not count a failed tile request as an offline download", async () => {
    const cache = Object.create(RouteFollowCacheService.prototype) as RouteFollowCacheService;
    cache["logger"] = {warn: vi.fn()} as unknown as typeof cache["logger"];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", {status: 503})));
    try {
      const result = await cache.prefetchTiles(["https://group.example.org.uk/tile"]);
      expect(result.saved).toBe(0);
      expect(result.total).toBe(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

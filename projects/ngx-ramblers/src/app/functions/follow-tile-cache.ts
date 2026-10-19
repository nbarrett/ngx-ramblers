export const FOLLOW_TILES_CACHE = "follow-tiles-v3";

function cacheableTile(response: Response): boolean {
  return response.ok || response.type === "opaque";
}

export async function matchFollowTile(url: string): Promise<Response | null> {
  if (!("caches" in globalThis)) {
    return null;
  } else {
    const cache = await caches.open(FOLLOW_TILES_CACHE);
    return await cache.match(url) || await caches.match(url) || null;
  }
}

export async function storeFollowTile(url: string, response: Response): Promise<boolean> {
  if (!("caches" in globalThis) || !cacheableTile(response)) {
    return false;
  } else {
    const cache = await caches.open(FOLLOW_TILES_CACHE);
    await cache.put(url, response);
    return true;
  }
}

export async function fetchFollowTile(url: string): Promise<Response> {
  const cached = await matchFollowTile(url);
  if (cached) {
    return cached;
  } else {
    const fresh = await fetch(url, {mode: "cors", credentials: "same-origin"});
    if (cacheableTile(fresh)) {
      await storeFollowTile(url, fresh.clone());
    }
    return fresh;
  }
}

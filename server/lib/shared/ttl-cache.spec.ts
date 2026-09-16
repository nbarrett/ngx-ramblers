import expect from "expect";
import { describe, it } from "mocha";
import { ttlCached } from "./ttl-cache";

function delay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

describe("ttlCached", () => {

  it("calls the loader once and serves the cached value until it expires", async () => {
    const cache = ttlCached<number>(50);
    const calls: string[] = [];
    const loader = () => {
      calls.push("called");
      return Promise.resolve(calls.length);
    };
    expect(await cache.get("key", loader)).toEqual(1);
    expect(await cache.get("key", loader)).toEqual(1);
    expect(calls.length).toEqual(1);
    await delay(60);
    expect(await cache.get("key", loader)).toEqual(2);
    expect(calls.length).toEqual(2);
  });

  it("keeps a separate value for each key", async () => {
    const cache = ttlCached<string>(1000);
    expect(await cache.get("first", () => Promise.resolve("one"))).toEqual("one");
    expect(await cache.get("second", () => Promise.resolve("two"))).toEqual("two");
    expect(await cache.get("first", () => Promise.resolve("ignored"))).toEqual("one");
  });

  it("shares one load between callers that arrive together", async () => {
    const cache = ttlCached<string>(1000);
    const calls: string[] = [];
    const loader = async () => {
      calls.push("called");
      await delay(10);
      return "value";
    };
    const results = await Promise.all([cache.get("key", loader), cache.get("key", loader), cache.get("key", loader)]);
    expect(results).toEqual(["value", "value", "value"]);
    expect(calls.length).toEqual(1);
  });

  it("does not cache a failure, so the next caller tries again", async () => {
    const cache = ttlCached<string>(1000);
    const calls: string[] = [];
    const loader = () => {
      calls.push("called");
      return calls.length === 1 ? Promise.reject(new Error("graph api down")) : Promise.resolve("recovered");
    };
    await expect(cache.get("key", loader)).rejects.toThrow("graph api down");
    expect(await cache.get("key", loader)).toEqual("recovered");
    expect(calls.length).toEqual(2);
  });

  it("reloads after being cleared", async () => {
    const cache = ttlCached<number>(1000);
    const calls: string[] = [];
    const loader = () => {
      calls.push("called");
      return Promise.resolve(calls.length);
    };
    expect(await cache.get("key", loader)).toEqual(1);
    cache.clear();
    expect(await cache.get("key", loader)).toEqual(2);
  });
});

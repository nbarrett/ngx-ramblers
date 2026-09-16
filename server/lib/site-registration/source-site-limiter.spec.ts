import expect from "expect";
import { describe, it } from "mocha";
import { HttpError } from "../shared/http-error";
import { DEFAULT_SOURCE_SITE_LIMITS, SourceSiteLimiter, SourceSiteUnavailableError } from "./source-site-limiter";

function fakeClock() {
  const clock = {now: 1000, sleeps: [] as number[]};
  const sleep = async (ms: number) => {
    clock.sleeps.push(ms);
    clock.now += ms;
  };
  return {clock, limiter: new SourceSiteLimiter(DEFAULT_SOURCE_SITE_LIMITS, sleep, () => clock.now)};
}

const refused = () => Object.assign(new Error("connect ECONNREFUSED 192.0.2.1:443"), {code: "ECONNREFUSED"});

describe("SourceSiteLimiter", () => {
  it("never sends more than two requests at once to the same website", async () => {
    const {limiter} = fakeClock();
    const running = {now: 0, most: 0};
    const releases: (() => void)[] = [];
    const request = () => limiter.request("https://group.example/page", () => new Promise<string>(resolve => {
      running.now++;
      running.most = Math.max(running.most, running.now);
      releases.push(() => {
        running.now--;
        resolve("ok");
      });
    }));
    const requests = [request(), request(), request(), request(), request()];
    const drain = async (): Promise<void> => {
      await new Promise(resolve => setImmediate(resolve));
      const next = releases.shift();
      if (next) {
        next();
        await drain();
      }
    };
    await drain();
    await Promise.all(requests);
    expect(running.most).toEqual(2);
  });

  it("backs off and retries when the website refuses a connection, then carries on", async () => {
    const {clock, limiter} = fakeClock();
    const attempts = {count: 0};
    const result = await limiter.request("https://group.example/a", async () => {
      attempts.count++;
      if (attempts.count < 3) {
        throw refused();
      } else {
        return "page";
      }
    });
    expect(result).toEqual("page");
    expect(clock.sleeps.filter(ms => ms >= 2000)).toEqual([2000, 4000]);
    expect(limiter.summary("https://group.example/").retries).toEqual(2);
  });

  it("waits as long as the website asks with Retry-After", async () => {
    const {clock, limiter} = fakeClock();
    const attempts = {count: 0};
    await limiter.request("https://group.example/a", async () => {
      attempts.count++;
      if (attempts.count === 1) {
        throw Object.assign(new HttpError(429, "Too many requests"), {retryAfterSeconds: 30});
      } else {
        return "page";
      }
    });
    expect(clock.sleeps).toContain(30000);
  });

  it("does not retry a missing page", async () => {
    const {limiter} = fakeClock();
    const attempts = {count: 0};
    await expect(limiter.request("https://group.example/missing.pdf", async () => {
      attempts.count++;
      throw new HttpError(404, "Not found");
    })).rejects.toThrow("Not found");
    expect(attempts.count).toEqual(1);
  });

  it("stops contacting a website that keeps failing, then allows it again after the cool-down", async () => {
    const {clock, limiter} = fakeClock();
    const attempts = {count: 0};
    const failing = () => limiter.request("https://group.example/a", async () => {
      attempts.count++;
      throw refused();
    });
    await expect(failing()).rejects.toThrow(refused().message);
    await expect(failing()).rejects.toBeInstanceOf(SourceSiteUnavailableError);
    const attemptsWhenStopped = attempts.count;
    await expect(failing()).rejects.toBeInstanceOf(SourceSiteUnavailableError);
    expect(attempts.count).toEqual(attemptsWhenStopped);
    clock.now += DEFAULT_SOURCE_SITE_LIMITS.unavailableCooldownMs + 1;
    await expect(limiter.request("https://group.example/b", async () => "back")).resolves.toEqual("back");
  });

  it("leaves more time between requests when the website responds slowly", async () => {
    const {clock, limiter} = fakeClock();
    await limiter.request("https://group.example/slow", async () => {
      clock.now += 8000;
      return "slow page";
    });
    clock.sleeps.length = 0;
    await limiter.request("https://group.example/next", async () => "next page");
    expect(clock.sleeps[0]).toEqual(4000);
  });
});

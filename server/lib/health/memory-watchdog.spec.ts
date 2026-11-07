import expect from "expect";
import { afterEach, describe, it } from "mocha";
import {
  holdMemoryWatchdogRestart,
  memoryWatchdogRestartHeld,
  releaseMemoryWatchdogRestart
} from "./memory-watchdog";

describe("memory watchdog restart hold", () => {
  afterEach(() => {
    releaseMemoryWatchdogRestart();
    releaseMemoryWatchdogRestart();
  });

  it("holds and releases a restart", () => {
    expect(memoryWatchdogRestartHeld()).toEqual(false);
    holdMemoryWatchdogRestart("backup");
    expect(memoryWatchdogRestartHeld()).toEqual(true);
    releaseMemoryWatchdogRestart();
    expect(memoryWatchdogRestartHeld()).toEqual(false);
  });

  it("requires matching releases for nested holds", () => {
    holdMemoryWatchdogRestart("outer");
    holdMemoryWatchdogRestart("inner");
    releaseMemoryWatchdogRestart();
    expect(memoryWatchdogRestartHeld()).toEqual(true);
    releaseMemoryWatchdogRestart();
    expect(memoryWatchdogRestartHeld()).toEqual(false);
  });
});

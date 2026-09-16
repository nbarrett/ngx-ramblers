import expect from "expect";
import { describe, it } from "mocha";
import { runWithRetries } from "./run-with-retries";

describe("runWithRetries", () => {
  it("succeeds when a dropped connection clears on a later attempt", async () => {
    const calls = {count: 0};
    const retries: number[] = [];
    const result = await runWithRetries(async () => {
      calls.count++;
      if (calls.count < 3) {
        throw new Error("This socket has been ended by the other party");
      } else {
        return "synced";
      }
    }, 3, 1, attempt => retries.push(attempt));
    expect(result).toEqual("synced");
    expect(retries).toEqual([1, 2]);
  });

  it("gives up with the last error once every attempt has failed", async () => {
    const calls = {count: 0};
    await expect(runWithRetries(async () => {
      calls.count++;
      throw new Error(`attempt ${calls.count} failed`);
    }, 3, 1, () => undefined)).rejects.toThrow("attempt 3 failed");
    expect(calls.count).toEqual(3);
  });
});
